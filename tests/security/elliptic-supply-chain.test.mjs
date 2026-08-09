// ============================================================================
// VULN-010 regression — elliptic production reachability / supply chain
// Run: npm run test:penetration (included in penetration suite)
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// T-EXP-010A: production dependency tree must not include circomlibjs (elliptic carrier)
{
  ok(!("circomlibjs" in (pkg.dependencies ?? {})), "T-EXP-010A: circomlibjs not in production dependencies");
  ok("circomlibjs" in (pkg.devDependencies ?? {}), "T-EXP-010A: circomlibjs in devDependencies");
  const ls = spawnSync("npm", ["ls", "elliptic", "--omit=dev"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  const out = (ls.stdout ?? "") + (ls.stderr ?? "");
  const hasEllipticTree = /elliptic@/.test(out) && !/empty/i.test(out);
  ok(!hasEllipticTree, "T-EXP-010A: elliptic absent from production dependency tree");
}

// T-EXP-010B: security-critical hot paths do not import circomlibjs / elliptic
{
  const hotPaths = [
    "scripts/prove.js",
    "scripts/prove_native.mjs",
    "scripts/verify-provenance-manifest.mjs",
    "scripts/lib/kms-signer.mjs",
    "scripts/lib/kms-provenance.mjs",
    "scripts/lib/pqc-signature.mjs",
    "scripts/lib/artifact-provenance.mjs",
    "scripts/lib/kms-backends/vault-auth.mjs",
    "scripts/lib/canonical-prover.mjs",
  ];
  for (const rel of hotPaths) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    ok(!/circomlibjs|['"]elliptic['"]/.test(src), `T-EXP-010B: ${path.basename(rel)} has no elliptic/circomlibjs import`);
  }
}

// T-EXP-010C: tooling path using circomlibjs still works
{
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const hash = poseidon([1n, 2n]);
  ok(hash != null, "T-EXP-010C: buildPoseidon tooling path works");
}

// T-EXP-010D: production npm audit must not report elliptic (VULN-010 scope)
{
  const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  const report = JSON.parse(audit.stdout || "{}");
  const vulns = Object.values(report.vulnerabilities ?? {});
  const ellipticHits = vulns.filter((v) => v.name === "elliptic" || v.via?.includes?.("elliptic"));
  ok(ellipticHits.length === 0, "T-EXP-010D: no elliptic in production npm audit (high+)");
}

console.log(`\nELLIPTIC SUPPLY CHAIN: ${passed} checks PASS`);
