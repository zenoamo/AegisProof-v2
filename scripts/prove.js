/**
 * AegisProof - Groth16 Proof Generation Script
 *
 * Usage:
 *   node scripts/prove.js
 *   node scripts/prove.js --input scripts/input.json
 *   node scripts/prove.js --input path/to/custom_input.json --suffix myproof
 *
 * Outputs:
 *   build/proofs/proof_<suffix>.json
 *   build/proofs/public_<suffix>.json
 *
 * Public Signal Layout (snarkjs: outputs first, then public inputs):
 *
 *   [0]  modelManifestCommitment   <- circuit output
 *   [1]  executionEnvCommitment    <- circuit output
 *   [2]  generationCommitment      <- circuit output
 *   [3]  commitment                <- circuit output
 *   [4]  nullifier                 <- circuit output
 *   [5]  expectedPromptRoot        <- public input
 *   [6]  expectedOutputRoot        <- public input
 *   [7]  sessionId                 <- public input
 *   [8]  purposeId                 <- public input
 *   [9]  weightsHash
 *   [10] tokenizerHash
 *   [11] systemPromptHash
 *   [12] loraHash
 *   [13] adapterHash
 *   [14] safetyLayerHash
 *   [15] quantizationHash
 *   [16] precisionHash
 *   [17] runtimeHash
 *   [18] driverHash
 *   [19] temperature
 *   [20] topP
 *   [21] topK
 *   [22] seed
 *   [23] repetitionPenalty
 *   [24] presencePenalty
 *   [25] frequencyPenalty
 *   [26] maxTokens
 *   [27] protocolVersion
 *   [28] timestamp
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";

// ============================================================
// Paths
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// ============================================================
// Signal Index Constants
// ============================================================

const IDX_MODEL_MANIFEST = 0;
const IDX_EXEC_ENV       = 1;
const IDX_GENERATION     = 2;
const IDX_COMMITMENT     = 3;
const IDX_NULLIFIER      = 4;
const IDX_SESSION_ID     = 7;
const IDX_PURPOSE_ID     = 8;
const EXPECTED_SIGNALS   = 29;

// ============================================================
// CLI Argument Parsing
// ============================================================

function parseArgs() {
  const args   = process.argv.slice(2);
  let inputFile = path.join(ROOT, "scripts", "input.json");
  let suffix    = "29";

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

// ============================================================
// File Assertion
// ============================================================

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  const { inputFile, suffix } = parseArgs();

  const WASM_PATH = path.join(
  ROOT,
  "build",
  "aegis_commit_core_js",
  "aegis_commit_core.wasm"
);

const ZKEY_PATH = path.join(
  ROOT,
  "build",
  "aegis_commit_core.zkey"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "build",
  "proofs"
);

const PROOF_PATH = path.join(
  OUTPUT_DIR,
  `proof_${suffix}.json`
);

const PUBLIC_SIGNALS_PATH = path.join(
  OUTPUT_DIR,
  `public_${suffix}.json`
);

  console.log("==========================================");
  console.log("AegisShield Groth16 Proof Generation");
  console.log("==========================================");
  console.log(`Input  : ${inputFile}`);
  console.log(`WASM   : ${WASM_PATH}`);
  console.log(`ZKey   : ${ZKEY_PATH}`);
  console.log(`Output : ${OUTPUT_DIR}`);

  // ----------------------------------------------------------
  // 1. Check Files
  // ----------------------------------------------------------

  console.log("\n[1] Checking input files");
  assertFile(inputFile);
  assertFile(WASM_PATH);
  assertFile(ZKEY_PATH);
  console.log("All input files found: OK");

  // ----------------------------------------------------------
  // 2. Load Input
  // ----------------------------------------------------------

  console.log("\n[2] Loading circuit input");

  const input = JSON.parse(fs.readFileSync(inputFile, "utf8"));

  const requiredFields = [
    "secretKey", "deviceId",
    "expectedPromptRoot", "expectedOutputRoot",
    "sessionId", "purposeId",
    "weightsHash", "tokenizerHash", "systemPromptHash",
    "loraHash", "adapterHash", "safetyLayerHash",
    "quantizationHash", "precisionHash", "runtimeHash", "driverHash",
    "temperature", "topP", "topK", "seed",
    "repetitionPenalty", "presencePenalty", "frequencyPenalty", "maxTokens",
    "protocolVersion", "timestamp",
  ];

  for (const field of requiredFields) {
    if (input[field] === undefined) {
      throw new Error(`Missing required field in input.json: ${field}`);
    }
  }

  console.log(`  sessionId   : ${input.sessionId}`);
  console.log(`  purposeId   : ${input.purposeId}`);
  console.log(`  secretKey   : [hidden]`);
  console.log(`  deviceId    : ${input.deviceId}`);
  console.log(`  protocolVer : ${input.protocolVersion}`);
  console.log(`  timestamp   : ${input.timestamp}`);

  // ----------------------------------------------------------
  // 3. Generate Proof
  // ----------------------------------------------------------

  console.log("\n[3] Generating Groth16 proof (this may take 30–60 seconds)");

  const startMs = Date.now();

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH,
  );

  const elapsedMs = Date.now() - startMs;
  console.log(`Proof generation completed in ${(elapsedMs / 1000).toFixed(1)}s`);

  // ----------------------------------------------------------
  // 4. Validate Signal Count
  // ----------------------------------------------------------

  console.log("\n[4] Validating public signals");

  if (publicSignals.length !== EXPECTED_SIGNALS) {
    throw new Error(
      `Expected ${EXPECTED_SIGNALS} public signals, got ${publicSignals.length}.\n` +
      `Did you rebuild the ZKey from the latest circuit?`
    );
  }

  console.log(`Signal count: ${publicSignals.length} (OK)`);
  console.log("\nPublic Signals:");

  const LABELS = {
    0: "modelManifestCommitment",
    1: "executionEnvCommitment",
    2: "generationCommitment",
    3: "commitment",
    4: "nullifier",
    5: "expectedPromptRoot",
    6: "expectedOutputRoot",
    7: "sessionId",
    8: "purposeId",
    9: "weightsHash",
    10: "tokenizerHash",
    11: "systemPromptHash",
    12: "loraHash",
    13: "adapterHash",
    14: "safetyLayerHash",
    15: "quantizationHash",
    16: "precisionHash",
    17: "runtimeHash",
    18: "driverHash",
    19: "temperature",
    20: "topP",
    21: "topK",
    22: "seed",
    23: "repetitionPenalty",
    24: "presencePenalty",
    25: "frequencyPenalty",
    26: "maxTokens",
    27: "protocolVersion",
    28: "timestamp",
  };

  publicSignals.forEach((value, index) => {
    const label = LABELS[index] ?? "";
    console.log(`  signals[${String(index).padStart(2, "0")}] = ${value.padStart(78)}  // ${label}`);
  });

  // ----------------------------------------------------------
  // 5. Verify Signal Binding
  // ----------------------------------------------------------

  console.log("\n[5] Verifying signal binding");

  const outSessionId = BigInt(publicSignals[IDX_SESSION_ID]);
  const outPurposeId = BigInt(publicSignals[IDX_PURPOSE_ID]);
  const outCommitment = BigInt(publicSignals[IDX_COMMITMENT]);
  const outNullifier  = BigInt(publicSignals[IDX_NULLIFIER]);

  const inSessionId  = BigInt(input.sessionId);
  const inPurposeId  = BigInt(input.purposeId);

  if (outSessionId !== inSessionId) {
    throw new Error(
      `Session ID mismatch!\n` +
      `  Input  : ${inSessionId}\n` +
      `  signals[${IDX_SESSION_ID}] : ${outSessionId}`
    );
  }

  if (outPurposeId !== inPurposeId) {
    throw new Error(
      `Purpose ID mismatch!\n` +
      `  Input  : ${inPurposeId}\n` +
      `  signals[${IDX_PURPOSE_ID}] : ${outPurposeId}`
    );
  }

  console.log(`  sessionId   : signals[${IDX_SESSION_ID}] = ${outSessionId}  (OK)`);
  console.log(`  purposeId   : signals[${IDX_PURPOSE_ID}] = ${outPurposeId}  (OK)`);
  console.log(`  commitment  : signals[${IDX_COMMITMENT}] = ${outCommitment}`);
  console.log(`  nullifier   : signals[${IDX_NULLIFIER}] = ${outNullifier}`);

  // ----------------------------------------------------------
  // 6. Verify Proof (local, using vkey)
  // ----------------------------------------------------------

  console.log("\n[6] Local proof verification (snarkjs)");

  const vkeyPath = path.join(ROOT, "build", "vkey.json");

  if (fs.existsSync(vkeyPath)) {
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    if (!verified) {
      throw new Error("Local proof verification FAILED. The proof is invalid.");
    }

    console.log("Local proof verification: OK");
  } else {
    console.log(`vkey.json not found at ${vkeyPath}, skipping local verification.`);
    console.log("To enable: snarkjs zkey export verificationkey build/zkey/aegis_final.zkey build/vkey.json");
  }

  // ----------------------------------------------------------
  // 7. Write Output Files
  // ----------------------------------------------------------

  console.log("\n[7] Writing proof files");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2));
  fs.writeFileSync(PUBLIC_SIGNALS_PATH, JSON.stringify(publicSignals, null, 2));

  console.log(`  Proof         : ${PROOF_PATH}`);
  console.log(`  Public signals: ${PUBLIC_SIGNALS_PATH}`);

  // ----------------------------------------------------------
  // Final Summary
  // ----------------------------------------------------------

  console.log("\n==========================================");
  console.log("PROOF GENERATION COMPLETE");
  console.log("==========================================");
  console.log(`  sessionId  : ${outSessionId}`);
  console.log(`  purposeId  : ${outPurposeId}`);
  console.log(`  commitment : ${outCommitment}`);
  console.log(`  nullifier  : ${outNullifier}`);
  console.log("==========================================");
  console.log("\nNext step:");
  console.log("  node test/testVerifyAndAccept.ts");
  console.log("  (or: npm test)");
}

main().catch((error) => {
  console.error("\nPROOF GENERATION FAILED");
  console.error(error.message ?? error);
  process.exit(1);
});
