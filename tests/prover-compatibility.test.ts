// ============================================================================
// Prover compatibility regression suite (Phase 8.10 Phase 2)
// ----------------------------------------------------------------------------
// Run: npm run test:prover-compat
//
// T1 snarkjs proof verify
// T2 rapidsnark proof verify (skip if binary absent)
// T3 snarkjs on-chain verify
// T4 rapidsnark on-chain verify (skip if binary absent)
// T5 publicSignals equality (30/30)
// T6 zkey hash equality
// T7 VK hash equality
// T8 tamper reject
// T9 benchmark output validation
//
// Exit codes:
//   0  Groth16 regression PASS (T1–T9 executed)
//   1  Groth16 regression FAIL
//   2  Groth16 regression NOT RUN (production.zkey unavailable)
// NOT RUN is never exit 0 and is never "Groth16 regression: PASS".
// Static WASM/R1CS/vkey hashes are verify:frozen-core-integrity, not this suite.
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { network } from "hardhat";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface ProofBundle {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
}

const {
  PRODUCTION_ZKEY_HASH,
  PRODUCTION_VKEY_HASH,
  resolveArtifacts,
  sha256File,
  sha256VkeyCeremony,
} = await import("../scripts/lib/resolve-artifacts.mjs");

const { classifyGroth16Regression } = await import("../scripts/lib/groth16-regression-gate.mjs");

const { isRapidsnarkAvailable, proveCanonical } = await import("../scripts/lib/provers.mjs");

async function proveWith(backend: "snarkjs" | "rapidsnark"): Promise<ProofBundle> {
  const paths = resolveArtifacts();
  const input = JSON.parse(fs.readFileSync(paths.input, "utf8"));
  const result = await proveCanonical(input, {
    paths,
    backend,
    verify: false,
    allowFallback: false,
  });
  return { proof: result.proof, publicSignals: result.publicSignals };
}

function calldata(b: ProofBundle) {
  const pA = [b.proof.pi_a[0], b.proof.pi_a[1]] as unknown as readonly [bigint, bigint];
  const pB = [
    [b.proof.pi_b[0][1], b.proof.pi_b[0][0]],
    [b.proof.pi_b[1][1], b.proof.pi_b[1][0]],
  ] as unknown as readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  const pC = [b.proof.pi_c[0], b.proof.pi_c[1]] as unknown as readonly [bigint, bigint];
  return { pA, pB, pC };
}

let passed = 0;
function ok(cond: boolean, name: string) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

function validateBenchReport(report: Record<string, unknown>) {
  ok(typeof report.generatedAt === "string", "T9: report has generatedAt");
  ok(typeof report.samples === "number" && report.samples > 0, "T9: report has samples");
  ok(typeof report.hashes === "object" && report.hashes !== null, "T9: report has hashes");
  const modes = report.modes as Array<Record<string, unknown>>;
  ok(Array.isArray(modes) && modes.length > 0, "T9: report has modes array");
  for (const m of modes) {
    ok(typeof m.mode === "string", `T9: mode ${m.mode} has mode field`);
    ok(typeof m.zkeyHash === "string", `T9: mode ${m.mode} has zkeyHash`);
    ok(typeof m.vkHash === "string", `T9: mode ${m.mode} has vkHash`);
    if (!m.skipped) {
      ok(typeof m.p50 === "number", `T9: mode ${m.mode} has p50`);
      ok(typeof m.p95 === "number", `T9: mode ${m.mode} has p95`);
    }
  }
}

async function main() {
  const decision = classifyGroth16Regression();
  if (decision.status === "NOT_RUN") {
    console.log("Groth16 regression: NOT RUN");
    console.log(`Reason: ${decision.reason}`);
    process.exit(decision.exitCode ?? 2);
  }
  if (decision.status !== "RUN") {
    console.error("Groth16 regression: FAIL");
    console.error(`Reason: ${decision.reason}`);
    process.exit(decision.exitCode ?? 1);
  }

  console.log("Groth16 regression: RUN");
  console.log(`Reason: ${decision.reason}`);

  const paths = resolveArtifacts();
  const vkey = JSON.parse(fs.readFileSync(paths.vkey, "utf8"));
  const baseline = JSON.parse(fs.readFileSync(paths.baselineProof, "utf8")) as ProofBundle;

  // T1: snarkjs proof -> snarkjs verify
  const snarkBundle = await proveWith("snarkjs");
  ok(
    (await snarkjs.groth16.verify(vkey, snarkBundle.publicSignals, snarkBundle.proof)) === true,
    "T1: snarkjs proof verifies with snarkjs"
  );

  // T2: rapidsnark proof -> snarkjs verify
  let rapidsnarkBundle: ProofBundle | null = null;
  if (isRapidsnarkAvailable()) {
    rapidsnarkBundle = await proveWith("rapidsnark");
    ok(
      (await snarkjs.groth16.verify(
        vkey,
        rapidsnarkBundle.publicSignals,
        rapidsnarkBundle.proof
      )) === true,
      "T2: rapidsnark proof verifies with snarkjs"
    );
  } else {
    console.log("SKIP T2: rapidsnark binary absent");
  }

  // T3/T4: on-chain verify
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const verifier = await viem.deployContract("Groth16VerifierV2Production");
  ok(
    (await publicClient.getBytecode({ address: verifier.address })) !== undefined,
    "Groth16VerifierV2Production deployed"
  );

  const verifyOnChain = async (b: ProofBundle) =>
    verifier.read.verifyProof([
      calldata(b).pA,
      calldata(b).pB,
      calldata(b).pC,
      b.publicSignals.map((s) => BigInt(s)) as readonly bigint[],
    ]);

  ok((await verifyOnChain(snarkBundle)) === true, "T3: snarkjs proof verifies on-chain");

  if (rapidsnarkBundle) {
    ok((await verifyOnChain(rapidsnarkBundle)) === true, "T4: rapidsnark proof verifies on-chain");
  } else {
    console.log("SKIP T4: rapidsnark binary absent");
  }

  // T5: publicSignals 30/30
  ok(snarkBundle.publicSignals.length === 30, "T5: snarkjs publicSignals length is 30");
  ok(
    snarkBundle.publicSignals.every((s, i) => s === baseline.publicSignals[i]),
    "T5: snarkjs publicSignals match baseline (30/30)"
  );
  if (rapidsnarkBundle) {
    ok(
      rapidsnarkBundle.publicSignals.every((s, i) => s === baseline.publicSignals[i]),
      "T5: rapidsnark publicSignals match baseline (30/30)"
    );
  }

  // T6: zkey hash
  ok(sha256File(paths.zkey) === PRODUCTION_ZKEY_HASH, "T6: production.zkey hash unchanged");

  // T7: VK hash (ceremony format)
  ok(sha256VkeyCeremony(paths.vkey) === PRODUCTION_VKEY_HASH, "T7: production vkey hash unchanged");

  // T8: tamper reject
  const tamperedSignals = [...snarkBundle.publicSignals];
  tamperedSignals[28] = (BigInt(tamperedSignals[28]) + 1n).toString();
  ok(
    (await snarkjs.groth16.verify(vkey, tamperedSignals, snarkBundle.proof)) === false,
    "T8: tampered commitment rejected by snarkjs verify"
  );
  ok((await verifyOnChain({ ...snarkBundle, publicSignals: tamperedSignals })) === false,
    "T8: tampered commitment rejected on-chain"
  );

  const tamperedProof = JSON.parse(JSON.stringify(snarkBundle.proof));
  tamperedProof.pi_a[0] = (BigInt(tamperedProof.pi_a[0]) + 1n).toString();
  ok(
    (await snarkjs.groth16.verify(vkey, snarkBundle.publicSignals, tamperedProof)) === false,
    "T8: tampered proof rejected by snarkjs verify"
  );

  // T9: benchmark output validation
  const bench = spawnSync(
    process.execPath,
    ["scripts/bench_prover.mjs", "--samples", "2", "--modes", "M2"],
    { cwd: ROOT, encoding: "utf8", timeout: 120_000 }
  );
  if (bench.status !== 0) {
    console.error("bench stderr:", bench.stderr);
    console.error("bench stdout:", bench.stdout);
  }
  ok(bench.status === 0, "T9: bench_prover.mjs exits 0");
  const reportsDir = path.join(ROOT, "benchmarks", "reports");
  const reports = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith("prover-bench-") && f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(reportsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  ok(reports.length > 0, "T9: benchmark report file exists");
  const latest = JSON.parse(fs.readFileSync(path.join(reportsDir, reports[0].name), "utf8"));
  validateBenchReport(latest);

  console.log(`\nPROVER COMPATIBILITY: ${passed} checks PASS`);
  console.log("Groth16 regression: PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("Groth16 regression: FAIL");
  console.error("FAIL:", e);
  process.exit(1);
});
