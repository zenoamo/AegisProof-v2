// ============================================================================
// Penetration Test — PQC signature + public key registry (PT-04, PT-05)
// Run: npm run test:penetration
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const {
  createPqcSignatureEnvelope,
  verifyEnvelope,
  verifyPqcSignatureEnvelope,
  entrySignPayload,
  generateKeypair,
  PQC_ENVELOPE_UNSIGNED,
} = await import("../../scripts/lib/pqc-signature.mjs");

const {
  validateEnvelopeKeyReference,
  loadRegistryPublicKey,
  validateRegistryRecord,
  detectDuplicateRegistryKeyIds,
  DEFAULT_PUBLIC_KEYS_DIR,
  listRegistryKeyIds,
} = await import("../../scripts/lib/public-key-registry.mjs");

const {
  createManifest,
  verifyManifest,
  signEntry,
  signManifest,
} = await import("../../scripts/lib/artifact-provenance.mjs");

const { resolveArtifacts } = await import("../../scripts/lib/resolve-artifacts.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const { secretKey, publicKeyHex } = generateKeypair();
const sampleEntry = {
  artifact: "production.zkey",
  path: "crypto-artifacts/phase4/production.zkey",
  sha256: "ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571",
  size: 2881473,
  version: "v2",
  source: "crypto-artifacts",
  present: true,
};
const payload = entrySignPayload(sampleEntry);
const envelope = createPqcSignatureEnvelope(payload, { privateKey: secretKey, publicKeyHex });

// --- PT-04: PQC Signature Failure Test ---
const invalidSig = { ...envelope, signature: "00".repeat(100) };
const p04a = verifyEnvelope(payload, invalidSig);
ok(!p04a.ok && (p04a.error?.includes("invalid") || p04a.error?.includes("signature")), "PT-04: invalid signature REJECT");

const unknownKey = { ...envelope, publicKey: null, publicKeyId: "unknown-key-id-pt04" };
const p04b = validateEnvelopeKeyReference(unknownKey);
ok(!p04b.ok && p04b.error.includes("unknown publicKeyId"), "PT-04: unknown keyId REJECT");
const p04b2 = verifyEnvelope(payload, unknownKey);
ok(!p04b2.ok, "PT-04: verifyEnvelope rejects unknown keyId");

const modifiedPk = { ...envelope, publicKey: generateKeypair().publicKeyHex };
const p04c = verifyEnvelope(payload, modifiedPk);
ok(!p04c.ok, "PT-04: modified public key REJECT");

const missingSig = { ...PQC_ENVELOPE_UNSIGNED };
const p04d = verifyEnvelope(payload, missingSig);
ok(!p04d.ok && p04d.error?.includes("missing"), "PT-04: missing signature REJECT");

const paths = resolveArtifacts();
const unsignedManifest = createManifest(paths, { sign: false });
const defaultVerify = verifyManifest(unsignedManifest, { allowMissingOptional: true, allowMissingProductionZkey: true, pqcRequired: false });
ok(defaultVerify.ok, "PT-04: default tier PASS with unsigned (WARN path)");
ok(
  defaultVerify.warnings.some((w) => w.includes("PQC signature absent") || w.includes("unsigned")),
  "PT-04: default tier emits WARN for unsigned"
);

const strictVerify = verifyManifest(unsignedManifest, { allowMissingOptional: true, allowMissingProductionZkey: true, pqcRequired: true });
ok(!strictVerify.ok, "PT-04: strict tier FAIL for missing signature");
ok(
  strictVerify.errors.some((e) => e.includes("PQC signature required")),
  "PT-04: strict tier error mentions required signature"
);

const signedManifest = signManifest(unsignedManifest, { secretKey, publicKeyHex });
const strictSigned = verifyManifest(signedManifest, { allowMissingOptional: true, allowMissingProductionZkey: true, pqcRequired: true });
ok(strictSigned.ok || strictSigned.errors.length === 0, "PT-04: strict tier PASS when properly signed");

const tamperedSigned = JSON.parse(JSON.stringify(signedManifest));
const tamperedEntry = tamperedSigned.entries.find((e) => e.artifact === "production-vkey.json");
assert.ok(tamperedEntry, "PT-04: repository-local signed artifact fixture");
tamperedEntry.sha256 = "d".repeat(64);
const p04e = verifyManifest(tamperedSigned, { allowMissingOptional: true, allowMissingProductionZkey: true, pqcRequired: true });
ok(!p04e.ok, "PT-04: tampered signed manifest REJECT");

const pqcLayer = verifyPqcSignatureEnvelope(signedManifest, { required: true });
ok(pqcLayer.valid, "PT-04: verifyPqcSignatureEnvelope valid signed manifest");

// --- PT-05: Public Key Registry Security Test ---
const dupCheck = detectDuplicateRegistryKeyIds();
ok(dupCheck.ok, "PT-05: no duplicate keyIds in registry");

const keyIds = listRegistryKeyIds();
ok(keyIds.length >= 1, "PT-05: registry has at least one key");
ok(new Set(keyIds).size === keyIds.length, "PT-05: keyId list unique");

const ciKeyPath = path.join(DEFAULT_PUBLIC_KEYS_DIR, "aegis-ci-mldsa87-v1.json");
ok(fs.existsSync(ciKeyPath), "PT-05: CI registry key file exists");
const ciRaw = JSON.parse(fs.readFileSync(ciKeyPath, "utf8"));
const ciValid = validateRegistryRecord(ciRaw, "aegis-ci-mldsa87-v1");
ok(ciValid.ok, "PT-05: committed CI key record valid");

const malformed = { keyId: "bad-key", algorithm: "ML-DSA-87", version: "v1", publicKey: "abc" };
const p05a = validateRegistryRecord(malformed, "bad-key");
ok(!p05a.ok && p05a.errors.some((e) => e.includes("malformed")), "PT-05: malformed key REJECT");

const privateInject = {
  keyId: "evil-key",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: publicKeyHex,
  privateKey: "deadbeef",
  secretKeyHex: "deadbeef",
};
const p05b = validateRegistryRecord(privateInject, "evil-key");
ok(!p05b.ok && p05b.errors.some((e) => e.includes("forbidden field")), "PT-05: privateKey injection REJECT");

const unauthorizedField = {
  ...ciRaw,
  adminOverride: true,
  keyId: "aegis-ci-mldsa87-v1",
};
const p05c = validateRegistryRecord(unauthorizedField, "aegis-ci-mldsa87-v1");
ok(p05c.ok, "PT-05: unknown non-secret fields allowed (public metadata only)");

const loaded = loadRegistryPublicKey("aegis-ci-mldsa87-v1");
ok(loaded?.immutable === true, "PT-05: CI key marked immutable");

const signedEntry = signEntry(sampleEntry, { secretKey, publicKeyHex, publicKeyId: "does-not-exist" });
const refBad = validateEnvelopeKeyReference(signedEntry.pqcSignatureEnvelope);
ok(!refBad.ok, "PT-05: envelope with unregistered keyId REJECT");

console.log(`\nPQC SECURITY: ${passed} checks PASS`);
