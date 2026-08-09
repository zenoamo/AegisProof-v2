#!/usr/bin/env node
// ============================================================================
// Research pipeline benchmark (Phase G) — new baseline file only
// Does NOT overwrite benchmarks/reports/baseline.json
// Run: node scripts/bench-research-pipeline.mjs
// ============================================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "benchmarks", "reports", "research-pipeline-benchmark.json");

function gitCommit() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function benchStage(label, fn, iterations = 3) {
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const ok = fn();
    samples.push(performance.now() - t0);
    if (!ok) return { label, ok: false, iterations, samplesMs: samples };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    label,
    ok: true,
    iterations,
    p50Ms: Math.round(percentile(sorted, 50) * 100) / 100,
    p95Ms: Math.round(percentile(sorted, 95) * 100) / 100,
    samplesMs: samples.map((x) => Math.round(x * 100) / 100),
  };
}

function runQuiet(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, shell: true, stdio: "pipe", env: { ...process.env, ...env } });
  return r.status === 0;
}

async function main() {
  console.log("Research pipeline benchmark (FIXTURE/MOCK — NOT VERIFIED live)\n");

  const stages = [];

  stages.push(
    benchStage("tee-pipeline-e2e", () =>
      runQuiet("npx", ["tsx", "tee/tests/pipeline-e2e.test.ts"], { TEE_VERIFICATION: "offline" })
    )
  );

  stages.push(
    benchStage("tee-offline-dcap-vcek", () =>
      runQuiet("npx", ["tsx", "tee/tests/offline-verification.test.ts"], { TEE_VERIFICATION: "offline" })
    )
  );

  stages.push(
    benchStage("provenance-sha256-live", () =>
      runQuiet("npm", ["run", "verify:provenance", "--", "--live"])
    )
  );

  stages.push(
    benchStage("provenance-pqc-optional", () =>
      runQuiet("npm", ["run", "verify:provenance", "--", "--live"])
    )
  );

  // Full pipeline orchestration cost
  stages.push(
    benchStage("full-research-pipeline-demo", () =>
      runQuiet("node", ["scripts/demo-research-pipeline.mjs"])
    , 1)
  );

  const report = {
    schemaVersion: 1,
    phase: "research-expansion-G",
    generatedAt: new Date().toISOString(),
    commit: gitCommit(),
    environment: {
      os: `${process.platform} ${process.arch}`,
      node: process.version,
    },
    fixtureMockStatus: {
      tee: "FIXTURE / OFFLINE",
      kms: "MOCKED",
      oidc: "MOCKED",
      hsm: "NOT CONNECTED",
      pccs: "NOT CONNECTED",
      production: "NOT VERIFIED",
    },
    note: "Research pipeline stages only — does not replace prover baseline.json",
    stages,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT_PATH}`);
  for (const s of stages) {
    console.log(`  ${s.ok ? "PASS" : "FAIL"} ${s.label} p50=${s.p50Ms ?? "n/a"}ms`);
  }

  const failed = stages.some((s) => !s.ok);
  process.exit(failed ? 1 : 0);
}

main();
