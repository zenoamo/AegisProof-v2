// External ML-DSA-87 provenance signing and publicKeyId binding.
// Test keys stay in memory. They are not production identity and are not written.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  classifyManifestSignatures,
  classifyRotationEvidence,
  decideProvenanceExit,
  formatProvenanceStatus,
  EXIT_PROVENANCE_VERIFIED,
  EXIT_PROVENANCE_FAIL,
  EXIT_PROVENANCE_NOT_VERIFIED,
  EXIT_PROVENANCE_NOT_RUN,
} = await import("../scripts/lib/provenance-verification-status.mjs");
const {
  CI_PROVENANCE_KEY_ID,
  PRODUCTION_PROVENANCE_KEY_ID,
  PRODUCTION_SIGNING_KEY_NOT_PROVISIONED,
  ExternalSignerError,
  assessProductionProvenance,
  createInMemoryTestSigner,
  formatProductionProvenanceStatus,
  isProductionProvenanceVerified,
  productionSigningKeyStatus,
  signEntryWithExternalSigner,
  signManifestWithExternalSigner,
} = await import("../scripts/lib/external-provenance-signer.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

function listProvenanceFiles() {
  const root = path.join(ROOT, "artifacts", "provenance");
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else files.push(path.relative(ROOT, abs).split(path.sep).join("/"));
    }
  };
  walk(root);
  return files.sort();
}

const beforeFiles = listProvenanceFiles();

function unsignedEntry(artifact, sha = "ab".repeat(32)) {
  return {
    artifact,
    path: `fixtures/${artifact}`,
    sha256: sha,
    size: 4,
    version: "v2",
    source: "test",
    present: true,
    pqcSignatureEnvelope: {
      status: "unsigned",
      algorithmVersion: "ML-DSA-87",
      version: "v1",
      signature: null,
      publicKey: null,
      publicKeyId: null,
      signedAt: null,
    },
  };
}

const signerA = createInMemoryTestSigner({ keyId: "test-external-signer-a" });
const signerB = createInMemoryTestSigner({ keyId: "test-external-signer-b" });
const registry = new Map([
  [signerA.keyId, { keyId: signerA.keyId, publicKey: signerA.publicKeyHex, algorithm: "ML-DSA-87", status: "active" }],
  [signerB.keyId, { keyId: signerB.keyId, publicKey: signerB.publicKeyHex, algorithm: "ML-DSA-87", status: "active" }],
]);
const resolvePublicKey = (id) => registry.get(id) ?? null;

function outcome(manifest, extra = {}) {
  const signature = classifyManifestSignatures(manifest, {
    resolvePublicKey: extra.resolvePublicKey ?? resolvePublicKey,
    verifierAvailable: extra.verifierAvailable,
    publicKeyOverride: extra.publicKeyOverride,
  });
  const rotation = extra.rotation ?? classifyRotationEvidence(manifest.rotationEvidence);
  const decision = decideProvenanceExit({
    signature,
    rotation,
    pqcRequired: true,
    hardErrors: [],
  });
  const production = assessProductionProvenance(manifest, { signature });
  const lines = [
    ...formatProvenanceStatus(rotation, signature, decision),
    ...formatProductionProvenanceStatus(production),
  ];
  return { signature, rotation, decision, production, lines };
}

function hasLine(result, line) {
  return result.lines.includes(line);
}

ok(signerA.identity === "test", "test signer identity is test");
ok(signerA.keyId.startsWith("test-"), "test signer key id is a test id");
ok(!Object.hasOwn(signerA, "secretKey"), "test signer object has no secretKey");
ok(!Object.hasOwn(signerA, "secretKeyHex"), "test signer object has no secretKeyHex");
ok(!Object.hasOwn(signerA, "privateKey"), "test signer object has no privateKey");
assert.throws(
  () => signEntryWithExternalSigner(unsignedEntry("fixture"), { ...signerA, secretKey: new Uint8Array([1]) }),
  ExternalSignerError,
  "signer carrying secretKey is rejected"
);
ok(true, "signer carrying secretKey is rejected");
assert.throws(
  () => createInMemoryTestSigner({ keyId: PRODUCTION_PROVENANCE_KEY_ID }),
  /must start with test-/,
  "production key id is not a test signer"
);
ok(true, "production key id is not a test signer");
assert.throws(
  () => createInMemoryTestSigner({ keyId: CI_PROVENANCE_KEY_ID }),
  /must start with test-/,
  "CI key id is not a test signer"
);
ok(true, "CI key id is not a test signer");

const signed = signManifestWithExternalSigner({ entries: [unsignedEntry("fixture-artifact")] }, signerA);
const envelope = signed.entries[0].pqcSignatureEnvelope;
ok(envelope.algorithmVersion === "ML-DSA-87", "envelope algorithm is ML-DSA-87");
ok(envelope.publicKeyId === signerA.keyId, "envelope publicKeyId is the signer key id");
ok(typeof envelope.signature === "string" && envelope.signature.length > 0, "envelope signature is present");
ok(envelope.publicKeyId !== envelope.signature, "publicKeyId is not the signature");

const valid = outcome(signed);
ok(valid.signature.status === "VERIFIED", "Case A: signature status VERIFIED");
ok(hasLine(valid, "Provenance manifest signature: VERIFIED"), "Case A: signature line VERIFIED");
ok(hasLine(valid, "PROVENANCE VERIFIED"), "Case A: PROVENANCE VERIFIED");
ok(valid.decision.exitCode === EXIT_PROVENANCE_VERIFIED, "Case A: exit 0");
ok(valid.signature.signerBinding === "checked", "Case A: publicKeyId binds the registered key");
ok(valid.production.productionProvenanceVerified === false, "Case A: test verification is not production VERIFIED");
ok(hasLine(valid, PRODUCTION_SIGNING_KEY_NOT_PROVISIONED), "Case A: production key is not provisioned");
ok(hasLine(valid, "production provenance: NOT VERIFIED"), "Case A: production provenance stays NOT VERIFIED");
ok(
  hasLine(valid, "test or non-production signature verification is not production provenance VERIFIED"),
  "Case A: test PASS is labeled separately from production"
);

const unsigned = outcome({ entries: [unsignedEntry("fixture-artifact")] });
ok(unsigned.signature.status === "NOT_VERIFIED", "Case B: unsigned status NOT_VERIFIED");
ok(hasLine(unsigned, "Provenance manifest signature: NOT VERIFIED"), "Case B: signature line NOT VERIFIED");
ok(hasLine(unsigned, "PROVENANCE NOT VERIFIED"), "Case B: PROVENANCE NOT VERIFIED");
ok(unsigned.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "Case B: exit 2");
ok(!hasLine(unsigned, "PROVENANCE VERIFIED"), "Case B: unsigned is not PROVENANCE VERIFIED");

const missingId = structuredClone(signed);
missingId.entries[0].pqcSignatureEnvelope.publicKeyId = null;
const unbound = outcome(missingId);
ok(unbound.signature.status === "NOT_VERIFIED", "Case C: missing publicKeyId is NOT_VERIFIED");
ok(unbound.signature.signerBinding === "unavailable", "Case C: signer binding unavailable");
ok(unbound.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "Case C: exit 2");
ok(!hasLine(unbound, "PROVENANCE VERIFIED"), "Case C: missing publicKeyId is not PROVENANCE VERIFIED");

const unknown = structuredClone(signed);
unknown.entries[0].pqcSignatureEnvelope.publicKeyId = "test-unknown-key";
const unknownStatus = outcome(unknown);
ok(unknownStatus.signature.status === "FAIL", "Case D: unknown publicKeyId is FAIL");
ok(/unknown publicKeyId/.test(unknownStatus.signature.reason), "Case D: reason names unknown publicKeyId");
ok(unknownStatus.decision.exitCode === EXIT_PROVENANCE_FAIL, "Case D: exit 1");
ok(!hasLine(unknownStatus, "PROVENANCE VERIFIED"), "Case D: unknown publicKeyId is not PROVENANCE VERIFIED");

const wrong = signManifestWithExternalSigner({ entries: [unsignedEntry("fixture-artifact")] }, signerB);
wrong.entries[0].pqcSignatureEnvelope.publicKeyId = signerA.keyId;
wrong.entries[0].pqcSignatureEnvelope.publicKey = signerA.publicKeyHex;
const wrongStatus = outcome(wrong);
ok(wrongStatus.signature.status === "FAIL", "Case E: wrong key binding is FAIL");
ok(hasLine(wrongStatus, "Provenance manifest signature: FAIL"), "Case E: signature line FAIL");
ok(hasLine(wrongStatus, "PROVENANCE FAIL"), "Case E: PROVENANCE FAIL");
ok(wrongStatus.decision.exitCode === EXIT_PROVENANCE_FAIL, "Case E: exit 1");
ok(!hasLine(wrongStatus, "PROVENANCE VERIFIED"), "Case E: wrong key is not PROVENANCE VERIFIED");

const tampered = structuredClone(signed);
tampered.entries[0].sha256 = "cd".repeat(32);
const tamperedStatus = outcome(tampered);
ok(tamperedStatus.signature.status === "FAIL", "Case F: tampered manifest is FAIL");
ok(/invalid signature/.test(tamperedStatus.signature.reason), "Case F: reason is invalid signature");
ok(hasLine(tamperedStatus, "PROVENANCE FAIL"), "Case F: PROVENANCE FAIL");
ok(tamperedStatus.decision.exitCode === EXIT_PROVENANCE_FAIL, "Case F: exit 1");
ok(!hasLine(tamperedStatus, "PROVENANCE VERIFIED"), "Case F: tampered manifest is not PROVENANCE VERIFIED");

const predecessor = {
  keyId: "test-rotation-predecessor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: signerA.publicKeyHex,
  status: "deprecated",
  notBefore: new Date(Date.now() - 120_000).toISOString(),
};
const successor = {
  keyId: "test-rotation-successor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: signerB.publicKeyHex,
  status: "active",
  notBefore: new Date(Date.now() - 1_000).toISOString(),
};
const rotation = classifyRotationEvidence(
  [
    {
      rotationId: "rotate-test-001",
      version: "v1",
      predecessorKeyId: predecessor.keyId,
      successorKeyId: successor.keyId,
      effectiveAt: new Date(Date.now() + 5_000).toISOString(),
      reason: "scheduled test rotation",
      recordedAt: new Date().toISOString(),
    },
  ],
  new Map([
    [predecessor.keyId, predecessor],
    [successor.keyId, successor],
  ])
);
const rotationOnly = outcome(
  { entries: [unsignedEntry("fixture-artifact")], rotationEvidence: [] },
  { rotation }
);
ok(rotation.status === "PASS", "Case G: rotation evidence PASS");
ok(hasLine(rotationOnly, "PQC key rotation evidence: PASS"), "Case G: rotation line PASS");
ok(rotationOnly.signature.status === "NOT_VERIFIED", "Case G: unsigned manifest stays NOT_VERIFIED");
ok(hasLine(rotationOnly, "PROVENANCE NOT VERIFIED"), "Case G: rotation PASS does not become PROVENANCE VERIFIED");
ok(rotationOnly.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "Case G: exit 2");
ok(!hasLine(rotationOnly, "PROVENANCE VERIFIED"), "Case G: no PROVENANCE VERIFIED line");
ok(rotationOnly.production.productionProvenanceVerified === false, "Case G: rotation PASS is not production VERIFIED");

const unavailable = outcome(signed, { verifierAvailable: false });
ok(unavailable.signature.status === "NOT_RUN", "Case H: verifier unavailable is NOT_RUN");
ok(hasLine(unavailable, "Provenance manifest signature: NOT RUN"), "Case H: signature line NOT RUN");
ok(hasLine(unavailable, "PROVENANCE NOT RUN"), "Case H: PROVENANCE NOT RUN");
ok(unavailable.decision.exitCode === EXIT_PROVENANCE_NOT_RUN, "Case H: exit 3");
ok(!hasLine(unavailable, "PROVENANCE VERIFIED"), "Case H: unavailable verifier is not PROVENANCE VERIFIED");

const liveKey = productionSigningKeyStatus();
ok(liveKey.provisioned === false, "live registry has no production signing key");
ok(liveKey.status === PRODUCTION_SIGNING_KEY_NOT_PROVISIONED, "live status is PRODUCTION SIGNING KEY NOT PROVISIONED");
ok(
  !fs.existsSync(path.join(ROOT, "artifacts", "provenance", "public-keys", `${PRODUCTION_PROVENANCE_KEY_ID}.json`)),
  "production public key file is not in the registry"
);
ok(
  isProductionProvenanceVerified({
    productionKeyProvisioned: true,
    manifestSignedByProductionKeyId: true,
    manifestSignatureStatus: "VERIFIED",
  }) === true,
  "production predicate is true only for the registered-key conjunction"
);
ok(
  isProductionProvenanceVerified({
    productionKeyProvisioned: false,
    manifestSignedByProductionKeyId: true,
    manifestSignatureStatus: "VERIFIED",
  }) === false,
  "production predicate is false when the production key is not provisioned"
);
ok(valid.production.productionProvenanceVerified === false, "this environment did not verify production provenance");

assert.throws(
  () =>
    signEntryWithExternalSigner(unsignedEntry("bound-artifact"), {
      identity: "test",
      algorithm: "ML-DSA-87",
      keyId: signerA.keyId,
      publicKeyHex: signerA.publicKeyHex,
      signMessage(message) {
        const signedByB = signerB.signMessage(message);
        return { signature: signedByB.signature, keyId: signerB.keyId };
      },
    }),
  /keyId does not match/,
  "callback cannot rebind a signature to another keyId"
);
ok(true, "callback cannot rebind a signature to another keyId");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-external-provenance-"));
const tmpManifest = path.join(tmpDir, "manifest.json");
fs.copyFileSync(path.join(ROOT, "artifacts", "provenance", "manifest.json"), tmpManifest);
const cli = spawnSync(
  process.execPath,
  [
    "scripts/verify-provenance-manifest.mjs",
    "--live",
    "--pqc",
    "--allow-missing-production-zkey",
    "--manifest",
    tmpManifest,
  ],
  { cwd: ROOT, encoding: "utf8" }
);
const cliLines = `${cli.stdout ?? ""}\n${cli.stderr ?? ""}`.split("\n");
ok(cli.status === EXIT_PROVENANCE_NOT_VERIFIED, "CLI unsigned --pqc exits 2");
ok(cliLines.includes("PROVENANCE NOT VERIFIED"), "CLI prints PROVENANCE NOT VERIFIED");
ok(!cliLines.includes("PROVENANCE VERIFIED"), "CLI does not print PROVENANCE VERIFIED");
ok(cliLines.includes(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED), "CLI prints PRODUCTION SIGNING KEY NOT PROVISIONED");
ok(cliLines.includes("production provenance: NOT VERIFIED"), "CLI production provenance is NOT VERIFIED");
fs.rmSync(tmpDir, { recursive: true, force: true });

ok(listProvenanceFiles().join("\n") === beforeFiles.join("\n"), "provenance files are unchanged");
ok(
  !listProvenanceFiles().some((file) => file.includes(PRODUCTION_PROVENANCE_KEY_ID)),
  "production key material was not written"
);

console.log(`\nEXTERNAL PROVENANCE SIGNING: ${passed} checks PASS`);
