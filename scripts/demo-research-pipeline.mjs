#!/usr/bin/env node
// ============================================================================
// AegisProof v2 — Research Pipeline Demo (Phase F)
// FIXTURE / MOCK / OFFLINE only — NOT production verified
// Run: node scripts/demo-research-pipeline.mjs
// ============================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function banner() {
  console.log(`
=== AEGISPROOF RESEARCH PIPELINE ===

TEE:        FIXTURE / OFFLINE
KMS:        MOCKED
OIDC:       MOCKED
HSM:        NOT CONNECTED
PCCS:       NOT CONNECTED
KDS:        NOT CONNECTED
PRODUCTION: NOT VERIFIED

RESEARCH_DEMO_ONLY
`);
}

function run(label, cmd, args, opts = {}) {
  console.log(`\n--- Stage: ${label} ---`);
  const t0 = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.quiet ? "pipe" : "inherit",
    shell: true,
    env: { ...process.env, ...opts.env },
  });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  console.log(`${ok ? "PASS" : "SKIP/FAIL"} ${label} (${ms}ms)`);
  return { ok, ms };
}

function main() {
  banner();

  const results = [];

  // 1. TEE fixture pipeline (offline/mock)
  results.push(
    run("TEE AttestationPipeline (fixture E2E)", "npx", ["tsx", "tee/tests/pipeline-e2e.test.ts"], {
      env: { TEE_VERIFICATION: "offline" },
    })
  );

  // 2. TEE offline DCAP/VCEK verification
  results.push(
    run("TEE offline DCAP/VCEK verification", "npx", ["tsx", "tee/tests/offline-verification.test.ts"], {
      env: { TEE_VERIFICATION: "offline" },
    })
  );

  // 3. Groth16 regression (T1–T9) — uses Frozen Core read-only
  results.push(run("Groth16 T1–T9 regression", "npm", ["run", "test:prover-compat"], { quiet: false }));

  // 4. Provenance SHA-256 verification
  results.push(run("Provenance verify (--live)", "npm", ["run", "verify:provenance", "--", "--live"]));

  // 5. PQC path (WARN if unsigned — research demo)
  results.push(
    run("Provenance verify (PQC optional)", "npm", ["run", "verify:provenance", "--", "--live"], {
      env: {},
    })
  );

  console.log("\n=== RESEARCH PIPELINE SUMMARY ===");
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.ms}ms`);
  }

  console.log(`
Status: RESEARCH_DEMO_COMPLETE
Live Production Verified: NO
NOT VERIFIED: Vault, OIDC, HSM, PCCS, KDS, production TEE
`);

  const allOk = results.every((r) => r.ok);
  process.exit(allOk ? 0 : 1);
}

main();
