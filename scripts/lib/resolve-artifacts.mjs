// ============================================================================
// Canonical artifact resolver — single entry point (Phase 8.10 / 8.11)
// ----------------------------------------------------------------------------
// All prover/bench/test/verify scripts MUST use resolveArtifacts() only.
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

/** @typedef {'artifacts/phase2'|'crypto-artifacts'|'override'|'missing'} ArtifactSourceLabel */

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
  r1cs: [
    "artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs",
    "crypto-artifacts/phase2/phase2/r1cs/aegis_commit_core_v2.r1cs",
  ],
  sym: [
    "artifacts/phase2/r1cs/aegis_commit_core_v2.sym",
    "crypto-artifacts/phase2/phase2/r1cs/aegis_commit_core_v2.sym",
  ],
  badCommit: [
    "artifacts/phase2/tests/input_v2_bad_commitment.json",
    "crypto-artifacts/phase2/phase2/tests/input_v2_bad_commitment.json",
  ],
  badNull: [
    "artifacts/phase2/tests/input_v2_bad_nullifier.json",
    "crypto-artifacts/phase2/phase2/tests/input_v2_bad_nullifier.json",
  ],
  badManifest: [
    "artifacts/phase2/tests/input_v2_bad_manifest.json",
    "crypto-artifacts/phase2/phase2/tests/input_v2_bad_manifest.json",
  ],
  productionZkey: [
    "artifacts/phase4/final/production.zkey",
    "crypto-artifacts/phase4/production.zkey",
  ],
  productionVkey: [
    "artifacts/phase4/final/production-vkey.json",
    "crypto-artifacts/phase4/production-vkey.json",
  ],
  devZkey: [
    "artifacts/phase2/setup/aegis_v2_0000.zkey",
    "crypto-artifacts/phase2/phase2/setup/aegis_v2_0000.zkey",
  ],
  devVkey: [
    "artifacts/phase2/vkey/vkey_v2.json",
    "crypto-artifacts/phase2/phase2/vkey/vkey_v2.json",
  ],
  baselineProof: ["artifacts/phase4/reports/production_proof_baseline.json"],
};

/** @param {string} relPath */
export function sourceLabelForRel(relPath) {
  if (relPath.startsWith("crypto-artifacts/")) return "crypto-artifacts";
  if (relPath.startsWith("artifacts/phase2") || relPath.startsWith("artifacts/phase4")) {
    return "artifacts/phase2";
  }
  return "unknown";
}

/**
 * @param {string[]} relPaths
 * @returns {{ path: string, rel: string, source: ArtifactSourceLabel, exists: boolean }}
 */
export function resolvePathWithSource(relPaths) {
  for (const rel of relPaths) {
    const abs = R(rel);
    if (fs.existsSync(abs)) {
      return { path: abs, rel, source: sourceLabelForRel(rel), exists: true };
    }
  }
  const rel = relPaths[0];
  return { path: R(rel), rel, source: sourceLabelForRel(rel), exists: false };
}

function firstExisting(relPaths) {
  return resolvePathWithSource(relPaths).path;
}

/**
 * Resolve all artifact paths.
 * @param {object} [options]
 * @param {boolean} [options.production] - production zkey/vkey (phase4 verification)
 * @param {'prover'|'phase2'|'production'} [options.profile] - resolution profile
 * @param {object} [options.overrides] - absolute-path overrides per key
 */
export function resolveArtifacts(options = {}) {
  const {
    production = false,
    profile = production ? "production" : "prover",
    overrides = {},
    ...legacyOverrides
  } = options;

  const mergedOverrides =
    Object.keys(overrides).length > 0 ? overrides : legacyOverrides;

  const wasmRes = resolvePathWithSource(CANDIDATES.wasm);
  const witCalcRes = resolvePathWithSource(CANDIDATES.witCalc);
  const inputRes = resolvePathWithSource(CANDIDATES.input);
  const r1csRes = resolvePathWithSource(CANDIDATES.r1cs);
  const symRes = resolvePathWithSource(CANDIDATES.sym);

  const useDevKeys = profile === "phase2";
  const zkeyCandidates = useDevKeys ? CANDIDATES.devZkey : CANDIDATES.productionZkey;
  const vkeyCandidates = useDevKeys ? CANDIDATES.devVkey : CANDIDATES.productionVkey;
  const zkeyRes = resolvePathWithSource(zkeyCandidates);
  const vkeyRes = resolvePathWithSource(vkeyCandidates);

  const badCommitRes = resolvePathWithSource(CANDIDATES.badCommit);
  const badNullRes = resolvePathWithSource(CANDIDATES.badNull);
  const badManifestRes = resolvePathWithSource(CANDIDATES.badManifest);
  const baselineRes = resolvePathWithSource(CANDIDATES.baselineProof);

  /** @type {Record<string, ArtifactSourceLabel>} */
  const sources = {
    wasm: wasmRes.source,
    witCalc: witCalcRes.source,
    input: inputRes.source,
    r1cs: r1csRes.source,
    sym: symRes.source,
    zkey: zkeyRes.source,
    vkey: vkeyRes.source,
    badCommit: badCommitRes.source,
    badNull: badNullRes.source,
    badManifest: badManifestRes.source,
    baselineProof: baselineRes.source,
  };

  const paths = {
    wasm: wasmRes.path,
    witCalc: witCalcRes.path,
    input: inputRes.path,
    r1cs: r1csRes.path,
    sym: symRes.path,
    zkey: zkeyRes.path,
    vkey: vkeyRes.path,
    badCommit: badCommitRes.path,
    badNull: badNullRes.path,
    badManifest: badManifestRes.path,
    baselineProof: baselineRes.path,
    scratchDir: R("artifacts/phase4/reports/scratch"),
    cacheDir: R("artifacts/phase2/cache"),
    profile,
    sources,
    ...mergedOverrides,
  };

  if (Object.keys(mergedOverrides).length > 0) {
    for (const key of Object.keys(mergedOverrides)) {
      if (key in sources) sources[key] = "override";
    }
    paths.sources = sources;
  }

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
  const readHash = (p) => (fs.existsSync(p) ? sha256File(p) : null);
  const vkHash = fs.existsSync(paths.vkey) ? sha256VkeyCeremony(paths.vkey) : null;
  return {
    zkeyHash: readHash(paths.zkey),
    vkHash,
    vkFileHash: readHash(paths.vkey),
    wasmHash: readHash(paths.wasm),
    inputHash: fs.existsSync(paths.input)
      ? sha256Json(JSON.parse(fs.readFileSync(paths.input, "utf8")))
      : null,
  };
}

/** Primary artifact source label for summary (wasm precedence). */
export function primaryArtifactSource(paths) {
  return paths.sources?.wasm ?? "unknown";
}

/**
 * Compact resolution summary for CI / evidence logs.
 * @param {ReturnType<typeof resolveArtifacts>} paths
 */
export function artifactResolutionSummary(paths) {
  const hashes = artifactHashes(paths);
  return {
    source: primaryArtifactSource(paths),
    profile: paths.profile ?? "prover",
    wasmHash: hashes.wasmHash,
    zkeyHash: hashes.zkeyHash,
    vkHash: hashes.vkHash,
    paths: {
      wasm: paths.wasm,
      zkey: paths.zkey,
      vkey: paths.vkey,
      r1cs: paths.r1cs,
    },
    sources: paths.sources,
  };
}

/**
 * Startup log for migrated scripts.
 * @param {ReturnType<typeof resolveArtifacts>} paths
 * @param {{ json?: boolean }} [opts]
 */
export function logArtifactResolver(paths, opts = {}) {
  const summary = artifactResolutionSummary(paths);
  const line = `[artifact-resolver] source=${summary.source} profile=${summary.profile}`;
  console.log(line);
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  }
  return summary;
}

export function assertProductionHashes(paths = resolveArtifacts({ production: true })) {
  assertCoreArtifacts(paths);
  const zkeyHash = sha256File(paths.zkey);
  const vkHash = sha256VkeyCeremony(paths.vkey);
  if (zkeyHash !== PRODUCTION_ZKEY_HASH) {
    throw new Error(`production.zkey hash mismatch: got ${zkeyHash}`);
  }
  if (vkHash !== PRODUCTION_VKEY_HASH) {
    throw new Error(`production vkey hash mismatch: got ${vkHash}`);
  }
  return { zkeyHash, vkHash };
}
