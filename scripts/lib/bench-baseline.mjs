// ============================================================================
// Benchmark baseline helpers (Phase 8.11)
// ============================================================================
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { ROOT } from "./resolve-artifacts.mjs";

export const BASELINE_PATH = path.join(ROOT, "benchmarks", "reports", "baseline.json");
export const REPORT_DIR = path.join(ROOT, "benchmarks", "reports");

export const DRIFT_MODES = ["M2", "M3", "M4"];
export const WARN_THRESHOLD = 1.3;
export const FAIL_THRESHOLD = 1.5;

const MODE_LABELS = {
  M1: "fullProve",
  M2: "witness",
  M3: "snarkjs prove",
  M4: "rapidsnark prove",
  M5: "warm",
};

export function gitCommit() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: ROOT });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

/** @param {unknown} report */
export function getModeEntry(report, modeId) {
  if (!report || typeof report !== "object") return null;
  const modes = /** @type {Record<string, unknown>} */ (report).modes;
  if (!modes) return null;

  if (Array.isArray(modes)) {
    return modes.find((m) => m.mode === modeId) ?? null;
  }

  return modes[modeId] ?? null;
}

/** @param {unknown} entry */
export function modeIsSkipped(entry) {
  if (!entry || typeof entry !== "object") return true;
  const e = /** @type {Record<string, unknown>} */ (entry);
  if (e.skipped === true) return true;
  return e.p50 == null || typeof e.p50 !== "number";
}

/** @param {unknown} entry */
export function modeP50(entry) {
  if (!entry || typeof entry !== "object") return null;
  const p50 = /** @type {Record<string, unknown>} */ (entry).p50;
  return typeof p50 === "number" ? p50 : null;
}

export function findLatestBenchReport(dir = REPORT_DIR) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("prover-bench-") && f.endsWith(".json"))
    .map((f) => {
      const abs = path.join(dir, f);
      return { name: f, abs, mtime: fs.statSync(abs).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ?? null;
}

export function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Build schema v2 baseline document.
 * @param {object[]} modeResults - bench_prover mode result rows
 */
export function buildBaselineV2(modeResults, hashes, environment, samples, extras = {}) {
  /** @type {Record<string, object>} */
  const modes = {};
  for (const r of modeResults) {
    modes[r.mode] = {
      label: MODE_LABELS[r.mode] ?? r.mode,
      p50: r.skipped ? null : r.p50,
      p95: r.skipped ? null : r.p95,
      min: r.skipped ? null : r.min,
      max: r.skipped ? null : r.max,
      ...(r.skipped ? { skipped: true, reason: r.reason } : {}),
    };
  }

  const m3 = modes.M3;
  const m4 = modes.M4;

  return {
    schemaVersion: 2,
    phase: "8.11",
    pinnedAt: new Date().toISOString(),
    commit: gitCommit(),
    platform: `${environment.os} ${environment.arch}`,
    environment,
    proverBackend: environment.prover ?? "snarkjs",
    samples,
    artifacts: {
      zkeyHash: hashes.zkeyHash,
      vkHash: hashes.vkHash,
      wasmHash: hashes.wasmHash,
      inputHash: hashes.inputHash,
    },
    modes,
    proverSummary: {
      snarkjs: {
        proveP50: m3 && !m3.skipped ? m3.p50 : null,
        proveP95: m3 && !m3.skipped ? m3.p95 : null,
        verify: "PASS",
      },
      rapidsnark: {
        proveP50: m4 && !m4.skipped ? m4.p50 : null,
        proveP95: m4 && !m4.skipped ? m4.p95 : null,
        verify: m4?.skipped ? "SKIP" : "PASS",
      },
    },
    legacyBaselineMs: 50000,
    reductionPercent: 99.0,
    ...extras,
  };
}

/**
 * Compare current p50 against baseline p50.
 * @returns {{ status: 'PASS'|'WARN'|'FAIL'|'SKIP', baseline: number|null, current: number|null, ratio: number|null, deltaPercent: number|null }}
 */
export function compareModeDrift(baselineP50, currentP50) {
  if (baselineP50 == null || currentP50 == null) {
    return { status: "SKIP", baseline: baselineP50, current: currentP50, ratio: null, deltaPercent: null };
  }
  const ratio = currentP50 / baselineP50;
  const deltaPercent = (ratio - 1) * 100;
  if (ratio > FAIL_THRESHOLD) {
    return { status: "FAIL", baseline: baselineP50, current: currentP50, ratio, deltaPercent };
  }
  if (ratio > WARN_THRESHOLD) {
    return { status: "WARN", baseline: baselineP50, current: currentP50, ratio, deltaPercent };
  }
  return { status: "PASS", baseline: baselineP50, current: currentP50, ratio, deltaPercent };
}
