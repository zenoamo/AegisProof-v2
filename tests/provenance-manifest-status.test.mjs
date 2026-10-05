// Manifest signature status is independent of PQC key-rotation evidence.
// Ephemeral ML-DSA keys stay in memory and are not written to the repository.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { generateKeypair } = await import("../scripts/lib/pqc-signature.mjs");
const { signEntry, loadManifest, DEFAULT_MANIFEST_PATH } = await import("../scripts/lib/artifact-provenance.mjs");
const {
  classifyManifestSignatures,
  classifyRotationEvidence,
  separateProvenanceResults,
  EXIT_PROVENANCE_NOT_VERIFIED,
} = await import("../scripts/lib/provenance-verification-status.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const keyId = "ephemeral-manifest-test";
const signer = generateKeypair();
const other = generateKeypair();
const resolvePublicKey = (id) => (id === keyId ? { keyId, publicKey: signer.publicKeyHex } : null);

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

function signedEntry(artifact, sha = "ab".repeat(32), material = signer) {
  return signEntry(unsignedEntry(artifact, sha), {
    secretKey: material.secretKey,
    publicKeyHex: material.publicKeyHex,
    publicKeyId: keyId,
  });
}

const signedManifest = { entries: [signedEntry("fixture-artifact")] };
const valid = classifyManifestSignatures(signedManifest, { resolvePublicKey });
ok(valid.status === "VERIFIED", "Test 1: valid signature is VERIFIED");
ok(valid.provenanceVerified === true, "Test 1: verification PASS");
ok(valid.signerBinding === "checked", "Test 1: signer key id binds the public key");

const committed = loadManifest(DEFAULT_MANIFEST_PATH);
const unsigned = classifyManifestSignatures(committed);
ok(unsigned.status === "NOT_VERIFIED", "Test 2: unsigned committed manifest is NOT VERIFIED");
ok(unsigned.provenanceVerified === false, "Test 2: unsigned is not verification PASS");
ok(unsigned.unsigned.length > 0, "Test 2: unsigned entries stay visible");
ok(!unsigned.unsigned.includes(undefined), "Test 2: unsigned entry names are reported");

const tampered = structuredClone(signedManifest);
tampered.entries[0].sha256 = "cd".repeat(32);
tampered.entries[0].classicalHash = { algorithm: "SHA-256", digest: tampered.entries[0].sha256 };
const tamperedStatus = classifyManifestSignatures(tampered, { resolvePublicKey });
ok(tamperedStatus.status === "FAIL", "Test 3: tampered manifest is signature FAIL");
ok(tamperedStatus.provenanceVerified === false, "Test 3: tamper is not VERIFIED");
ok(/invalid signature/.test(tamperedStatus.reason), "Test 3: reason is invalid signature");

const wrongKey = classifyManifestSignatures(signedManifest, {
  resolvePublicKey,
  publicKeyOverride: other.publicKeyHex,
});
ok(wrongKey.status === "FAIL", "Test 4: wrong public key is FAIL");
ok(wrongKey.provenanceVerified === false, "Test 4: wrong key is not VERIFIED");

const unbound = structuredClone(signedManifest);
unbound.entries[0].pqcSignatureEnvelope.publicKeyId = null;
const unboundStatus = classifyManifestSignatures(unbound, { resolvePublicKey });
ok(unboundStatus.status === "NOT_VERIFIED", "signer binding unavailable is not VERIFIED");
ok(unboundStatus.signerBinding === "unavailable", "signer binding unavailable is explicit");

const predecessor = {
  keyId: "fixture-predecessor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: signer.publicKeyHex,
  status: "deprecated",
  notBefore: new Date(Date.now() - 120_000).toISOString(),
};
const successor = {
  keyId: "fixture-successor",
  algorithm: "ML-DSA-87",
  version: "v1",
  publicKey: other.publicKeyHex,
  status: "active",
  notBefore: new Date(Date.now() - 1_000).toISOString(),
};
const rotation = classifyRotationEvidence(
  [
    {
      rotationId: "rotate-001",
      version: "v1",
      predecessorKeyId: predecessor.keyId,
      successorKeyId: successor.keyId,
      effectiveAt: new Date(Date.now() + 5_000).toISOString(),
      reason: "scheduled lifecycle rotation",
      recordedAt: new Date().toISOString(),
    },
  ],
  new Map([
    [predecessor.keyId, predecessor],
    [successor.keyId, successor],
  ])
);
const separated = separateProvenanceResults(rotation, unsigned);
ok(rotation.status === "PASS", "Test 5: rotation evidence PASS");
ok(separated.manifestSignature === "NOT_VERIFIED", "Test 5: unsigned manifest stays NOT VERIFIED");
ok(separated.provenanceVerified === false, "Test 5: rotation PASS is not manifest verification PASS");
ok(separated.rotationCountsAsManifestVerified === false, "Test 5: rotation evidence does not verify the manifest");

const verifierDown = classifyManifestSignatures(signedManifest, { verifierAvailable: false, resolvePublicKey });
ok(verifierDown.status === "NOT_RUN", "PQC verifier unavailable is NOT RUN");
ok(verifierDown.provenanceVerified === false, "unavailable verifier is not VERIFIED");

const absentRotation = classifyRotationEvidence(committed.rotationEvidence);
ok(absentRotation.status === "NOT_RUN", "committed manifest has no rotation evidence");
ok(absentRotation.countsAsManifestVerified === false, "absent rotation evidence is not manifest verification");

const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/aegis_repro_ci.yml"), "utf8");
ok(
  workflow.includes("npm run verify:provenance -- --live --pqc --allow-missing-production-zkey"),
  "Test 6: PR provenance path passes --pqc"
);
ok(
  workflow.includes("npm run verify:provenance -- --live --pqc\n"),
  "Test 6: production-like live provenance passes --pqc"
);
const release = fs.readFileSync(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
ok(release.includes("verify:provenance -- --manifest artifacts/provenance/manifest.json --pqc"), "Test 6: release verification uses --pqc");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-provenance-"));
const tmpManifest = path.join(tmpDir, "manifest.json");
fs.copyFileSync(DEFAULT_MANIFEST_PATH, tmpManifest);
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
const cliOut = `${cli.stdout ?? ""}\n${cli.stderr ?? ""}`;
ok(cli.status === EXIT_PROVENANCE_NOT_VERIFIED, "Test 6: --pqc on unsigned manifest exits NOT VERIFIED");
ok(cliOut.includes("Mode: strict (--pqc / --require-pqc)"), "Test 6: --pqc enables ML-DSA verification");
ok(cliOut.includes("Provenance manifest signature: NOT VERIFIED"), "Test 6: signature line is NOT VERIFIED");
ok(cliOut.includes("PROVENANCE NOT VERIFIED"), "Test 6: outcome is PROVENANCE NOT VERIFIED");
ok(!cliOut.includes("PROVENANCE VERIFIED"), "Test 6: unsigned --pqc path does not say VERIFIED");
ok(cliOut.includes("PQC key rotation evidence: NOT RUN"), "Test 6: missing rotation evidence is not PASS");
fs.rmSync(tmpDir, { recursive: true, force: true });

const classical = spawnSync(
  process.execPath,
  [
    "scripts/verify-provenance-manifest.mjs",
    "--live",
    "--allow-missing-production-zkey",
    "--manifest",
    path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aegis-provenance-classical-")), "manifest.json"),
  ],
  { cwd: ROOT, encoding: "utf8" }
);
const classicalOut = `${classical.stdout ?? ""}\n${classical.stderr ?? ""}`;
ok(classical.status === 0, "non-pqc live verification still exits 0");
ok(classicalOut.includes("Provenance manifest signature: NOT VERIFIED"), "non-pqc path still reports NOT VERIFIED");
ok(!classicalOut.includes("PROVENANCE VERIFIED"), "non-pqc path does not claim PROVENANCE VERIFIED");

console.log(`\nPROVENANCE MANIFEST STATUS: ${passed} checks PASS`);
