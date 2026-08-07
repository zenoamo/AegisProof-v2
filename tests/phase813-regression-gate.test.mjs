// ============================================================================
// Phase 8.13 regression gate metadata tests (Task 8)
// Run: npm run test:phase813-gate
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

const REQUIRED = [
  "test:sensitive-files-boundary",
  "test:artifact-provenance",
  "test:pqc-signature",
  "test:hybrid-auth",
  "test:artifact-resolution",
  "test:phase813",
  "test:penetration",
  "check:sensitive-files",
  "verify:provenance",
  "check:security-boundary",
];

for (const s of REQUIRED) {
  ok(typeof scripts[s] === "string", `T-813-01: npm script ${s} registered`);
}

const modules = [
  "scripts/lib/artifact-provenance.mjs",
  "scripts/lib/pqc-signature.mjs",
  "scripts/lib/hybrid-auth-envelope.mjs",
  "scripts/lib/public-key-registry.mjs",
  "scripts/lib/sensitive-files-policy.mjs",
  "scripts/run-phase813-regression.mjs",
];

for (const m of modules) {
  ok(fs.existsSync(path.join(ROOT, m)), `T-813-02: module exists ${m}`);
}

ok(fs.existsSync(path.join(ROOT, "artifacts/provenance/manifest.json")), "T-813-03: manifest present");
ok(
  fs.existsSync(path.join(ROOT, "artifacts/provenance/public-keys/aegis-ci-mldsa87-v1.json")),
  "T-813-03: public key registry present",
);

const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/aegis_repro_ci.yml"), "utf8");
ok(wf.includes("security-boundary-check"), "T-813-04: security-boundary-check CI job");
ok(wf.includes("provenance-pqc-hardening"), "T-813-04: provenance-pqc-hardening CI job");
ok(wf.includes("hybrid-auth-research"), "T-813-04: hybrid-auth-research CI job");

console.log(`\nPHASE 8.13 GATE: ${passed} checks PASS`);
