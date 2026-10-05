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
