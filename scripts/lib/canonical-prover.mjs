// ============================================================================
// Canonical Groth16 prover — public API (Phase 8.10)
// Re-exports resolveArtifacts + provers for backward compatibility.
// ============================================================================
import os from "os";
import { createRequire } from "module";
import {
  getCalculator,
  getProverName,
  isRapidsnarkAvailable,
  SnarkjsProver,
  RapidsnarkProver,
} from "./provers.mjs";

const require = createRequire(import.meta.url);

export {
  ROOT,
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  WASM_HASH_PREFIX,
  resolveArtifacts,
  resolveArtifacts as resolveArtifactPaths,
  sha256File,
  sha256VkeyCeremony,
  sha256Json,
  artifactsReady,
  assertCoreArtifacts,
  artifactHashes,
} from "./resolve-artifacts.mjs";

export {
  silentLogger,
  SnarkjsProver,
  RapidsnarkProver,
  getProver,
  getProverName,
  isRapidsnarkAvailable,
  resolveRapidsnarkBin,
  verifyProof,
  fullProve,
  writeWtnsFile,
  getCalculator,
  generateWitnessBin,
  writeWitnessFile,
  proveCanonical,
  EXPECTED_PUBLIC_SIGNALS,
} from "./provers.mjs";

/** @deprecated use SnarkjsProver.prove */
export async function proveSnarkjs(zkeyPath, wtnsPath) {
  return SnarkjsProver.prove(zkeyPath, wtnsPath);
}

/** @deprecated use RapidsnarkProver.prove */
export async function proveRapidsnark(zkeyPath, wtnsPath, scratchDir) {
  return RapidsnarkProver.prove(zkeyPath, wtnsPath, scratchDir);
}

/** @deprecated use getProver().prove */
export async function proveWithBackend(zkeyPath, wtnsPath, scratchDir, backend) {
  const { getProver } = await import("./provers.mjs");
  const prover = getProver(backend, { allowFallback: false });
  return prover.prove(zkeyPath, wtnsPath, scratchDir);
}

export function loadVkey(vkeyPath) {
  const fs = require("fs");
  return JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
}

export function getEnvironmentSummary() {
  return {
    os: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpus: os.cpus().length,
    node: process.version,
    prover: getProverName(),
    rapidsnarkAvailable: isRapidsnarkAvailable(),
    snarkjs: (() => {
      try {
        return require("snarkjs/package.json").version;
      } catch {
        return "unknown";
      }
    })(),
  };
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

export function summarizeTimings(samplesMs) {
  const sorted = samplesMs.slice().sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

export async function generateWitness(input, paths) {
  const wc = await getCalculator(paths);
  return wc.calculateWitness(input, 1);
}
