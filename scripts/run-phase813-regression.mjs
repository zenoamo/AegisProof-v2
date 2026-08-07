#!/usr/bin/env node
// ============================================================================
// Phase 8.13 unified regression gate (Task 8)
// Runs all PQC / provenance / security boundary tests in order.
// Does NOT replace T1–T9 (run via test:prover-compat or security-boundary-check).
// ============================================================================
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  { label: "Sensitive file policy (T-SEC)", script: "scripts/run-sensitive-files-boundary.mjs" },
  { label: "Live sensitive file scan", script: "scripts/run-check-sensitive-files.mjs" },
  { label: "Artifact resolution", script: "scripts/run-artifact-resolution.mjs" },
  { label: "Artifact provenance", script: "scripts/run-artifact-provenance.mjs" },
  { label: "PQC signature (T-PQC)", script: "scripts/run-pqc-signature.mjs" },
  { label: "Hybrid auth (T-AUTH)", script: "scripts/run-hybrid-auth.mjs" },
  { label: "Security penetration (PT-01–PT-10)", script: "scripts/run-penetration.mjs" },
  { label: "Provenance live verify", script: "scripts/verify-provenance-manifest.mjs", args: ["--live"] },
];

function runStep(step) {
  console.log(`\n=== ${step.label} ===`);
  const r = spawnSync(process.execPath, [path.join(ROOT, step.script), ...(step.args ?? [])], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (r.status !== 0) {
    console.error(`\nFAIL Phase 8.13 regression at: ${step.label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`PASS ${step.label}`);
}

console.log("Phase 8.13 Unified Regression Gate");
for (const step of STEPS) runStep(step);
console.log("\nPASS Phase 8.13 unified regression gate");
