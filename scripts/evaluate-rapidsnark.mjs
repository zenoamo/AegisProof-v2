#!/usr/bin/env node
// ============================================================================
// rapidsnark evaluation recorder (Phase 8.11)
// Runs T2/T4/M4 when RAPIDSNARK_BIN is available; writes evaluation JSON.
// ============================================================================
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "benchmarks", "reports", "rapidsnark-evaluation.json");
const M4_SAMPLES = Number(process.env.RAPIDSNARK_BENCH_SAMPLES ?? 20);
const HARDHAT_CONFIG = path.join(ROOT, "scripts", "hardhat-prover.config.ts");

const {
  resolveArtifacts,
  artifactHashes,
} = await import("./lib/resolve-artifacts.mjs");
const {
  isRapidsnarkAvailable,
  resolveRapidsnarkBin,
  proveCanonical,
  RapidsnarkProver,
  writeWtnsFile,
  generateWitnessBin,
} = await import("./lib/provers.mjs");
const { summarizeTimings } = await import("./lib/canonical-prover.mjs");

function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function verifyOnChain(proof, publicSignals) {
  const scratch = path.join(ROOT, "artifacts", "phase4", "reports", "scratch");
  fs.mkdirSync(scratch, { recursive: true });
  const proofPath = path.join(scratch, "rs-eval-proof.json");
  const publicPath = path.join(scratch, "rs-eval-public.json");
  fs.writeFileSync(proofPath, JSON.stringify(proof));
  fs.writeFileSync(publicPath, JSON.stringify(publicSignals));

  const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(
    process.execPath,
    [tsxCli, path.join(ROOT, "scripts", "onchain-verify-once.ts"), proofPath, publicPath],
    {
      cwd: ROOT,
      env: { ...process.env, HARDHAT_CONFIG },
      encoding: "utf8",
      timeout: 120_000,
    }
  );
  fs.rmSync(proofPath, { force: true });
  fs.rmSync(publicPath, { force: true });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
  }
  return r.status === 0;
}

async function main() {
  const paths = resolveArtifacts();
  const input = JSON.parse(fs.readFileSync(paths.input, "utf8"));
  const vkey = JSON.parse(fs.readFileSync(paths.vkey, "utf8"));
  const baseline = JSON.parse(fs.readFileSync(paths.baselineProof, "utf8"));
  const bin = resolveRapidsnarkBin();
  const hashes = artifactHashes(paths);

  /** @type {Record<string, unknown>} */
  const report = {
    evaluatedAt: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    node: process.version,
    backend: "rapidsnark",
    rapidsnarkBin: bin,
    binaryHash: bin && fs.existsSync(bin) && fs.statSync(bin).isFile() ? sha256File(bin) : null,
    available: isRapidsnarkAvailable(),
    samples: M4_SAMPLES,
    verifySnarkjs: null,
    verifyOnChain: null,
    timing: null,
    artifactHash: hashes,
    publicSignalsMatch: null,
    classification: null,
    status: null,
  };

  if (!report.available) {
    report.classification = process.platform === "win32" ? "binary (platform)" : "binary (not installed)";
    report.status = "SKIP";
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  try {
    const result = await proveCanonical(input, {
      paths,
      backend: "rapidsnark",
      verify: false,
      allowFallback: false,
    });

    report.verifySnarkjs = await snarkjs.groth16.verify(
      vkey,
      result.publicSignals,
      result.proof
    );
    report.verifyOnChain = verifyOnChain(result.proof, result.publicSignals);
    report.publicSignalsMatch = result.publicSignals.every(
      (s, i) => s === baseline.publicSignals[i]
    );

    const witBin = await generateWitnessBin(input, paths);
    const wtns = path.join(paths.scratchDir, "rapidsnark-eval.wtns");
    writeWtnsFile(wtns, witBin);
    const sampleMs = [];
    for (let i = 0; i < M4_SAMPLES; i++) {
      const t0 = Date.now();
      await RapidsnarkProver.prove(paths.zkey, wtns, paths.scratchDir);
      sampleMs.push(Date.now() - t0);
    }
    fs.rmSync(wtns, { force: true });
    report.timing = summarizeTimings(sampleMs);

    const allVerify =
      report.verifySnarkjs === true &&
      report.verifyOnChain === true &&
      report.publicSignalsMatch === true;

    report.status = allVerify ? "PASS" : "FAIL";
    report.classification =
      report.status === "PASS"
        ? null
        : report.verifySnarkjs === false
          ? "proof format"
          : report.verifyOnChain === false
            ? "on-chain"
            : "wrapper";
  } catch (e) {
    report.status = "FAIL";
    report.classification = "wrapper";
    report.error = String(e.message ?? e);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "PASS" ? 0 : report.status === "SKIP" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
