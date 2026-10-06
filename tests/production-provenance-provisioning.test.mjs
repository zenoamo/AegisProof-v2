// Production provisioning boundary.
// The disk registry stays unprovisioned. Injected public keys exist only in this process.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { generateKeypair, bytesToHex } = await import("../scripts/lib/pqc-signature.mjs");
const { ml_dsa87 } = await import("@noble/post-quantum/ml-dsa.js");
const { loadRegistryPublicKey } = await import("../scripts/lib/public-key-registry.mjs");
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
  PROVISIONING_UNPROVISIONED,
  PROVISIONING_PROVISIONED,
  PROVISIONING_INVALID,
  ExternalSignerError,
  assessProductionProvenance,
  canonicalEntrySigningBytes,
  classifyProductionProvisioning,
  createInMemoryTestSigner,
  formatProductionProvenanceStatus,
  productionSigningKeyStatus,
  signManifestWithProductionSigner,
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

function productionRecord(publicKey, status = "active") {
  return {
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    algorithm: "ML-DSA-87",
    version: "v1",
    publicKey,
    status,
    immutable: true,
  };
}

function boundarySigner(keypair, keyId = PRODUCTION_PROVENANCE_KEY_ID, identity = "production") {
  const secret = keypair.secretKey;
  let seen = null;
  const signer = {
    identity,
    algorithm: "ML-DSA-87",
    keyId,
    publicKeyHex: keypair.publicKeyHex,
    signMessage(message) {
      seen = message;
      return {
        signature: bytesToHex(ml_dsa87.sign(message, secret)),
        publicKeyId: keyId,
      };
    },
    signedBytes() {
      return seen;
    },
  };
  return signer;
}

function outcome(manifest, lookup, extra = {}) {
  const signature = classifyManifestSignatures(manifest, {
    resolvePublicKey: (id) => lookup(id),
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
  const production = assessProductionProvenance(manifest, { signature, lookup });
  const lines = [
    ...formatProvenanceStatus(rotation, signature, decision),
    ...formatProductionProvenanceStatus(production),
  ];
  return { signature, decision, production, lines };
}

const live = productionSigningKeyStatus();
ok(live.state === PROVISIONING_UNPROVISIONED, "live registry is UNPROVISIONED");
ok(live.status === PRODUCTION_SIGNING_KEY_NOT_PROVISIONED, "live status is PRODUCTION SIGNING KEY NOT PROVISIONED");
ok(classifyProductionProvisioning(null).state === PROVISIONING_UNPROVISIONED, "absent record is UNPROVISIONED");

const injected = generateKeypair();
const replacement = generateKeypair();
const injectedRecord = productionRecord(injected.publicKeyHex);
const provisioned = classifyProductionProvisioning(injectedRecord);
ok(provisioned.state === PROVISIONING_PROVISIONED, "valid production public key is PROVISIONED");
ok(provisioned.provisioned === true, "PROVISIONED record can be used by the production path");
ok(
  !fs.existsSync(path.join(ROOT, "artifacts", "provenance", "public-keys", `${PRODUCTION_PROVENANCE_KEY_ID}.json`)),
  "injected public key was not written to the registry"
);

ok(classifyProductionProvisioning(productionRecord("abcd")).state === PROVISIONING_INVALID, "malformed public key is INVALID");
ok(
  classifyProductionProvisioning({ ...injectedRecord, algorithm: "ML-DSA-65" }).state === PROVISIONING_INVALID,
  "wrong algorithm is INVALID"
);
ok(
  classifyProductionProvisioning({ ...injectedRecord, keyId: "test-external-signer-a" }).state === PROVISIONING_INVALID,
  "production identity mismatch is INVALID"
);
const ciKey = loadRegistryPublicKey(CI_PROVENANCE_KEY_ID);
ok(
  classifyProductionProvisioning(productionRecord(ciKey.publicKey)).state === PROVISIONING_INVALID,
  "CI public key cannot be provisioned as production identity"
);
ok(
  classifyProductionProvisioning({ ...injectedRecord, secretKeyHex: "00" }).state === PROVISIONING_INVALID,
  "secret material in a production record is INVALID"
);
ok(
  classifyProductionProvisioning({ ...injectedRecord, status: "revoked" }).state === PROVISIONING_INVALID,
  "revoked production key is INVALID"
);

const signer = boundarySigner(injected);
const testSigner = createInMemoryTestSigner({ keyId: "test-external-signer-a" });
const manifest = { entries: [unsignedEntry("fixture-artifact")] };
assert.throws(
  () => signManifestWithProductionSigner(manifest, testSigner, { record: injectedRecord }),
  /test signer cannot sign as production identity/,
  "test signer cannot sign as production identity"
);
ok(true, "test signer plus production identity is rejected");
assert.throws(
  () => signManifestWithProductionSigner(manifest, boundarySigner(injected, "test-other", "production"), { record: injectedRecord }),
  /test signer cannot sign as production identity/,
  "production role cannot sign a test identity"
);
ok(true, "production signer plus test identity is rejected");
assert.throws(
  () => signManifestWithProductionSigner(manifest, { ...signer, identity: undefined }, { record: injectedRecord }),
  /signer identity missing/,
  "missing signer identity is rejected"
);
ok(true, "missing signer identity is rejected");
assert.throws(
  () =>
    signManifestWithProductionSigner(
      manifest,
      {
        ...signer,
        signMessage() {
          return { signature: "aa", publicKeyId: "test-external-signer-a" };
        },
      },
      { record: injectedRecord }
    ),
  /does not match requested production identity/,
  "returned identity must match the requested production identity"
);
ok(true, "signer returning a different identity is rejected");
let fallbackCalled = false;
assert.throws(
  () =>
    signManifestWithProductionSigner(
      manifest,
      {
        identity: "test",
        keyId: "test-external-signer-a",
        publicKeyHex: testSigner.publicKeyHex,
        signMessage() {
          fallbackCalled = true;
          return { signature: "aa", publicKeyId: "test-external-signer-a" };
        },
      },
      { record: null }
    ),
  new RegExp(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED),
  "unprovisioned production key does not fall back to a test signer"
);
ok(fallbackCalled === false, "unprovisioned path does not call the test signer");
assert.throws(
  () => signManifestWithProductionSigner(manifest, null, { record: injectedRecord }),
  /production signer unavailable/,
  "missing production signer is unavailable"
);
ok(true, "missing production signer does not fall back to a local private key");

const signed = signManifestWithProductionSigner(manifest, signer, { record: injectedRecord });
const entry = signed.entries[0];
ok(entry.pqcSignatureEnvelope.publicKeyId === PRODUCTION_PROVENANCE_KEY_ID, "production signature declares the production publicKeyId");
ok(
  Buffer.from(signer.signedBytes()).equals(Buffer.from(canonicalEntrySigningBytes(unsignedEntry("fixture-artifact")))),
  "production signer receives the existing canonical entry bytes"
);
ok(!Object.hasOwn(signer, "secretKey") && !Object.hasOwn(signer, "secretKeyHex"), "production signer object has no secret material");

const lookup = (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? injectedRecord : null);
const valid = outcome(signed, lookup);
ok(valid.signature.status === "VERIFIED", "valid production signature is manifest VERIFIED");
ok(valid.lines.includes("PROVENANCE VERIFIED"), "valid production signature is PROVENANCE VERIFIED");
ok(valid.decision.exitCode === EXIT_PROVENANCE_VERIFIED, "valid production signature exits 0");
ok(valid.production.provisioningState === PROVISIONING_PROVISIONED, "injected key path is PROVISIONED");
ok(valid.production.productionProvenanceVerified === true, "bound production signature is production provenance VERIFIED");
ok(valid.lines.includes("production provenance: VERIFIED"), "production provenance line is VERIFIED for the injected key");
ok(productionSigningKeyStatus().state === PROVISIONING_UNPROVISIONED, "injected verification does not provision the live registry");

const unsigned = outcome(manifest, lookup);
ok(unsigned.signature.status === "NOT_VERIFIED", "unsigned production manifest is NOT VERIFIED");
ok(unsigned.lines.includes("PROVENANCE NOT VERIFIED"), "unsigned line is PROVENANCE NOT VERIFIED");
ok(unsigned.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "unsigned exits 2");
ok(unsigned.production.productionProvenanceVerified === false, "PROVISIONED without a signature is not production VERIFIED");

const missingId = structuredClone(signed);
missingId.entries[0].pqcSignatureEnvelope.publicKeyId = null;
const unbound = outcome(missingId, lookup);
ok(unbound.signature.status === "NOT_VERIFIED", "missing publicKeyId is NOT VERIFIED");
ok(unbound.signature.signerBinding === "unavailable", "missing publicKeyId is signer binding unavailable");
ok(unbound.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "missing publicKeyId exits 2");
ok(unbound.production.productionProvenanceVerified === false, "missing publicKeyId is not production VERIFIED");

const unknown = structuredClone(signed);
unknown.entries[0].pqcSignatureEnvelope.publicKeyId = "test-unknown-key";
const unknownStatus = outcome(unknown, lookup);
ok(unknownStatus.signature.status === "FAIL", "unknown publicKeyId is FAIL");
ok(unknownStatus.decision.exitCode === EXIT_PROVENANCE_FAIL, "unknown publicKeyId exits 1");
ok(unknownStatus.production.productionProvenanceVerified === false, "unknown publicKeyId is not production VERIFIED");

const wrong = outcome(signed, lookup, { publicKeyOverride: replacement.publicKeyHex });
ok(wrong.signature.status === "FAIL", "wrong public key is FAIL");
ok(wrong.lines.includes("PROVENANCE FAIL"), "wrong public key is PROVENANCE FAIL");
ok(wrong.decision.exitCode === EXIT_PROVENANCE_FAIL, "wrong public key exits 1");

const tampered = structuredClone(signed);
tampered.entries[0].sha256 = "cd".repeat(32);
const tamperedStatus = outcome(tampered, lookup);
ok(tamperedStatus.signature.status === "FAIL", "tampered manifest is FAIL");
ok(/invalid signature/.test(tamperedStatus.signature.reason), "tampered manifest reason is invalid signature");
ok(tamperedStatus.decision.exitCode === EXIT_PROVENANCE_FAIL, "tampered manifest exits 1");

const unavailable = outcome(signed, lookup, { verifierAvailable: false });
ok(unavailable.signature.status === "NOT_RUN", "verifier unavailable is NOT RUN");
ok(unavailable.lines.includes("PROVENANCE NOT RUN"), "verifier unavailable is PROVENANCE NOT RUN");
ok(unavailable.decision.exitCode === EXIT_PROVENANCE_NOT_RUN, "verifier unavailable exits 3");
ok(unavailable.production.productionProvenanceVerified === false, "unavailable verifier is not production VERIFIED");

const testSigned = {
  entries: [
    {
      ...unsignedEntry("fixture-artifact"),
      pqcSignatureEnvelope: {
        ...signed.entries[0].pqcSignatureEnvelope,
        publicKey: testSigner.publicKeyHex,
        publicKeyId: testSigner.keyId,
        signature: testSigner.signMessage(canonicalEntrySigningBytes(unsignedEntry("fixture-artifact"))).signature,
      },
    },
  ],
};
const testLookup = (id) => {
  if (id === testSigner.keyId) return { keyId: id, publicKey: testSigner.publicKeyHex, algorithm: "ML-DSA-87", status: "active" };
  if (id === PRODUCTION_PROVENANCE_KEY_ID) return injectedRecord;
  return null;
};
const testResult = outcome(testSigned, testLookup);
ok(testResult.signature.status === "VERIFIED", "test signer signature is PROVENANCE VERIFIED");
ok(testResult.production.productionProvenanceVerified === false, "test signer verification is not production provenance VERIFIED");
ok(testResult.lines.includes("production provenance: NOT VERIFIED"), "test signer keeps production provenance NOT VERIFIED");

const predecessor = {
  keyId: "test-rotation-predecessor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: testSigner.publicKeyHex,
  status: "deprecated",
  notBefore: new Date(Date.now() - 120_000).toISOString(),
};
const successor = productionRecord(replacement.publicKeyHex);
successor.notBefore = new Date(Date.now() - 1_000).toISOString();
const rotation = classifyRotationEvidence(
  [
    {
      rotationId: "rotate-production-boundary",
      version: "v1",
      predecessorKeyId: predecessor.keyId,
      successorKeyId: PRODUCTION_PROVENANCE_KEY_ID,
      effectiveAt: new Date(Date.now() + 5_000).toISOString(),
      reason: "scheduled production provisioning rotation",
      recordedAt: new Date().toISOString(),
    },
  ],
  new Map([
    [predecessor.keyId, predecessor],
    [PRODUCTION_PROVENANCE_KEY_ID, successor],
  ])
);
const rotationOnly = outcome(manifest, lookup, { rotation });
ok(rotation.status === "PASS", "rotation evidence for the successor key is PASS");
ok(rotationOnly.signature.status === "NOT_VERIFIED", "rotation PASS leaves the unsigned manifest NOT VERIFIED");
ok(rotationOnly.production.productionProvenanceVerified === false, "rotation PASS is not production provenance VERIFIED");
ok(rotationOnly.decision.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "rotation-only manifest exits 2");

const revokedLookup = (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? productionRecord(injected.publicKeyHex, "revoked") : null);
const revoked = outcome(signed, revokedLookup);
ok(revoked.production.provisioningState === PROVISIONING_INVALID, "revoked production key is INVALID");
ok(revoked.production.productionProvenanceVerified === false, "revoked key signature is not production VERIFIED");
ok(revoked.lines.includes("production provenance: FAIL"), "revoked production key fails closed");

const nextRecord = productionRecord(replacement.publicKeyHex);
const nextLookup = (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? nextRecord : null);
const oldAgainstNew = outcome(signed, nextLookup);
ok(oldAgainstNew.signature.status === "FAIL", "old signature against the new production key is FAIL");
ok(oldAgainstNew.production.productionProvenanceVerified === false, "old signature is not production VERIFIED after rotation");
const nextSigner = boundarySigner(replacement);
const nextSigned = signManifestWithProductionSigner(manifest, nextSigner, { record: nextRecord });
const nextVerified = outcome(nextSigned, nextLookup);
ok(nextVerified.production.productionProvenanceVerified === true, "new production signature is production provenance VERIFIED");
ok(nextVerified.lines.includes("production provenance: VERIFIED"), "new production signature prints production provenance VERIFIED");
ok(productionSigningKeyStatus().state === PROVISIONING_UNPROVISIONED, "new signature fixture leaves the live key UNPROVISIONED");

const source = fs.readFileSync(path.join(ROOT, "scripts", "lib", "external-provenance-signer.mjs"), "utf8");
ok(!source.includes("loadPrivateKey"), "production signer does not load a local private key");
ok(!source.includes("writeRegistryPublicKey"), "provisioning boundary does not write a registry file");
ok(!source.includes("writeFileSync"), "provisioning boundary does not write secret or key files");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-provisioning-"));
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
ok(cli.status === EXIT_PROVENANCE_NOT_VERIFIED, "live unsigned --pqc exits 2");
ok(cliLines.includes("production provisioning: UNPROVISIONED"), "live provisioning state is UNPROVISIONED");
ok(cliLines.includes(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED), "live output says PRODUCTION SIGNING KEY NOT PROVISIONED");
ok(cliLines.includes("production provenance: NOT VERIFIED"), "live production provenance is NOT VERIFIED");
ok(!cliLines.includes("PROVENANCE VERIFIED"), "live unprovisioned path does not print PROVENANCE VERIFIED");
ok(!cliLines.includes("production provenance: VERIFIED"), "live unprovisioned path does not print production provenance VERIFIED");
fs.rmSync(tmpDir, { recursive: true, force: true });

ok(listProvenanceFiles().join("\n") === beforeFiles.join("\n"), "provenance files are unchanged");

console.log(`\nPRODUCTION PROVENANCE PROVISIONING: ${passed} checks PASS`);
