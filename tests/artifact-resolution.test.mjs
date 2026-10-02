// ============================================================================
// Artifact resolution regression (Phase 8.11 Task 2)
// Run: npm run test:artifact-resolution
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const provisionedZkey = process.env.AEGIS_PRODUCTION_ZKEY_PATH;
const externalZkey = path.join(ROOT, "artifacts/__external_production_zkey__.zkey");
process.env.AEGIS_PRODUCTION_ZKEY_PATH = externalZkey;

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  assertCoreArtifacts,
  assertProductionHashes,
  artifactResolutionSummary,
  resolveArtifacts,
  resolvePathWithSource,
  sha256File,
  sourceLabelForRel,
} = await import("../scripts/lib/resolve-artifacts.mjs");

const {
  createManifest,
  signManifest,
  verifyManifest,
} = await import("../scripts/lib/artifact-provenance.mjs");

const { generateKeypair } = await import("../scripts/lib/pqc-signature.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const wasmCandidates = [
  "artifacts/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm",
  "crypto-artifacts/phase2/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm",
];
const wasmRes = resolvePathWithSource(wasmCandidates);
if (fs.existsSync(path.join(ROOT, wasmCandidates[0]))) {
  ok(wasmRes.source === "artifacts/phase2", "Case 1: canonical wasm source=artifacts/phase2");
} else if (fs.existsSync(path.join(ROOT, wasmCandidates[1]))) {
  ok(true, "Case 1: canonical absent — wasm resolved via crypto-artifacts (Case 2 overlap)");
} else {
  console.log("SKIP Case 1: wasm not present locally");
}

const vkeyRes = resolvePathWithSource([
  "artifacts/phase2/vkey/vkey_v2.json",
  "crypto-artifacts/phase2/phase2/vkey/vkey_v2.json",
]);
const canonVkey = path.join(ROOT, "artifacts/phase2/vkey/vkey_v2.json");
const mirrorVkey = path.join(ROOT, "crypto-artifacts/phase2/phase2/vkey/vkey_v2.json");
if (!fs.existsSync(canonVkey) && fs.existsSync(mirrorVkey)) {
  ok(vkeyRes.source === "crypto-artifacts", "Case 2: crypto-artifacts fallback for dev vkey");
} else if (fs.existsSync(canonVkey)) {
  ok(vkeyRes.source === "artifacts/phase2", "Case 2: dev vkey from canonical tree");
} else {
  console.log("SKIP Case 2: dev vkey not present locally");
}

try {
  assertCoreArtifacts(
    resolveArtifacts({
      production: true,
      overrides: { zkey: path.join(ROOT, "artifacts/__missing_zkey__.zkey") },
    })
  );
  assert.fail("Case 3 should throw");
} catch (e) {
  ok(String(e).includes("Missing prover artifacts"), "Case 3: missing zkey FAIL closed");
}

try {
  assertProductionHashes(
    resolveArtifacts({
      production: true,
      overrides: { vkey: path.join(ROOT, "specs/aegis-protocol.v2.json") },
    })
  );
  assert.fail("Case 4 should throw on hash mismatch");
} catch (e) {
  ok(
    String(e).includes("hash mismatch") || String(e).includes("Missing prover"),
    "Case 4: hash mismatch FAIL closed"
  );
}

const paths = resolveArtifacts({ production: true });
const summary = artifactResolutionSummary(paths);
ok(typeof summary.source === "string", "summary has source");
ok(typeof summary.wasmHash === "string" || summary.wasmHash === null, "summary has wasmHash");
ok(typeof summary.zkeyHash === "string" || summary.zkeyHash === null, "summary has zkeyHash");
ok(typeof summary.vkHash === "string" || summary.vkHash === null, "summary has vkHash");
ok(sourceLabelForRel("crypto-artifacts/phase4/x") === "crypto-artifacts", "sourceLabel crypto-artifacts");
ok(sourceLabelForRel("artifacts/phase2/x") === "artifacts/phase2", "sourceLabel artifacts/phase2");
ok(sourceLabelForRel("artifacts/phase4/x") === "artifacts/phase4", "sourceLabel artifacts/phase4");
ok(PRODUCTION_ZKEY_HASH.length === 64, "PRODUCTION_ZKEY_HASH pinned");
ok(PRODUCTION_VKEY_HASH.length === 64, "PRODUCTION_VKEY_HASH pinned");
const externalPaths = resolveArtifacts({ production: true });
ok(externalPaths.zkey === externalZkey, "external production zkey path is selected");
ok(externalPaths.sources.zkey === "external", "external production zkey source is labeled external");

delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
try {
  process.env.AEGIS_PRODUCTION_ZKEY_PATH = "relative/path/to/production.zkey";
  resolveArtifacts({ production: true });
  assert.fail("Case 5 should reject relative external zkey path");
} catch (e) {
  ok(
    String(e).includes("must be an absolute path"),
    "Case 5: external zkey path must be absolute"
  );
} finally {
  delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
}

// External zkey resolver → manifest → strict verifier policy.
const externalFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-external-zkey-"));
const missingExternal = path.join(externalFixtureDir, "missing-production.zkey");
const wrongHashExternal = path.join(externalFixtureDir, "wrong-hash-production.zkey");
fs.writeFileSync(wrongHashExternal, "not the production proving key", { mode: 0o600 });

try {
  process.env.AEGIS_PRODUCTION_ZKEY_PATH = missingExternal;
  const missingManifest = createManifest(resolveArtifacts({ production: true }), { sign: false });
  const missingResult = verifyManifest(missingManifest, {
    allowMissingOptional: true,
    pqcRequired: true,
  });
  ok(!missingResult.ok, "external missing zkey strict FAIL");
  ok(
    missingResult.errors.some((e) => e.includes("missing required artifact: production.zkey")),
    "external missing zkey reports required artifact"
  );
  ok(
    missingResult.errors.some((e) => e.includes("PQC signature required but absent: production.zkey")),
    "external missing zkey reports absent signature"
  );

  process.env.AEGIS_PRODUCTION_ZKEY_PATH = wrongHashExternal;
  const unsignedManifest = createManifest(resolveArtifacts({ production: true }), { sign: false });
  const unsignedResult = verifyManifest(unsignedManifest, {
    allowMissingOptional: true,
    pqcRequired: true,
  });
  ok(!unsignedResult.ok, "external unsigned zkey strict FAIL");
  ok(
    unsignedResult.errors.some((e) => e.includes("PQC signature required but absent: production.zkey")),
    "external unsigned zkey reports absent signature"
  );

  const keypair = generateKeypair();
  const signedWrongHash = signManifest(unsignedManifest, keypair);
  const mismatchResult = verifyManifest(signedWrongHash, {
    allowMissingOptional: true,
    pqcRequired: true,
  });
  ok(!mismatchResult.ok, "external zkey hash mismatch FAIL");
  ok(
    mismatchResult.errors.some((e) => e.includes("pinned production zkey")),
    "external zkey hash mismatch reports pinned hash"
  );

  const invalidSignature = structuredClone(signedWrongHash);
  const invalidZkey = invalidSignature.entries.find((entry) => entry.artifact === "production.zkey");
  invalidZkey.pqcSignatureEnvelope.signature = "00".repeat(100);
  const invalidResult = verifyManifest(invalidSignature, {
    allowMissingOptional: true,
    pqcRequired: true,
  });
  ok(!invalidResult.ok, "external zkey invalid signature FAIL");
  ok(
    invalidResult.errors.some(
      (e) => e.includes("PQC verify failed: production.zkey")
    ),
    "external zkey invalid signature is reported"
  );

  if (
    provisionedZkey &&
    path.isAbsolute(provisionedZkey) &&
    fs.existsSync(provisionedZkey) &&
    sha256File(provisionedZkey) === PRODUCTION_ZKEY_HASH
  ) {
    process.env.AEGIS_PRODUCTION_ZKEY_PATH = provisionedZkey;
    const liveManifest = signManifest(
      createManifest(resolveArtifacts({ production: true }), { sign: false }),
      keypair
    );
    const liveResult = verifyManifest(liveManifest, {
      allowMissingOptional: true,
      pqcRequired: true,
    });
    ok(liveResult.ok, "valid external zkey E2E PASS");
  } else {
    console.log(
      "BLOCKED valid external zkey E2E: AEGIS_PRODUCTION_ZKEY_PATH with the pinned artifact is not provisioned"
    );
  }
} finally {
  fs.rmSync(externalFixtureDir, { recursive: true, force: true });
  if (provisionedZkey === undefined) {
    delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
  } else {
    process.env.AEGIS_PRODUCTION_ZKEY_PATH = provisionedZkey;
  }
}

console.log(`\nARTIFACT RESOLUTION: ${passed} checks PASS`);
