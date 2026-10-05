// ============================================================================
// ML-DSA provenance signature tests (Phase 8.13 Task 4–5)
// Run: npm run test:pqc-signature
// ============================================================================
import assert from "node:assert/strict";
import { fileURLToPath } from "url";

const {
  PROVENANCE_DOMAIN,
  PQC_ALGORITHM_VERSION,
  PQC_ENVELOPE_UNSIGNED,
  PQC_VERSION,
  createPqcSignatureEnvelope,
  verifyEnvelope,
  verifyPqcSignatureEnvelope,
  entrySignPayload,
  generateKeypair,
  buildSignMessage,
  canonicalJson,
} = await import("../scripts/lib/pqc-signature.mjs");

const {
  validateEnvelopeKeyReference,
  validateEnvelopeMetadata,
  loadRegistryPublicKey,
  validateRegistryKeyLifecycle,
  validateRegistryRecord,
  validateKeyRotationEvidence,
  validateKeyRotationChain,
} = await import("../scripts/lib/public-key-registry.mjs");

const {
  createManifest,
  verifyManifest,
  signEntry,
  signManifest,
  verifyEntryPqc,
  verifyManifestIntegrity,
} = await import("../scripts/lib/artifact-provenance.mjs");

const { resolveArtifacts } = await import("../scripts/lib/resolve-artifacts.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const { publicKey, secretKey, publicKeyHex } = generateKeypair();

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

// T-PQC-01: valid signature accept
const envelope = createPqcSignatureEnvelope(payload, { privateKey: secretKey, publicKeyHex });
ok(envelope.status === "signed", "T-PQC-01 envelope status signed");
ok(envelope.algorithmVersion === PQC_ALGORITHM_VERSION, "T-PQC-01 algorithmVersion ML-DSA-87");
ok(envelope.publicKey === publicKeyHex, "T-PQC-01 publicKey embedded");
const v01 = verifyEnvelope(payload, envelope);
ok(v01.ok, "T-PQC-01 valid signature accept");

// Domain separation
const msg = buildSignMessage(payload);
ok(new TextDecoder().decode(msg).startsWith(PROVENANCE_DOMAIN), "domain separator present");
ok(canonicalJson(payload).includes('"artifact"'), "canonical payload used");

// T-PQC-02: modified manifest reject
const tamperedPayload = { ...payload, sha256: "0".repeat(64) };
const v02 = verifyEnvelope(tamperedPayload, envelope);
ok(!v02.ok, "T-PQC-02 modified payload reject");

const paths = resolveArtifacts();
function createSigningFixtureManifest() {
  const fixtureManifest = createManifest(paths, { sign: false });
  const zkeyIndex = fixtureManifest.entries.findIndex(
    (entry) => entry.artifact === "production.zkey"
  );
  assert.notEqual(zkeyIndex, -1, "production.zkey fixture entry exists");
  fixtureManifest.entries[zkeyIndex] = {
    ...sampleEntry,
    classicalHash: { algorithm: "SHA-256", digest: sampleEntry.sha256 },
    pqcSignatureEnvelope: { ...PQC_ENVELOPE_UNSIGNED },
  };
  fixtureManifest.resolvedHashes.zkeyHash = sampleEntry.sha256;
  return fixtureManifest;
}

const manifest = createSigningFixtureManifest();
const signedEntry = signEntry(sampleEntry, { secretKey, publicKeyHex });
const manifestZkeyIndex = manifest.entries.findIndex((entry) => entry.artifact === "production.zkey");
manifest.entries[manifestZkeyIndex] = signedEntry;

const vEntry = verifyEntryPqc(signedEntry);
ok(vEntry.ok, "verifyEntryPqc accepts signed entry");

const tamperedManifest = JSON.parse(JSON.stringify(manifest));
tamperedManifest.entries[0].sha256 = "f".repeat(64);
const badHash = verifyManifest(tamperedManifest, { allowMissingOptional: true });
ok(!badHash.ok, "T-PQC-02 tampered manifest hash reject");

// T-PQC-03: wrong public key reject
const { publicKey: wrongPk, publicKeyHex: wrongHex } = generateKeypair();
const wrongEnvelope = { ...envelope, publicKey: wrongHex };
const v03 = verifyEnvelope(payload, wrongEnvelope, wrongPk);
ok(!v03.ok, "T-PQC-03 wrong public key reject");

// T-PQC-04: missing signature reject (--pqc)
const unsignedManifest = createManifest(paths, { sign: false });
const reqPqc = verifyManifest(unsignedManifest, {
  allowMissingOptional: true,
  pqcRequired: true,
});
ok(!reqPqc.ok, "T-PQC-04 missing signature reject with --pqc");
ok(
  reqPqc.errors.some((e) => e.includes("PQC signature required")),
  "T-PQC-04 error mentions required signature"
);

// T-PQC-05: algorithm version mismatch reject
const badVersion = { ...envelope, version: "v99" };
const v05 = verifyEnvelope(payload, badVersion);
ok(!v05.ok && /version (mismatch|invalid)/.test(v05.error ?? ""), "T-PQC-05 version mismatch reject");

const badAlgo = { ...envelope, algorithmVersion: "ML-DSA-44" };
const v05b = verifyEnvelope(payload, badAlgo);
ok(!v05b.ok && v05b.error.includes("algorithm mismatch"), "T-PQC-05 algorithm mismatch reject");

// T-PQC-06: unknown publicKeyId reject
const unknownKeyEnvelope = {
  ...envelope,
  publicKey: null,
  publicKeyId: "does-not-exist-in-registry",
};
const keyRef06 = validateEnvelopeKeyReference(unknownKeyEnvelope);
ok(!keyRef06.ok && keyRef06.error.includes("unknown publicKeyId"), "T-PQC-06 unknown publicKeyId reject");
const v06 = verifyEnvelope(payload, unknownKeyEnvelope);
ok(!v06.ok, "T-PQC-06 verifyEnvelope rejects unknown publicKeyId");

// T-PQC-07: wrong algorithmVersion reject (manifest-level)
const badAlgoManifest = signManifest(createSigningFixtureManifest(), { secretKey, publicKeyHex });
const badAlgoZkey = badAlgoManifest.entries.find((entry) => entry.artifact === "production.zkey");
badAlgoZkey.pqcSignatureEnvelope.algorithmVersion = "ML-DSA-44";
const v07 = verifyManifest(badAlgoManifest, { allowMissingOptional: true });
ok(!v07.ok && v07.errors.some((e) => e.includes("algorithm mismatch")), "T-PQC-07 wrong algorithmVersion reject");

// T-PQC-08: signature replay reject
const entryA = signEntry(sampleEntry, { secretKey, publicKeyHex });
const entryB = {
  ...sampleEntry,
  artifact: "production-vkey.json",
  path: "crypto-artifacts/phase4/production-vkey.json",
  sha256: "e0732a88f51791d9856245adff6dfbc1442da58cf6d4d1d7c3feb62c55355814",
  size: 9078,
};
const replayed = {
  ...entryB,
  pqcSignatureEnvelope: { ...entryA.pqcSignatureEnvelope },
};
const v08 = verifyEntryPqc(replayed);
ok(!v08.ok, "T-PQC-08 signature replay reject");

// T-PQC-09: canonical payload mutation reject (path changed, hash unchanged)
const pathMutated = JSON.parse(JSON.stringify(signedEntry));
pathMutated.path = "crypto-artifacts/phase4/TAMPERED.zkey";
const v09 = verifyEntryPqc(pathMutated);
ok(!v09.ok, "T-PQC-09 canonical payload mutation reject");

// T-PQC-10: expired/invalid metadata reject
const expiredEnvelope = {
  ...envelope,
  signedAt: new Date(Date.now() - 86400000 * 400).toISOString(),
};
const meta10 = validateEnvelopeMetadata(expiredEnvelope, { maxAgeMs: 86400000 });
ok(!meta10.ok && meta10.error.includes("expired"), "T-PQC-10 expired metadata reject");

const invalidDate = { ...envelope, signedAt: "not-a-date" };
const meta10b = validateEnvelopeMetadata(invalidDate);
ok(!meta10b.ok && meta10b.error.includes("invalid"), "T-PQC-10 invalid signedAt reject");

// T-PQC-11: registry lifecycle policy
const lifecycleBase = {
  keyId: "fixture-key",
  algorithm: PQC_ALGORITHM_VERSION,
  version: PQC_VERSION,
  publicKey: publicKeyHex,
  status: "active",
  notBefore: new Date(Date.now() - 60_000).toISOString(),
  notAfter: new Date(Date.now() + 60_000).toISOString(),
  immutable: true,
};
const activeLifecycle = validateRegistryKeyLifecycle(lifecycleBase, { requireActive: true });
ok(activeLifecycle.ok, "T-PQC-11 active key lifecycle accepted");

const revokedLifecycle = validateRegistryKeyLifecycle(
  { ...lifecycleBase, status: "revoked", revokedAt: new Date(Date.now() - 1_000).toISOString() },
  { requireActive: true }
);
ok(!revokedLifecycle.ok && revokedLifecycle.errors.some((e) => e.includes("revoked")), "T-PQC-11 revoked key rejected");

const expiredLifecycle = validateRegistryKeyLifecycle(
  { ...lifecycleBase, notAfter: new Date(Date.now() - 1_000).toISOString() },
  { requireActive: true }
);
ok(!expiredLifecycle.ok && expiredLifecycle.errors.some((e) => e.includes("expired")), "T-PQC-11 expired key rejected");

const futureLifecycle = validateRegistryKeyLifecycle(
  { ...lifecycleBase, notBefore: new Date(Date.now() + 60_000).toISOString() },
  { requireActive: true }
);
ok(!futureLifecycle.ok && futureLifecycle.errors.some((e) => e.includes("not active")), "T-PQC-11 not-yet-active key rejected");

const deprecatedLifecycle = validateRegistryKeyLifecycle(
  { ...lifecycleBase, status: "deprecated" },
  { requireActive: true }
);
ok(!deprecatedLifecycle.ok && deprecatedLifecycle.errors.some((e) => e.includes("deprecated")), "T-PQC-11 deprecated key rejected in strict mode");

const purposeMismatch = validateRegistryKeyLifecycle(
  { ...lifecycleBase, purposes: ["artifact-provenance"] },
  { purpose: "operator-auth" }
);
ok(!purposeMismatch.ok && purposeMismatch.errors.some((e) => e.includes("purpose mismatch")), "T-PQC-11 key purpose mismatch rejected");

const malformedLifecycle = validateRegistryRecord(
  { ...lifecycleBase, status: "not-a-status" },
  "fixture-key"
);
ok(!malformedLifecycle.ok && malformedLifecycle.errors.some((e) => e.includes("invalid registry key status")), "T-PQC-11 invalid registry status rejected");

// T-PQC-12: auditable key rotation evidence
const rotationEffectiveAt = new Date(Date.now() + 5_000).toISOString();
const predecessor = {
  ...lifecycleBase,
  keyId: "fixture-predecessor",
  status: "deprecated",
  notBefore: new Date(Date.now() - 120_000).toISOString(),
};
const successor = {
  ...lifecycleBase,
  keyId: "fixture-successor",
  status: "active",
  notBefore: new Date(Date.now() - 1_000).toISOString(),
};
const rotationRegistry = new Map([
  [predecessor.keyId, predecessor],
  [successor.keyId, successor],
]);
const validRotation = validateKeyRotationEvidence(
  {
    rotationId: "rotate-001",
    version: "v1",
    predecessorKeyId: predecessor.keyId,
    successorKeyId: successor.keyId,
    effectiveAt: rotationEffectiveAt,
    reason: "scheduled lifecycle rotation",
    recordedAt: new Date().toISOString(),
  },
  rotationRegistry
);
ok(validRotation.ok, "T-PQC-12 valid rotation evidence accepted");

const selfRotation = validateKeyRotationEvidence(
  {
    rotationId: "rotate-self",
    predecessorKeyId: predecessor.keyId,
    successorKeyId: predecessor.keyId,
    effectiveAt: rotationEffectiveAt,
    reason: "invalid self rotation",
  },
  rotationRegistry
);
ok(!selfRotation.ok && selfRotation.errors.some((e) => e.includes("must differ")), "T-PQC-12 self rotation rejected");

const revokedTooEarly = validateKeyRotationEvidence(
  {
    rotationId: "rotate-early-revoke",
    predecessorKeyId: predecessor.keyId,
    successorKeyId: successor.keyId,
    effectiveAt: rotationEffectiveAt,
    reason: "scheduled lifecycle rotation",
  },
  new Map([
    [predecessor.keyId, { ...predecessor, revokedAt: new Date(Date.now() - 1_000).toISOString() }],
    [successor.keyId, successor],
  ])
);
ok(!revokedTooEarly.ok && revokedTooEarly.errors.some((e) => e.includes("revoked before")), "T-PQC-12 predecessor early revocation rejected");

const successorNotReady = validateKeyRotationEvidence(
  {
    rotationId: "rotate-not-ready",
    predecessorKeyId: predecessor.keyId,
    successorKeyId: successor.keyId,
    effectiveAt: new Date(Date.now() - 120_000).toISOString(),
    reason: "scheduled lifecycle rotation",
  },
  new Map([[predecessor.keyId, predecessor], [successor.keyId, { ...successor, notBefore: new Date(Date.now() + 60_000).toISOString() }]])
);
ok(!successorNotReady.ok && successorNotReady.errors.some((e) => e.includes("not active")), "T-PQC-12 successor not active at rotation rejected");

const missingReason = validateKeyRotationEvidence(
  {
    rotationId: "rotate-no-reason",
    predecessorKeyId: predecessor.keyId,
    successorKeyId: successor.keyId,
    effectiveAt: rotationEffectiveAt,
  },
  rotationRegistry
);
ok(!missingReason.ok && missingReason.errors.some((e) => e.includes("reason is required")), "T-PQC-12 missing rotation reason rejected");

const duplicateChain = validateKeyRotationChain(
  [
    { rotationId: "rotate-dup", predecessorKeyId: predecessor.keyId, successorKeyId: successor.keyId, effectiveAt: rotationEffectiveAt, reason: "scheduled" },
    { rotationId: "rotate-dup", predecessorKeyId: predecessor.keyId, successorKeyId: successor.keyId, effectiveAt: rotationEffectiveAt, reason: "scheduled" },
  ],
  rotationRegistry
);
ok(!duplicateChain.ok && duplicateChain.errors.some((e) => e.includes("duplicate rotation")), "T-PQC-12 duplicate rotation evidence rejected");

const chainOutOfOrder = validateKeyRotationChain(
  [
    { rotationId: "rotate-chain-1", predecessorKeyId: predecessor.keyId, successorKeyId: successor.keyId, effectiveAt: new Date(Date.now() + 60_000).toISOString(), reason: "scheduled" },
    { rotationId: "rotate-chain-2", predecessorKeyId: successor.keyId, successorKeyId: "fixture-third", effectiveAt: new Date(Date.now() + 10_000).toISOString(), reason: "scheduled" },
  ],
  new Map([
    ...rotationRegistry,
    ["fixture-third", { ...successor, keyId: "fixture-third" }],
  ])
);
ok(!chainOutOfOrder.ok && chainOutOfOrder.errors.some((e) => e.includes("monotonic")), "T-PQC-12 non-monotonic rotation chain rejected");

// Registry + manifest integrity
const ciKey = loadRegistryPublicKey("aegis-ci-mldsa87-v1");
ok(ciKey?.keyId === "aegis-ci-mldsa87-v1", "CI registry key loadable");
ok(ciKey?.algorithm === PQC_ALGORITHM_VERSION, "CI registry algorithm fixed");

const integrity = verifyManifestIntegrity(unsignedManifest);
ok(integrity.ok, "manifest integrity check PASS");

// verifyPqcSignatureEnvelope manifest-level API
const signedManifest = signManifest(createSigningFixtureManifest(), { secretKey, publicKeyHex });
const pqcManifest = verifyPqcSignatureEnvelope(signedManifest, { required: true });
ok(pqcManifest.valid, "verifyPqcSignatureEnvelope valid signed manifest");

ok(pqcManifest.algorithm === PQC_ALGORITHM_VERSION, "verifyPqcSignatureEnvelope returns algorithm");

const signedCore = signedManifest.entries.filter((e) =>
  ["production.zkey", "production-vkey.json", "aegis_commit_core_v2.wasm", "aegis_commit_core_v2.r1cs"].includes(
    e.artifact
  )
);
ok(
  signedCore.every((e) => !e.present || e.pqcSignatureEnvelope?.status === "signed"),
  "signManifest signs present core entries"
);

console.log(`\nPQC SIGNATURE: ${passed} checks PASS`);
