#!/usr/bin/env node
// ============================================================================
// Unified Groth16 prover benchmark runner (Phase 8.10 Phase 2)
// ============================================================================
//
// Modes
//   M1 = fullProve(input, wasm, zkey)
//        Witness generation + snarkjs proving
//
//   M2 = witness generation only
//        generateWitnessBin(input, paths)
//
//   M3 = snarkjs proving only
//        Shared .wtns + snarkjs Groth16 prove
//
//   M4 = rapidsnark proving only
//        Shared .wtns + rapidsnark native prover
//
//   M5 = warm calculator + witness generation + .wtns I/O + snarkjs proving
//
// CI performance comparison intentionally uses M3,M4.
// M1/M2/M5 remain available for targeted/manual regression work.
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  ROOT,
  artifactHashes,
  assertCoreArtifacts,
  resolveArtifacts,
} from "./lib/resolve-artifacts.mjs";

import {
  fullProve,
  generateWitnessBin,
  getCalculator,
  isRapidsnarkAvailable,
  SnarkjsProver,
  RapidsnarkProver,
  writeWtnsFile,
} from "./lib/provers.mjs";

import {
  getEnvironmentSummary,
  summarizeTimings,
} from "./lib/canonical-prover.mjs";

import { buildBaselineV2 } from "./lib/bench-baseline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPORT_DIR = path.join(
  ROOT,
  "benchmarks",
  "reports"
);

const BASELINE_PATH = path.join(
  REPORT_DIR,
  "baseline.json"
);

function parseArgs() {
  const args = process.argv.slice(2);

  // Keep normal/PR benchmark runs lightweight.
  // Full performance benchmark can use --samples 20 or higher.
  let samples = 3;

  let modes = [
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
  ];

  let writeBaseline = false;

  for (let i = 0; i < args.length; i++) {
    if (
      args[i] === "--samples" &&
      args[i + 1]
    ) {
      samples = Number(args[++i]);
    }

    if (
      args[i] === "--modes" &&
      args[i + 1]
    ) {
      modes = args[++i]
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    }

    if (args[i] === "--write-baseline") {
      writeBaseline = true;
    }
  }

  if (
    !Number.isInteger(samples) ||
    samples < 1
  ) {
    throw new Error(
      "--samples must be a positive integer"
    );
  }

  const supportedModes = new Set([
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
  ]);

  for (const mode of modes) {
    if (!supportedModes.has(mode)) {
      throw new Error(
        `Unsupported benchmark mode: ${mode}`
      );
    }
  }

  if (modes.length === 0) {
    throw new Error(
      "--modes must contain at least one mode"
    );
  }

  return {
    samples,
    modes,
    writeBaseline,
  };
}

function modeReport(
  mode,
  samplesMs,
  hashes,
  environment
) {
  const stats = summarizeTimings(samplesMs);

  return {
    mode,
    ...stats,
    zkeyHash: hashes.zkeyHash,
    vkHash: hashes.vkHash,
    inputHash: hashes.inputHash,
    environment,
  };
}

async function benchM1(
  input,
  paths,
  samples
) {
  const times = [];

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const t0 = Date.now();

    await fullProve(
      input,
      paths.wasm,
      paths.zkey
    );

    times.push(
      Date.now() - t0
    );
  }

  return times;
}

async function benchM2(
  input,
  paths,
  samples
) {
  const times = [];

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const t0 = Date.now();

    await generateWitnessBin(
      input,
      paths
    );

    times.push(
      Date.now() - t0
    );
  }

  return times;
}

async function benchM3(
  wtnsPath,
  paths,
  samples
) {
  const times = [];

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const t0 = Date.now();

    await SnarkjsProver.prove(
      paths.zkey,
      wtnsPath
    );

    times.push(
      Date.now() - t0
    );
  }

  return times;
}

async function benchM4(
  wtnsPath,
  paths,
  samples
) {
  const times = [];

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const t0 = Date.now();

    await RapidsnarkProver.prove(
      paths.zkey,
      wtnsPath,
      paths.scratchDir
    );

    times.push(
      Date.now() - t0
    );
  }

  return times;
}

async function benchM5(
  input,
  paths,
  samples
) {
  // getCalculator() is cached by provers.mjs.
  // This keeps calculator initialization outside the measured loop.
  await getCalculator(paths);

  const times = [];

  for (
    let i = 0;
    i < samples;
    i++
  ) {
    const t0 = Date.now();

    const witBin =
      await generateWitnessBin(
        input,
        paths
      );

    const wtnsPath =
      path.join(
        paths.scratchDir,
        `warm-${process.pid}-${i}.wtns`
      );

    writeWtnsFile(
      wtnsPath,
      witBin
    );

    await SnarkjsProver.prove(
      paths.zkey,
      wtnsPath
    );

    fs.rmSync(
      wtnsPath,
      { force: true }
    );

    times.push(
      Date.now() - t0
    );
  }

  return times;
}

async function main() {
  const {
    samples,
    modes,
    writeBaseline,
  } = parseArgs();

  const paths =
    resolveArtifacts();

  assertCoreArtifacts(
    paths
  );

  const input =
    JSON.parse(
      fs.readFileSync(
        paths.input,
        "utf8"
      )
    );

  const hashes =
    artifactHashes(paths);

  const environment =
    getEnvironmentSummary();

  fs.mkdirSync(
    paths.scratchDir,
    { recursive: true }
  );

  // M3/M4 use one shared witness file so their
  // backend proving measurements are directly comparable.
  const sharedWtns =
    path.join(
      paths.scratchDir,
      `bench-shared-${process.pid}.wtns`
    );

  let sharedWtnsCreated = false;

  const needsSharedWtns =
    modes.includes("M3") ||
    modes.includes("M4");

  if (needsSharedWtns) {
    const witBin =
      await generateWitnessBin(
        input,
        paths
      );

    writeWtnsFile(
      sharedWtns,
      witBin
    );

    sharedWtnsCreated = true;
  }

  const results = [];

  console.log(
    `Prover benchmark — samples=${samples}, modes=${modes.join(",")}`
  );

  console.log(
    `zkey hash:  ${hashes.zkeyHash}`
  );

  console.log(
    `vk hash:    ${hashes.vkHash}`
  );

  console.log(
    `wasm hash:  ${hashes.wasmHash}`
  );

  try {
    for (const mode of modes) {
      if (
        mode === "M4" &&
        !isRapidsnarkAvailable()
      ) {
        console.log(
          `SKIP ${mode}: rapidsnark binary not available`
        );

        results.push({
          ...modeReport(
            mode,
            [],
            hashes,
            environment
          ),
          skipped: true,
          reason:
            "rapidsnark binary not available",
        });

        continue;
      }

      console.log(
        `\nRunning ${mode} (${samples} samples)...`
      );

      let times;

      switch (mode) {
        case "M1":
          times =
            await benchM1(
              input,
              paths,
              samples
            );
          break;

        case "M2":
          times =
            await benchM2(
              input,
              paths,
              samples
            );
          break;

        case "M3":
          times =
            await benchM3(
              sharedWtns,
              paths,
              samples
            );
          break;

        case "M4":
          times =
            await benchM4(
              sharedWtns,
              paths,
              samples
            );
          break;

        case "M5":
          times =
            await benchM5(
              input,
              paths,
              samples
            );
          break;

        default:
          throw new Error(
            `Unknown mode: ${mode}`
          );
      }

      const report =
        modeReport(
          mode,
          times,
          hashes,
          environment
        );

      results.push(
        report
      );

      console.log(
        `  p50=${report.p50}ms ` +
        `p95=${report.p95}ms ` +
        `min=${report.min}ms ` +
        `max=${report.max}ms`
      );
    }
  } finally {
    if (sharedWtnsCreated) {
      fs.rmSync(
        sharedWtns,
        { force: true }
      );
    }
  }

  fs.mkdirSync(
    REPORT_DIR,
    { recursive: true }
  );

  const stamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );

  const outPath =
    path.join(
      REPORT_DIR,
      `prover-bench-${stamp}.json`
    );

  const payload = {
    generatedAt:
      new Date().toISOString(),

    phase: "8.10",

    samples,

    modesRequested:
      modes,

    hashes,

    environment,

    modes:
      results,

    proverSummary: {
      snarkjs: {
        proveP50:
          results.find(
            (m) => m.mode === "M3"
          )?.p50 ?? null,

        proveP95:
          results.find(
            (m) => m.mode === "M3"
          )?.p95 ?? null,
      },

      rapidsnark: {
        proveP50:
          results.find(
            (m) => m.mode === "M4"
          )?.p50 ?? null,

        proveP95:
          results.find(
            (m) => m.mode === "M4"
          )?.p95 ?? null,

        skipped:
          results.find(
            (m) => m.mode === "M4"
          )?.skipped ?? true,
      },
    },
  };

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      payload,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `\nReport: ${path.relative(
      ROOT,
      outPath
    )}`
  );

  if (writeBaseline) {
    const baselineDoc =
      buildBaselineV2(
        results,
        hashes,
        environment,
        samples,
        {
          phase: "8.11",
        }
      );

    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        baselineDoc,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `Baseline: ${path.relative(
        ROOT,
        BASELINE_PATH
      )} (schemaVersion=2)`
    );
  }
}

main()
  .then(() => {
    // snarkjs witness-calculator workers can keep the Node event loop alive
    // after the benchmark report has been written. CI must terminate cleanly
    // once all measured work and cleanup are complete; otherwise Actions can
    // wait for the job timeout and report the benchmark as cancelled.
    process.exit(0);
  })
  .catch(
    (err) => {
      console.error(
        "BENCHMARK FAILED:",
        err.message ?? err
      );

      process.exit(1);
    }
  );
