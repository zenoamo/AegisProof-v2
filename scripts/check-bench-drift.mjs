#!/usr/bin/env node
// ============================================================================
// Benchmark drift detection (Phase 8.11 Task 1)
// Compares latest prover-bench-*.json against benchmarks/reports/baseline.json
// ============================================================================
import fs from "fs";
import path from "path";
import {
  BASELINE_PATH,
  DRIFT_MODES,
  compareModeDrift,
  findLatestBenchReport,
  getModeEntry,
  loadJson,
  modeIsSkipped,
  modeP50,
} from "./lib/bench-baseline.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    enforce: args.includes("--enforce") || process.env.BENCH_DRIFT_ENFORCE === "1",
    baselinePath: process.env.BENCH_BASELINE ?? BASELINE_PATH,
    benchPath: process.env.BENCH_REPORT ?? null,
  };
}

function formatModeLine(modeId, result) {
  if (result.status === "SKIP") {
    return `  ${modeId}: SKIP (baseline or current unavailable/skipped)`;
  }
  const sign = result.deltaPercent >= 0 ? "+" : "";
  return (
    `  ${modeId}: ${result.status} — baseline p50=${result.baseline}ms, ` +
    `current p50=${result.current}ms (${sign}${result.deltaPercent.toFixed(1)}%)`
  );
}

function main() {
  const { enforce, baselinePath, benchPath } = parseArgs();

  if (!fs.existsSync(baselinePath)) {
    console.error(`FAIL benchmark drift check: baseline not found (${baselinePath})`);
    process.exit(1);
  }

  const baseline = loadJson(baselinePath);
  const latest = benchPath
    ? { abs: benchPath, name: path.basename(benchPath) }
    : findLatestBenchReport();

  if (!latest) {
    console.error("FAIL benchmark drift check: no prover-bench-*.json report found");
    process.exit(1);
  }

  const current = loadJson(latest.abs);
  console.log(`Baseline : ${path.basename(baselinePath)} (schemaVersion=${baseline.schemaVersion ?? 1})`);
  console.log(`Compare  : ${latest.name}`);

  let overall = "PASS";
  const details = [];

  for (const modeId of DRIFT_MODES) {
    const baseEntry = getModeEntry(baseline, modeId);
    const curEntry = getModeEntry(current, modeId);

    if (modeIsSkipped(baseEntry) || modeIsSkipped(curEntry)) {
      details.push({ modeId, status: "SKIP", baseline: modeP50(baseEntry), current: modeP50(curEntry) });
      continue;
    }

    const result = compareModeDrift(modeP50(baseEntry), modeP50(curEntry));
    details.push({ modeId, ...result });

    if (result.status === "FAIL") overall = "FAIL";
    else if (result.status === "WARN" && overall === "PASS") overall = "WARN";
  }

  for (const d of details) {
    console.log(formatModeLine(d.modeId, d));
  }

  if (overall === "PASS") {
    console.log("\nPASS benchmark drift check");
    process.exit(0);
  }

  if (overall === "WARN") {
    console.log("\nWARN benchmark regression detected");
    if (enforce) {
      console.log("(enforce mode: treating WARN as failure)");
      process.exit(1);
    }
    process.exit(0);
  }

  console.log("\nFAIL benchmark regression detected");
  process.exit(enforce ? 1 : 0);
}

main();
