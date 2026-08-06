/**
 * AegisProof - Groth16 Proof Generation Script (canonical path)
 *
 * Usage:
 *   node scripts/prove.js
 *   node scripts/prove.js --input artifacts/phase2/tests/input_v2.json
 *   node scripts/prove.js --suffix production-smoke
 *   AEGIS_PROVER=rapidsnark node scripts/prove.js
 *
 * Path: witness generation -> groth16.prove(zkey, wtns) -> snarkjs verify
 * Prover backend: AEGIS_PROVER=snarkjs|rapidsnark (default: snarkjs)
 *
 * Outputs:
 *   build/proofs/proof_<suffix>.json
 *   build/proofs/public_<suffix>.json
 *
 * Public Signal Layout (v2 SSoT — 30 signals):
 *   See generated/AegisSignals.ts SIGNAL_INDEX
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_PUBLIC_SIGNALS,
  ROOT,
  getProverName,
  proveCanonical,
  resolveArtifactPaths,
} from "./lib/canonical-prover.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIGNAL_LABELS = {
  0: "expectedPromptRoot",
  1: "expectedOutputRoot",
  2: "sessionId",
  3: "purposeId",
  4: "weightsHash",
  5: "tokenizerHash",
  6: "systemPromptHash",
  7: "loraHash",
  8: "adapterHash",
  9: "safetyLayerHash",
  10: "quantizationHash",
  11: "precisionHash",
  12: "runtimeHash",
  13: "driverHash",
  14: "temperature",
  15: "topP",
  16: "topK",
  17: "seed",
  18: "repetitionPenalty",
  19: "presencePenalty",
  20: "frequencyPenalty",
  21: "maxTokens",
  22: "chainId",
  23: "protocolVersion",
  24: "timestamp",
  25: "modelManifestCommitment",
  26: "executionEnvCommitment",
  27: "generationCommitment",
  28: "commitment",
  29: "nullifier",
};

function parseArgs() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let suffix = "v2";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      inputFile = path.resolve(args[++i]);
    }
    if (args[i] === "--suffix" && args[i + 1]) {
      suffix = args[++i];
    }
  }

  return { inputFile, suffix };
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

async function main() {
  const { inputFile, suffix } = parseArgs();
  const paths = resolveArtifactPaths(
    inputFile ? { input: inputFile } : {}
  );
  const prover = getProverName();

  const OUTPUT_DIR = path.join(ROOT, "build", "proofs");
  const PROOF_PATH = path.join(OUTPUT_DIR, `proof_${suffix}.json`);
  const PUBLIC_SIGNALS_PATH = path.join(OUTPUT_DIR, `public_${suffix}.json`);

  console.log("==========================================");
  console.log("AegisProof Groth16 Proof Generation");
  console.log("==========================================");
  console.log(`Prover : ${prover}`);
  console.log(`Input  : ${paths.input}`);
  console.log(`WASM   : ${paths.wasm}`);
  console.log(`ZKey   : ${paths.zkey}`);
  console.log(`VKey   : ${paths.vkey}`);
  console.log(`Output : ${OUTPUT_DIR}`);

  console.log("\n[1] Checking input files");
  assertFile(paths.input);
  console.log("Input file found: OK");

  console.log("\n[2] Loading circuit input");
  const input = JSON.parse(fs.readFileSync(paths.input, "utf8"));

  const requiredFields = [
    "secretKey",
    "deviceId",
    "expectedPromptRoot",
    "expectedOutputRoot",
    "sessionId",
    "purposeId",
    "weightsHash",
    "tokenizerHash",
    "systemPromptHash",
    "loraHash",
    "adapterHash",
    "safetyLayerHash",
    "quantizationHash",
    "precisionHash",
    "runtimeHash",
    "driverHash",
    "temperature",
    "topP",
    "topK",
    "seed",
    "repetitionPenalty",
    "presencePenalty",
    "frequencyPenalty",
    "maxTokens",
    "chainId",
    "protocolVersion",
    "timestamp",
    "modelManifestCommitment",
    "executionEnvCommitment",
    "generationCommitment",
    "commitment",
    "nullifier",
  ];

  for (const field of requiredFields) {
    if (input[field] === undefined) {
      throw new Error(`Missing required field in input: ${field}`);
    }
  }

  console.log(`  sessionId   : ${input.sessionId}`);
  console.log(`  purposeId   : ${input.purposeId}`);
  console.log(`  chainId     : ${input.chainId}`);
  console.log(`  protocolVer : ${input.protocolVersion}`);
  console.log(`  timestamp   : ${input.timestamp}`);

  console.log("\n[3] Canonical prove path (witness -> prove -> verify)");
  const startMs = Date.now();

  const result = await proveCanonical(input, {
    paths,
    backend: prover,
    measure: true,
    verify: true,
  });

  const elapsedMs = Date.now() - startMs;
  const { proof, publicSignals, timings, hashes } = result;

  console.log(`  witness : ${(timings.witnessMs / 1000).toFixed(3)}s`);
  console.log(`  prove   : ${(timings.proveMs / 1000).toFixed(3)}s`);
  console.log(`  verify  : ${(timings.verifyMs / 1000).toFixed(3)}s`);
  console.log(`  total   : ${(elapsedMs / 1000).toFixed(3)}s`);

  console.log("\n[4] Validating public signals");
  if (publicSignals.length !== EXPECTED_PUBLIC_SIGNALS) {
    throw new Error(
      `Expected ${EXPECTED_PUBLIC_SIGNALS} public signals, got ${publicSignals.length}`
    );
  }

  console.log(`Signal count: ${publicSignals.length} (OK)`);
  publicSignals.forEach((value, index) => {
    const label = SIGNAL_LABELS[index] ?? "";
    console.log(
      `  signals[${String(index).padStart(2, "0")}] = ${value.padStart(78)}  // ${label}`
    );
  });

  console.log("\n[5] Verifying signal binding");
  const outSessionId = BigInt(publicSignals[2]);
  const outPurposeId = BigInt(publicSignals[3]);
  const outCommitment = BigInt(publicSignals[28]);
  const outNullifier = BigInt(publicSignals[29]);

  if (outSessionId !== BigInt(input.sessionId)) {
    throw new Error(`Session ID mismatch: input=${input.sessionId} output=${outSessionId}`);
  }
  if (outPurposeId !== BigInt(input.purposeId)) {
    throw new Error(`Purpose ID mismatch: input=${input.purposeId} output=${outPurposeId}`);
  }

  console.log(`  sessionId   : signals[2] = ${outSessionId}  (OK)`);
  console.log(`  purposeId   : signals[3] = ${outPurposeId}  (OK)`);
  console.log(`  commitment  : signals[28] = ${outCommitment}`);
  console.log(`  nullifier   : signals[29] = ${outNullifier}`);

  console.log("\n[6] Writing proof files");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2));
  fs.writeFileSync(PUBLIC_SIGNALS_PATH, JSON.stringify(publicSignals, null, 2));

  console.log(`  Proof         : ${PROOF_PATH}`);
  console.log(`  Public signals: ${PUBLIC_SIGNALS_PATH}`);
  console.log(`  zkey hash     : ${hashes.zkeyHash}`);
  console.log(`  vkey hash     : ${hashes.vkHash}`);
  console.log(`  input hash    : ${hashes.inputHash}`);

  console.log("\n==========================================");
  console.log("PROOF GENERATION COMPLETE");
  console.log("==========================================");
}

main().catch((error) => {
  console.error("\nPROOF GENERATION FAILED");
  console.error(error.message ?? error);
  process.exit(1);
});
