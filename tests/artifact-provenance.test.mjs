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
  generateKeypair,
  createPqcSignatureEnvelope,
  verifyPqcSignatureEnvelope,
  entrySignPayload,
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

// --- PQC signature generation + verification ---
const { secretKey, publicKeyHex } = generateKeypair();
const signedManifest = signManifest(createManifest(paths, { sign: false }), { secretKey, publicKeyHex });
const signedZkey = signedManifest.entries.find((e) => e.artifact === "production.zkey");
ok(signedZkey?.pqcSignatureEnvelope?.status === "signed", "manifest signature generation");
ok(signedZkey?.pqcSignatureEnvelope?.publicKey === publicKeyHex, "publicKey embedded in envelope");

const pqcVerify = verifyPqcSignatureEnvelope(signedManifest, { required: true });
ok(pqcVerify.valid, "manifest signature verification");

// invalid PQC signature reject
const badSigManifest = JSON.parse(JSON.stringify(signedManifest));
badSigManifest.entries[0].pqcSignatureEnvelope.signature = "00".repeat(100);
const badSig = verifyManifest(badSigManifest, { allowMissingOptional: true });
ok(!badSig.ok, "invalid PQC signature reject");

// missing signature behavior (--pqc strict)
const missingPqc = verifyManifest(createManifest(paths, { sign: false }), {
  allowMissingOptional: true,
  pqcRequired: true,
});
ok(!missingPqc.ok, "missing signature fails in --pqc mode");

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
