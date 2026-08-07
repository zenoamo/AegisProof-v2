#!/usr/bin/env node
// ============================================================================
// Penetration test runner — PT-01 through PT-10
// Usage: npm run test:penetration
// Optional: PT_RUN_SHIELD_LIVE=1 npm run test:penetration
// ============================================================================
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SUITES = [
  "tests/security/penetration-boundary.test.mjs",
  "tests/security/provenance-security.test.mjs",
  "tests/security/pqc-security.test.mjs",
  "tests/security/hybrid-auth-security.test.mjs",
];

let failed = 0;
for (const rel of SUITES) {
  const abs = path.join(ROOT, rel);
  console.log(`\n=== ${rel} ===\n`);
  const r = spawnSync(process.execPath, [abs], { stdio: "inherit", cwd: ROOT, env: process.env });
  if (r.status !== 0) failed++;
}

if (failed > 0) {
  console.error(`\nPENETRATION TEST: ${failed}/${SUITES.length} suite(s) FAILED`);
  process.exit(1);
}

console.log(`\nPENETRATION TEST: ${SUITES.length}/${SUITES.length} suites PASS`);
process.exit(0);
