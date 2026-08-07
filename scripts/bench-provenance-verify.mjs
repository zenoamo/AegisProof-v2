#!/usr/bin/env node
// ============================================================================
// Benchmark provenance verification overhead (Phase 8.13 Task 4)
// Measures SHA-256 only vs SHA-256 + ML-DSA verify.
// Output: benchmarks/reports/provenance-verify-benchmark.json
// Does NOT affect prover M1–M5 benchmarks.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveArtifacts } from "./lib/resolve-artifacts.mjs";
import {
  createManifest,
  verifyManifest,
  signManifest,
} from "./lib/artifact-provenance.mjs";
import { generateKeypair } from "./lib/pqc-signature.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "benchmarks", "reports", "provenance-verify-benchmark.json");

function bench(label, fn, iterations = 5) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = Date.now();
    fn();
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length / 2)];
  return { label, iterations, p50Ms: p50, samplesMs: times };
}

const paths = resolveArtifacts();
const baseManifest = createManifest(paths, { sign: false });
const { publicKey, secretKey, publicKeyHex } = generateKeypair();
const benchKeyId = "bench-ephemeral";
process.env.AEGIS_PQC_PUBLIC_KEY_HEX = publicKeyHex;
process.env.AEGIS_PQC_PUBLIC_KEY_ID = benchKeyId;

const signedManifest = signManifest(baseManifest, { secretKey, publicKeyHex, publicKeyId: benchKeyId });

const hashOnly = bench("sha256-verify", () => {
  verifyManifest(baseManifest, { allowMissingOptional: true, pqcRequired: false });
});

const hashPlusPqc = bench("sha256-plus-mldsa-verify", () => {
  verifyManifest(signedManifest, { allowMissingOptional: true, pqcRequired: true });
});

const report = {
  schemaVersion: 1,
  phase: "8.13",
  generatedAt: new Date().toISOString(),
  entryCount: baseManifest.entries.length,
  signedEntryCount: signedManifest.entries.filter((e) => e.pqcSignatureEnvelope?.status === "signed").length,
  benchmarks: [hashOnly, hashPlusPqc],
  deltaP50Ms: hashPlusPqc.p50Ms - hashOnly.p50Ms,
  note: "Provenance verification only — prover M1–M5 unaffected",
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

console.log(`Provenance benchmark written: ${path.relative(ROOT, OUT)}`);
console.log(`SHA-256 only p50:     ${hashOnly.p50Ms}ms`);
console.log(`SHA-256 + ML-DSA p50: ${hashPlusPqc.p50Ms}ms (delta +${report.deltaP50Ms}ms)`);
