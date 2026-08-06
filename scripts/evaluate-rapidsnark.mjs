#!/usr/bin/env node
// ============================================================================
// rapidsnark evaluation recorder (Phase 8.10 Finalization)
// Runs T2/T4/M4 when RAPIDSNARK_BIN is available; writes evaluation JSON.
// ============================================================================
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "benchmarks", "reports", "rapidsnark-evaluation.json");

const {
  resolveArtifacts,
  artifactHashes,
  sha256VkeyCeremony,
} = await import("./lib/resolve-artifacts.mjs");
const {
  isRapidsnarkAvailable,
  resolveRapidsnarkBin,
  proveCanonical,
  SnarkjsProver,
  RapidsnarkProver,
  writeWtnsFile,
  generateWitnessBin,
} = await import("./lib/provers.mjs");
const { summarizeTimings } = await import("./lib/canonical-prover.mjs");

function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

async function main() {
  const paths = resolveArtifacts();
  const input = JSON.parse(fs.readFileSync(paths.input, "utf8"));
  const vkey = JSON.parse(fs.readFileSync(paths.vkey, "utf8"));
  const baseline = JSON.parse(fs.readFileSync(paths.baselineProof, "utf8"));
  const bin = resolveRapidsnarkBin();

  const report = {
    evaluatedAt: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    node: process.version,
    rapidsnarkBin: bin,
    binaryHash: bin && fs.existsSync(bin) && fs.statSync(bin).isFile() ? sha256File(bin) : null,
    available: isRapidsnarkAvailable(),
    classification: null,
    t2_snarkjsVerify: null,
    t4_onChainVerify: null,
    m4_proveP50: null,
    m4_proveP95: null,
    publicSignalsMatch: null,
    artifactHashes: artifactHashes(paths),
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

    report.t2_snarkjsVerify = await snarkjs.groth16.verify(
      vkey,
      result.publicSignals,
      result.proof
    );
    report.publicSignalsMatch = result.publicSignals.every(
      (s, i) => s === baseline.publicSignals[i]
    );

    const witBin = await generateWitnessBin(input, paths);
    const wtns = path.join(paths.scratchDir, "rapidsnark-eval.wtns");
    writeWtnsFile(wtns, witBin);
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      await RapidsnarkProver.prove(paths.zkey, wtns, paths.scratchDir);
      samples.push(Date.now() - t0);
    }
    fs.rmSync(wtns, { force: true });
    const stats = summarizeTimings(samples);
    report.m4_proveP50 = stats.p50;
    report.m4_proveP95 = stats.p95;

    report.status =
      report.t2_snarkjsVerify === true && report.publicSignalsMatch === true ? "PASS" : "FAIL";
    report.classification =
      report.status === "PASS" ? null : report.t2_snarkjsVerify === false ? "proof format" : "wrapper";
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
