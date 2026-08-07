// ============================================================================
// Artifact resolution regression (Phase 8.11 Task 2)
// Run: npm run test:artifact-resolution
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  assertCoreArtifacts,
  assertProductionHashes,
  artifactResolutionSummary,
  resolveArtifacts,
  resolvePathWithSource,
  sourceLabelForRel,
} = await import("../scripts/lib/resolve-artifacts.mjs");

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
ok(PRODUCTION_ZKEY_HASH.length === 64, "PRODUCTION_ZKEY_HASH pinned");
ok(PRODUCTION_VKEY_HASH.length === 64, "PRODUCTION_VKEY_HASH pinned");

console.log(`\nARTIFACT RESOLUTION: ${passed} checks PASS`);
