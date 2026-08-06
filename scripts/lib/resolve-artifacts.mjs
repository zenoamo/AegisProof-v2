// ============================================================================
// Canonical artifact resolver — single entry point (Phase 8.10 Phase 2)
// ----------------------------------------------------------------------------
// All prover/bench/test scripts MUST use resolveArtifacts() only.
// Mirrors crypto-artifacts/ when artifacts/ canonical paths are absent.
// ============================================================================
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");

export const PRODUCTION_ZKEY_HASH =
  "ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571";
export const PRODUCTION_VKEY_HASH =
  "d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec";
export const WASM_HASH_PREFIX = "a0d3c53f3cdce624";

const R = (p) => path.join(ROOT, p);

/** Ordered candidate paths; first existing file wins. */
const CANDIDATES = {
  wasm: [
    "artifacts/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm",
    "crypto-artifacts/phase2/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm",
  ],
  witCalc: [
    "artifacts/phase2/r1cs/aegis_commit_core_v2_js/witness_calculator.js",
    "crypto-artifacts/phase2/phase2/r1cs/aegis_commit_core_v2_js/witness_calculator.js",
  ],
  input: [
    "artifacts/phase2/tests/input_v2.json",
    "crypto-artifacts/phase2/phase2/tests/input_v2.json",
  ],
  zkey: [
    "artifacts/phase4/final/production.zkey",
    "crypto-artifacts/phase4/production.zkey",
  ],
  vkey: [
    "artifacts/phase4/final/production-vkey.json",
    "crypto-artifacts/phase4/production-vkey.json",
  ],
  baselineProof: [
    "artifacts/phase4/reports/production_proof_baseline.json",
  ],
};

function firstExisting(relPaths) {
  for (const rel of relPaths) {
    const abs = R(rel);
    if (fs.existsSync(abs)) return abs;
  }
  return R(relPaths[0]);
}

/**
 * Resolve all prover artifact paths.
 * @param {object} overrides - optional absolute-path overrides per key
 */
export function resolveArtifacts(overrides = {}) {
  const paths = {
    wasm: firstExisting(CANDIDATES.wasm),
    witCalc: firstExisting(CANDIDATES.witCalc),
    input: firstExisting(CANDIDATES.input),
    zkey: firstExisting(CANDIDATES.zkey),
    vkey: firstExisting(CANDIDATES.vkey),
    baselineProof: firstExisting(CANDIDATES.baselineProof),
    scratchDir: R("artifacts/phase4/reports/scratch"),
    cacheDir: R("artifacts/phase2/cache"),
    ...overrides,
  };
  return paths;
}

export function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

/** Ceremony-pinned vkey hash (JSON.stringify(vkey, null, 2)). */
export function sha256VkeyCeremony(p) {
  const v = JSON.parse(fs.readFileSync(p, "utf8"));
  return crypto.createHash("sha256").update(JSON.stringify(v, null, 2)).digest("hex");
}

export function sha256Json(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

export function artifactsReady(paths = resolveArtifacts()) {
  return [paths.wasm, paths.witCalc, paths.zkey, paths.vkey, paths.input].every((p) =>
    fs.existsSync(p)
  );
}

export function assertCoreArtifacts(paths = resolveArtifacts()) {
  const required = ["wasm", "witCalc", "zkey", "vkey", "input"];
  const missing = required.filter((k) => !fs.existsSync(paths[k]));
  if (missing.length) {
    throw new Error(
      `Missing prover artifacts:\n${missing.map((k) => `  ${k}: ${paths[k]}`).join("\n")}`
    );
  }
}

export function artifactHashes(paths = resolveArtifacts()) {
  return {
    zkeyHash: sha256File(paths.zkey),
    vkHash: sha256VkeyCeremony(paths.vkey),
    vkFileHash: sha256File(paths.vkey),
    wasmHash: sha256File(paths.wasm),
    inputHash: sha256Json(JSON.parse(fs.readFileSync(paths.input, "utf8"))),
  };
}
