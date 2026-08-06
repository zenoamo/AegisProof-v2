#!/usr/bin/env node
// ============================================================================
// Install rapidsnark native prover (Phase 8.10 Finalization)
// ----------------------------------------------------------------------------
// Linux/macOS: git submodule + build_gmp.sh + make host
// Prover output: rapidsnark/package/bin/prover
// Windows: not supported locally (use CI/Linux)
// ============================================================================
import { createHash } from "crypto";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAPIDSNARK_DIR = path.join(ROOT, "rapidsnark");
const PROVER_BIN = path.join(RAPIDSNARK_DIR, "package", "bin", "prover");

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd ?? ROOT,
    shell: false,
    ...opts,
  });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${r.status})`);
  }
}

function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function main() {
  if (process.platform === "win32") {
    console.error(
      "rapidsnark local build is not supported on Windows.\n" +
        "Use Linux CI (prover-benchmark job) or WSL with build-essential/cmake/gmp/libsodium.\n" +
        "Classification: binary issue (platform)"
    );
    process.exit(2);
  }

  if (fs.existsSync(PROVER_BIN)) {
    console.log(`rapidsnark prover already built: ${PROVER_BIN}`);
    console.log(`SHA-256: ${sha256File(PROVER_BIN)}`);
    process.exit(0);
  }

  if (!fs.existsSync(RAPIDSNARK_DIR)) {
    run("git", ["clone", "--depth", "1", "https://github.com/iden3/rapidsnark.git", RAPIDSNARK_DIR]);
  }

  run("git", ["submodule", "update", "--init", "--recursive"], { cwd: RAPIDSNARK_DIR });

  const buildGmp = path.join(RAPIDSNARK_DIR, "build_gmp.sh");
  if (process.platform === "darwin") {
    run("bash", [buildGmp, "macos_arm64"], { cwd: RAPIDSNARK_DIR });
    run("make", ["macos_arm64"], { cwd: RAPIDSNARK_DIR });
  } else {
    run("bash", [buildGmp, "host"], { cwd: RAPIDSNARK_DIR });
    run("make", ["host"], { cwd: RAPIDSNARK_DIR });
  }

  if (!fs.existsSync(PROVER_BIN)) {
    throw new Error(`prover binary not found after build (expected ${PROVER_BIN})`);
  }

  console.log(`\nrapidsnark installed: ${PROVER_BIN}`);
  console.log(`SHA-256: ${sha256File(PROVER_BIN)}`);
  console.log(`export RAPIDSNARK_BIN=${PROVER_BIN}`);
}

main();
