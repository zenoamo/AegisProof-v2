#!/usr/bin/env node
// ============================================================================
// Hybrid auth verification benchmark (Phase 8.13 Task 6)
// Output: benchmarks/reports/hybrid-auth-benchmark.json
// Does NOT affect prover M1–M5 benchmarks.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createHybridAuthEnvelope,
  verifyHybridAuthEnvelope,
  createDeploymentAuthPayload,
  generateClassicalKeypair,
  generatePqcKeypair,
} from "./lib/hybrid-auth-envelope.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "benchmarks", "reports", "hybrid-auth-benchmark.json");

function bench(label, fn, iterations = 10) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = Date.now();
    fn();
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { label, iterations, p50Ms: times[Math.floor(times.length / 2)], samplesMs: times };
}

const payload = createDeploymentAuthPayload("0xbench", "deploy-verifier", { chainId: 1 });
const { privateKey: classicalSk, publicKey: classicalPk } = generateClassicalKeypair();
const { secretKey: pqcSk, publicKeyHex: pqcPkHex } = generatePqcKeypair();

const classicalOnly = createHybridAuthEnvelope(payload, { classicalPrivateKey: classicalSk });
const pqcOnly = createHybridAuthEnvelope(payload, {
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});
const hybrid = createHybridAuthEnvelope(payload, {
  classicalPrivateKey: classicalSk,
  pqcPrivateKey: pqcSk,
  pqcPublicKeyHex: pqcPkHex,
});

const ecdsaBench = bench("ecdsa-verify", () => {
  verifyHybridAuthEnvelope(classicalOnly, { classicalPublicKey: classicalPk, requireClassical: true });
});

const mldsaBench = bench("mldsa-verify", () => {
  verifyHybridAuthEnvelope(pqcOnly, { requirePqc: true });
});

const hybridBench = bench("hybrid-verify", () => {
  verifyHybridAuthEnvelope(hybrid, { classicalPublicKey: classicalPk });
});

const report = {
  schemaVersion: 1,
  phase: "8.13-task6",
  generatedAt: new Date().toISOString(),
  benchmarks: [ecdsaBench, mldsaBench, hybridBench],
  note: "Hybrid auth research layer only — prover M1–M5 unaffected",
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

console.log(`Hybrid auth benchmark: ${path.relative(ROOT, OUT)}`);
for (const b of report.benchmarks) {
  console.log(`  ${b.label} p50: ${b.p50Ms}ms`);
}
