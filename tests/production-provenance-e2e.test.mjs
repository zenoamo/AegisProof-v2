// Production provenance final E2E.
// This environment has no production credential. The live result stays NOT VERIFIED.
// In-memory keys are used only to force FAIL / NOT RUN. They are not production VERIFIED.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { generateKeypair, bytesToHex } = await import("../scripts/lib/pqc-signature.mjs");
const { ml_dsa87 } = await import("@noble/post-quantum/ml-dsa.js");
const {
  CI_PROVENANCE_KEY_ID,
  PRODUCTION_PROVENANCE_KEY_ID,
  PRODUCTION_SIGNING_KEY_NOT_PROVISIONED,
  PROVISIONING_PROVISIONED,
  PROVISIONING_UNPROVISIONED,
  createInMemoryTestSigner,
  signManifestWithProductionSigner,
} = await import("../scripts/lib/external-provenance-signer.mjs");
const {
  EXIT_PROVENANCE_FAIL,
  EXIT_PROVENANCE_NOT_RUN,
  EXIT_PROVENANCE_NOT_VERIFIED,
} = await import("../scripts/lib/provenance-verification-status.mjs");
const {
  detectProductionCredentialSource,
  runProductionProvenanceE2E,
} = await import("../scripts/lib/production-provenance-e2e.mjs");

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
const emptyEnv = {};

function unsignedEntry(artifact = "fixture-artifact", sha = "ab".repeat(32)) {
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

function boundarySigner(keypair, returnedId = PRODUCTION_PROVENANCE_KEY_ID) {
  const secret = keypair.secretKey;
  return {
    identity: "production",
    algorithm: "ML-DSA-87",
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    publicKeyHex: keypair.publicKeyHex,
    signMessage(message) {
      return {
        signature: bytesToHex(ml_dsa87.sign(message, secret)),
        publicKeyId: returnedId,
      };
    },
  };
}

function hasLine(result, line) {
  return result.lines.includes(line);
}

ok(detectProductionCredentialSource(emptyEnv) === null, "empty environment has no production credential");
ok(
  detectProductionCredentialSource({
    AEGIS_PROVENANCE_SIGNING: "kms",
    AEGIS_PROVENANCE_KEY_ID: CI_PROVENANCE_KEY_ID,
    KMS_BACKEND_MODE: "live",
  }) === null,
  "CI key id is not a production credential source"
);
ok(
  detectProductionCredentialSource({
    AEGIS_PROVENANCE_SIGNING: "kms",
    AEGIS_PROVENANCE_KEY_ID: "test-external-signer-a",
    KMS_BACKEND_MODE: "live",
  }) === null,
  "test key id is not a production credential source"
);
ok(
  detectProductionCredentialSource({
    AEGIS_PROVENANCE_SIGNING: "kms",
    AEGIS_PROVENANCE_KEY_ID: PRODUCTION_PROVENANCE_KEY_ID,
    KMS_BACKEND_MODE: "stub",
  }) === null,
  "stub KMS mode is not a production credential"
);
ok(detectProductionCredentialSource(process.env) === null, "this process has no production credential");

const unsigned = { entries: [unsignedEntry()] };
const absent = await runProductionProvenanceE2E(unsigned, { env: emptyEnv, lookup: () => null });
ok(absent.provisioningState === PROVISIONING_UNPROVISIONED, "production E2E unprovisioned state");
ok(absent.e2eStatus === "NOT RUN", "production E2E unprovisioned is NOT RUN");
ok(hasLine(absent, PRODUCTION_SIGNING_KEY_NOT_PROVISIONED), "production E2E unprovisioned prints NOT PROVISIONED");
ok(hasLine(absent, "production provenance: NOT VERIFIED"), "production E2E unprovisioned is NOT VERIFIED");
ok(absent.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "production E2E unprovisioned exits 2");
ok(absent.productionProvenanceVerified === false, "production E2E unprovisioned is not VERIFIED");
ok(!hasLine(absent, "production provenance: VERIFIED"), "unprovisioned output has no production VERIFIED line");

const injected = generateKeypair();
const other = generateKeypair();
const record = productionRecord(injected.publicKeyHex);
const provisionedLookup = (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? record : null);
const signerMissing = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: provisionedLookup,
});
ok(signerMissing.provisioningState === PROVISIONING_PROVISIONED, "production E2E provisioned public key");
ok(signerMissing.e2eStatus === "NOT RUN", "provisioned without signer is NOT RUN");
ok(hasLine(signerMissing, "production provenance: NOT RUN"), "provisioned without signer does not verify production provenance");
ok(signerMissing.exitCode === EXIT_PROVENANCE_NOT_RUN, "signer unavailable exits 3");
ok(!hasLine(signerMissing, "production provenance: VERIFIED"), "signer unavailable is not production VERIFIED");

const wrongId = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: provisionedLookup,
  signer: {
    identity: "production",
    algorithm: "ML-DSA-87",
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    publicKeyHex: injected.publicKeyHex,
    signMessage() {
      return { signature: "aa", publicKeyId: CI_PROVENANCE_KEY_ID };
    },
  },
});
ok(wrongId.e2eStatus === "FAIL", "CI identity returned by signer is FAIL");
ok(hasLine(wrongId, "PROVENANCE FAIL"), "wrong signer identity is PROVENANCE FAIL");
ok(wrongId.exitCode === EXIT_PROVENANCE_FAIL, "wrong signer identity exits 1");
ok(wrongId.productionProvenanceVerified === false, "wrong signer identity is not production VERIFIED");

const unknownId = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: provisionedLookup,
  signer: {
    identity: "production",
    algorithm: "ML-DSA-87",
    keyId: PRODUCTION_PROVENANCE_KEY_ID,
    publicKeyHex: injected.publicKeyHex,
    signMessage() {
      return { signature: "aa", publicKeyId: "unknown-production-key" };
    },
  },
});
ok(unknownId.e2eStatus === "FAIL", "unknown signer identity is FAIL");
ok(unknownId.exitCode === EXIT_PROVENANCE_FAIL, "unknown signer identity exits 1");

const revoked = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? productionRecord(injected.publicKeyHex, "revoked") : null),
});
ok(revoked.e2eStatus === "FAIL", "revoked production key is FAIL");
ok(hasLine(revoked, "production provisioning: INVALID"), "revoked production key is INVALID");
ok(hasLine(revoked, "production provenance: FAIL"), "revoked production key fails closed");
ok(revoked.exitCode === EXIT_PROVENANCE_FAIL, "revoked production key exits 1");

const signed = signManifestWithProductionSigner(unsigned, boundarySigner(injected), { record });
const wrongKey = await runProductionProvenanceE2E(signed, {
  env: emptyEnv,
  lookup: (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? productionRecord(other.publicKeyHex) : null),
});
ok(wrongKey.e2eStatus === "FAIL", "wrong public key is FAIL");
ok(hasLine(wrongKey, "PROVENANCE FAIL"), "wrong public key is PROVENANCE FAIL");
ok(wrongKey.productionProvenanceVerified === false, "wrong public key is not production VERIFIED");

const tamperedBytes = structuredClone(signed);
tamperedBytes.entries[0].sha256 = "cd".repeat(32);
const tamperedCanonical = await runProductionProvenanceE2E(tamperedBytes, {
  env: emptyEnv,
  lookup: provisionedLookup,
});
ok(tamperedCanonical.e2eStatus === "FAIL", "tampered canonical bytes are FAIL");
ok(tamperedCanonical.exitCode === EXIT_PROVENANCE_FAIL, "tampered canonical bytes exit 1");

const tamperedSignature = structuredClone(signed);
tamperedSignature.entries[0].pqcSignatureEnvelope.signature = `${tamperedSignature.entries[0].pqcSignatureEnvelope.signature.slice(0, -2)}00`;
const tamperedSig = await runProductionProvenanceE2E(tamperedSignature, {
  env: emptyEnv,
  lookup: provisionedLookup,
});
ok(tamperedSig.e2eStatus === "FAIL", "tampered signature is FAIL");
ok(tamperedSig.productionProvenanceVerified === false, "tampered signature is not production VERIFIED");

const inMemorySigned = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: provisionedLookup,
  signer: boundarySigner(injected),
});
ok(inMemorySigned.e2eStatus === "NOT RUN", "in-memory signer does not complete production E2E");
ok(hasLine(inMemorySigned, "Provenance manifest signature: VERIFIED"), "in-memory signature can verify at the manifest layer");
ok(hasLine(inMemorySigned, "production provenance: NOT VERIFIED"), "in-memory signature is not production provenance VERIFIED");
ok(!hasLine(inMemorySigned, "production provenance: VERIFIED"), "in-memory signature has no production VERIFIED line");
ok(inMemorySigned.productionProvenanceVerified === false, "in-memory signature flag stays unverified");

const { canonicalEntrySigningBytes } = await import("../scripts/lib/external-provenance-signer.mjs");
const testSigner = createInMemoryTestSigner({ keyId: "test-external-signer-a" });
const testEntry = unsignedEntry();
const testSigned = testSigner.signMessage(canonicalEntrySigningBytes(testEntry));
const testManifest = {
  entries: [
    {
      ...testEntry,
      pqcSignatureEnvelope: {
        status: "signed",
        algorithmVersion: "ML-DSA-87",
        version: "v1",
        signature: testSigned.signature,
        publicKey: testSigner.publicKeyHex,
        publicKeyId: testSigner.keyId,
        signedAt: new Date().toISOString(),
      },
    },
  ],
};
const testLookup = (id) => (id === testSigner.keyId ? { keyId: id, publicKey: testSigner.publicKeyHex, algorithm: "ML-DSA-87", status: "active" } : null);
const testOnly = await runProductionProvenanceE2E(testManifest, { env: emptyEnv, lookup: testLookup });
ok(hasLine(testOnly, "Provenance manifest signature: VERIFIED"), "test identity manifest signature can be VERIFIED");
ok(testOnly.provisioningState === PROVISIONING_UNPROVISIONED, "test identity leaves production UNPROVISIONED");
ok(hasLine(testOnly, "production provenance: NOT VERIFIED"), "test identity production provenance stays NOT VERIFIED");
ok(testOnly.e2eStatus === "NOT RUN", "test identity does not run production E2E");
ok(!hasLine(testOnly, "production provenance: VERIFIED"), "test identity does not print production VERIFIED");

const predecessor = {
  keyId: "test-rotation-predecessor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: testSigner.publicKeyHex,
  status: "deprecated",
  notBefore: new Date(Date.now() - 120_000).toISOString(),
};
const successor = productionRecord(other.publicKeyHex);
successor.notBefore = new Date(Date.now() - 1_000).toISOString();
const rotationManifest = {
  entries: [unsignedEntry()],
  rotationEvidence: [
    {
      rotationId: "rotate-e2e-boundary",
      version: "v1",
      predecessorKeyId: predecessor.keyId,
      successorKeyId: PRODUCTION_PROVENANCE_KEY_ID,
      effectiveAt: new Date(Date.now() + 5_000).toISOString(),
      reason: "scheduled production rotation",
      recordedAt: new Date().toISOString(),
    },
  ],
};
const rotationOnly = await runProductionProvenanceE2E(rotationManifest, {
  env: emptyEnv,
  lookup: () => null,
  rotationRegistry: new Map([
    [predecessor.keyId, predecessor],
    [PRODUCTION_PROVENANCE_KEY_ID, successor],
  ]),
});
ok(hasLine(rotationOnly, "PQC key rotation evidence: PASS"), "rotation evidence is PASS");
ok(hasLine(rotationOnly, "Provenance manifest signature: NOT VERIFIED"), "rotation evidence leaves the manifest NOT VERIFIED");
ok(hasLine(rotationOnly, "production provenance: NOT VERIFIED"), "rotation evidence leaves production provenance NOT VERIFIED");
ok(rotationOnly.exitCode === EXIT_PROVENANCE_NOT_VERIFIED, "rotation-only E2E exits 2");

const oldAgainstNew = await runProductionProvenanceE2E(signed, {
  env: emptyEnv,
  lookup: (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? productionRecord(other.publicKeyHex, "revoked") : null),
});
ok(oldAgainstNew.e2eStatus === "FAIL", "old signature against a revoked production key is FAIL");
ok(oldAgainstNew.productionProvenanceVerified === false, "revoked key cannot produce production VERIFIED");
const rotatedWithoutCredential = await runProductionProvenanceE2E(unsigned, {
  env: emptyEnv,
  lookup: (id) => (id === PRODUCTION_PROVENANCE_KEY_ID ? productionRecord(other.publicKeyHex) : null),
});
ok(rotatedWithoutCredential.e2eStatus === "NOT RUN", "new production key without a live signer is NOT RUN");
ok(rotatedWithoutCredential.productionProvenanceVerified === false, "new production key without a credential is not VERIFIED");

for (const entry of signed.entries) {
  const env = entry.pqcSignatureEnvelope;
  ok(env.secretKey == null && env.secretKeyHex == null && env.privateKey == null, "signature envelope has no private key material");
}

const source = fs.readFileSync(path.join(ROOT, "scripts", "lib", "production-provenance-e2e.mjs"), "utf8");
ok(!source.includes("loadPrivateKey"), "E2E does not read a local private key");
ok(!source.includes("keygen("), "E2E does not generate a production key");
ok(!source.includes("writeFileSync"), "E2E does not write credential files");

const cli = spawnSync(process.execPath, ["scripts/verify-production-provenance-e2e.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
});
const cliLines = `${cli.stdout ?? ""}\n${cli.stderr ?? ""}`.split("\n");
ok(cli.status === EXIT_PROVENANCE_NOT_VERIFIED, "live E2E command exits NOT VERIFIED");
ok(cliLines.includes(PRODUCTION_SIGNING_KEY_NOT_PROVISIONED), "live E2E command prints NOT PROVISIONED");
ok(cliLines.includes("production provenance: NOT VERIFIED"), "live E2E command prints production NOT VERIFIED");
ok(cliLines.includes("Production provenance E2E: NOT RUN"), "live E2E command is NOT RUN");
ok(!cliLines.includes("production provenance: VERIFIED"), "live E2E command does not print production VERIFIED");
ok(!cliLines.includes("PROVENANCE VERIFIED"), "live E2E command does not print PROVENANCE VERIFIED");
ok(!/secretKeyHex|privateKeyHex|BEGIN [A-Z ]*PRIVATE KEY/.test(`${cli.stdout ?? ""}\n${cli.stderr ?? ""}`), "E2E output contains no private key material");
ok(listProvenanceFiles().join("\n") === beforeFiles.join("\n"), "E2E left the provenance tree unchanged");

console.log(`\nPRODUCTION PROVENANCE E2E: ${passed} checks PASS`);
