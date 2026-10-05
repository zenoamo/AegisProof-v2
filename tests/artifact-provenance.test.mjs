// ============================================================================
// Artifact provenance tests (Phase 8.13 Task 4)
// Run: npm run test:artifact-provenance
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  resolveArtifacts,
} = await import("../scripts/lib/resolve-artifacts.mjs");

const {
  createManifest,
  verifyManifest,
  verifyLiveArtifacts,
  signManifest,
  PROVENANCE_SCHEMA_VERSION,
  PROVENANCE_PHASE,
} = await import("../scripts/lib/artifact-provenance.mjs");

const {
  PQC_ALGORITHM_VERSION,
  PQC_ENVELOPE_UNSIGNED,
  generateKeypair,
  verifyPqcSignatureEnvelope,
} = await import("../scripts/lib/pqc-signature.mjs");

const {
  createHybridEnvelope,
  verifyHybridEnvelope,
  hashPayload,
  createDeploymentAuthPayload,
} = await import("../scripts/lib/hybrid-auth-envelope.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

// --- Provenance manifest schema ---
const paths = resolveArtifacts();
const manifest = createManifest(paths);

ok(manifest.schemaVersion === PROVENANCE_SCHEMA_VERSION, "manifest schemaVersion=1");
ok(manifest.phase === PROVENANCE_PHASE, "manifest phase=8.13");
ok(Array.isArray(manifest.entries) && manifest.entries.length >= 4, "manifest has core entries");
ok(manifest.pinnedProductionHashes.zkeyHash === PRODUCTION_ZKEY_HASH, "manifest pins zkey hash");
ok(manifest.pinnedProductionHashes.vkHash === PRODUCTION_VKEY_HASH, "manifest pins vk hash");

const zkeyEntry = manifest.entries.find((e) => e.artifact === "production.zkey");
ok(zkeyEntry?.classicalHash?.algorithm === "SHA-256", "classical hash algorithm SHA-256");
ok(
  ["unsigned", "signed"].includes(zkeyEntry?.pqcSignatureEnvelope?.status),
  "PQC envelope unsigned or signed"
);
ok(zkeyEntry?.pqcSignatureEnvelope?.algorithmVersion === PQC_ALGORITHM_VERSION, "PQC algorithmVersion ML-DSA-87");

if (zkeyEntry?.present) {
  ok(zkeyEntry.sha256 === PRODUCTION_ZKEY_HASH, "live zkey matches pinned hash");
}

// --- verifyManifest fail-closed (SHA-256) ---
const tampered = JSON.parse(JSON.stringify(manifest));
if (tampered.entries[0]) tampered.entries[0].sha256 = "0".repeat(64);
const bad = verifyManifest(tampered, { allowMissingOptional: true });
ok(!bad.ok, "tampered manifest fails verify");

// Manifest path boundary: entries must not escape the repository root.
const pathTraversal = JSON.parse(JSON.stringify(manifest));
const traversalEntry = pathTraversal.entries.find((e) => e.artifact === "production.zkey");
if (traversalEntry) {
  traversalEntry.path = "../../package.json";
}
const traversalResult = verifyManifest(pathTraversal, { allowMissingOptional: true });
ok(!traversalResult.ok, "manifest path traversal is rejected");



// --- PQC signature generation + verification ---
// Signing is a cryptographic unit test, not an assertion about whether the
// externally stored production.zkey is mounted in this checkout.
const { secretKey, publicKeyHex } = generateKeypair();
const signingFixture = createManifest(paths, { sign: false });
const signingFixtureIndex = signingFixture.entries.findIndex(
  (e) => e.artifact === "production.zkey"
);
assert.notEqual(signingFixtureIndex, -1, "production.zkey fixture entry exists");
signingFixture.entries[signingFixtureIndex] = {
  artifact: "production.zkey",
  path: "fixtures/external/production.zkey",
  sha256: PRODUCTION_ZKEY_HASH,
  size: 32,
  createdAt: "2026-01-01T00:00:00.000Z",
  source: "test-fixture",
  version: "v2",
  present: true,
  classicalHash: { algorithm: "SHA-256", digest: PRODUCTION_ZKEY_HASH },
  pqcSignatureEnvelope: { ...PQC_ENVELOPE_UNSIGNED },
};
signingFixture.resolvedHashes.zkeyHash = PRODUCTION_ZKEY_HASH;

const signedManifest = signManifest(signingFixture, { secretKey, publicKeyHex });
const signedZkey = signedManifest.entries.find((e) => e.artifact === "production.zkey");
ok(signedZkey?.pqcSignatureEnvelope?.status === "signed", "manifest signature generation");
ok(signedZkey?.pqcSignatureEnvelope?.publicKey === publicKeyHex, "publicKey embedded in envelope");

const pqcVerify = verifyPqcSignatureEnvelope(signedManifest, { required: true });
ok(pqcVerify.valid, "manifest signature verification");

// invalid PQC signature reject
const badSigManifest = JSON.parse(JSON.stringify(signedManifest));
const badSigZkey = badSigManifest.entries.find((e) => e.artifact === "production.zkey");
badSigZkey.pqcSignatureEnvelope.signature = "00".repeat(100);
const badSig = verifyManifest(badSigManifest, { allowMissingOptional: true });
ok(!badSig.ok, "invalid PQC signature reject");

// Missing external artifact policy is separate from signing infrastructure.
const missingManifest = createManifest(paths, { sign: false });
const missingZkey = missingManifest.entries.find((e) => e.artifact === "production.zkey");
ok(missingZkey?.present === false, "missing production.zkey is present=false");
ok(missingZkey?.sha256 === null, "missing production.zkey has null sha256");
ok(missingZkey?.pqcSignatureEnvelope?.status === "unsigned", "missing production.zkey remains unsigned");

const missingPqc = verifyManifest(missingManifest, {
  allowMissingOptional: true,
  pqcRequired: true,
});
ok(!missingPqc.ok, "missing signature fails in --pqc mode");
ok(
  missingPqc.errors.some((e) => e.includes("missing required artifact: production.zkey")),
  "strict mode reports missing production.zkey"
);
ok(
  missingPqc.errors.some((e) => e.includes("PQC signature required but absent: production.zkey")),
  "strict mode reports absent production.zkey signature"
);

// --- live verify ---
const live = verifyLiveArtifacts({ includeOptional: true });
if (paths.zkey && fs.existsSync(paths.zkey)) {
  ok(live.ok, "verifyLiveArtifacts PASS when artifacts present");
  ok(typeof live.elapsedMs === "number", "provenance overhead measured");
  console.log(`  provenance overhead: ${live.elapsedMs}ms`);
} else {
  console.log("SKIP live verify: production artifacts absent locally");
}

// --- hybrid auth envelope (Task 6 research layer) ---
const payload = createDeploymentAuthPayload("0xoperator", "deploy-verifier", { chainId: 1 });
const envelope = createHybridEnvelope(payload, {
  classicalSignature: "deadbeef",
});
ok(envelope.domain === "AEGIS_AUTH_ENVELOPE_V1", "hybrid envelope domain");
ok(envelope.version === "v1", "hybrid envelope version");
ok(envelope.classicalSignature?.signature === "deadbeef", "hybrid classical sig preserved");
ok(envelope.pqcSignature === null || !envelope.pqcSignature?.signature, "PQC sig absent in research mode");
ok(hashPayload(payload).length === 64, "payload hash hex");

const hybridVerify = verifyHybridEnvelope(envelope);
ok(hybridVerify.ok, "hybrid envelope verify (no classical verifier callback)");
ok(hybridVerify.warnings.some((w) => w.includes("classical") || w.includes("PQC")), "hybrid warns on partial sigs");

console.log(`\nARTIFACT PROVENANCE: ${passed} checks PASS`);
