// ============================================================================
// Sensitive file boundary policy tests (Phase 8.13 Task 7)
// Run: npm run test:sensitive-files-boundary
// ============================================================================
import assert from "node:assert/strict";
import {
  classifyPath,
  evaluateScan,
  isExcluded,
  CRITICAL_PATTERNS,
  MIGRATION_PATTERNS,
} from "../scripts/lib/sensitive-files-policy.mjs";

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

// T-SEC-01: .env detected as critical
{
  const r = classifyPath(".env");
  ok(r.critical.length === 1 && r.critical[0].pattern === "env-file", "T-SEC-01: .env critical");
}

// T-SEC-02: private key extension
{
  const r = classifyPath("secrets/operator.pem");
  ok(r.critical.some((h) => h.pattern === "private-key-ext"), "T-SEC-02: .pem critical");
}

// T-SEC-03: provenance keys dir
{
  const r = classifyPath("artifacts/provenance/keys/ci.key.json");
  ok(r.critical.some((h) => h.pattern === "pqc-private-dir"), "T-SEC-03: provenance/keys critical");
}

// T-SEC-04: production.zkey is migration (not critical)
{
  const r = classifyPath("crypto-artifacts/phase4/production.zkey");
  ok(r.critical.length === 0, "T-SEC-04: production.zkey not critical");
  ok(r.migration.some((h) => h.pattern === "production-zkey"), "T-SEC-04: production.zkey migration");
}

// T-SEC-05: allowlist permits migration debt
{
  const migration = [{ path: "crypto-artifacts/phase4/production.zkey", pattern: "production-zkey" }];
  const allow = new Set(["crypto-artifacts/phase4/production.zkey"]);
  const ev = evaluateScan([], migration, allow, false);
  ok(ev.pass, "T-SEC-05: allowlisted migration passes");
}

// T-SEC-06: unallowlisted migration fails
{
  const migration = [{ path: "new/path/production.zkey", pattern: "production-zkey" }];
  const ev = evaluateScan([], migration, new Set(), false);
  ok(!ev.pass, "T-SEC-06: unallowlisted migration fails");
}

// T-SEC-07: strict mode fails allowlisted migration
{
  const migration = [{ path: "crypto-artifacts/phase4/production.zkey", pattern: "production-zkey" }];
  const allow = new Set(["crypto-artifacts/phase4/production.zkey"]);
  const ev = evaluateScan([], migration, allow, true);
  ok(!ev.pass, "T-SEC-07: strict mode rejects allowlisted");
}

// T-SEC-08: rapidsnark vendored paths excluded
{
  ok(isExcluded("rapidsnark/depends/pistache/tests/certs/server.key"), "T-SEC-08: rapidsnark excluded");
  const r = classifyPath("rapidsnark/depends/pistache/tests/certs/server.key");
  ok(r.critical.length === 0 && r.migration.length === 0, "T-SEC-08: excluded path no hits");
}

// T-SEC-09: critical always fails even with allowlist
{
  const critical = [{ path: ".env", pattern: "env-file" }];
  const ev = evaluateScan(critical, [], new Set(["anything"]), false);
  ok(!ev.pass, "T-SEC-09: critical never allowlisted");
}

// T-SEC-11: public deployment manifest is metadata, not credentials
{
  const r = classifyPath("deployments/manifest.json");
  ok(r.critical.length === 0, "T-SEC-11: deployment manifest not critical");
}

// T-SEC-10: pattern catalog non-empty
{
  ok(CRITICAL_PATTERNS.length >= 5, "T-SEC-10: critical patterns defined");
  ok(MIGRATION_PATTERNS.length >= 4, "T-SEC-10: migration patterns defined");
}

console.log(`\nSENSITIVE FILES BOUNDARY: ${passed} checks PASS`);
