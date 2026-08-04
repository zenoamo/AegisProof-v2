import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPoseidon } from "circomlibjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function hashTree(poseidon, leaves) {
  let level = leaves.map((value) => BigInt(value));

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      throw new Error(
        `Tree level must contain an even number of nodes. Got: ${level.length}`
      );
    }

    const nextLevel = [];

    for (let i = 0; i < level.length; i += 2) {
      const hash = poseidon([
        level[i],
        level[i + 1],
      ]);

      nextLevel.push(
        poseidon.F.toObject(hash)
      );
    }

    level = nextLevel;
  }

  return level[0].toString();
}

async function main() {
  const poseidon = await buildPoseidon();

  // ==========================================
  // Test Prompt / Output
  // ==========================================

  const prompt = [
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16,
  ];

  const output = [
    101, 102, 103, 104,
    105, 106, 107, 108,
    109, 110, 111, 112,
    113, 114, 115, 116,
  ];

  // ==========================================
  // Generate Merkle Roots
  // ==========================================

  const promptRoot = await hashTree(
    poseidon,
    prompt
  );

  const outputRoot = await hashTree(
    poseidon,
    output
  );

  console.log("PromptRoot :", promptRoot);
  console.log("OutputRoot:", outputRoot);

  // ==========================================
  // AegisCommitCore Input
  // ==========================================

  const input = {
    // ========================================
    // Private Inputs
    // ========================================

    secretKey: "123456789",
    deviceId: "987654321",

    // ========================================
    // Public Inputs
    // ========================================

    purposeId: "0",

    // Data Identity
    expectedPromptRoot: promptRoot,
    expectedOutputRoot: outputRoot,
    sessionId: "2",

    // ========================================
    // Model Manifest
    // ========================================

    weightsHash: "1001",
    tokenizerHash: "1002",
    systemPromptHash: "1003",
    loraHash: "1004",
    adapterHash: "1005",
    safetyLayerHash: "1006",

    // ========================================
    // Execution Environment
    // ========================================

    quantizationHash: "2001",
    precisionHash: "2002",
    runtimeHash: "2003",
    driverHash: "2004",

    // ========================================
    // Generation Parameters
    // ========================================

    temperature: "70",
    topP: "90",
    topK: "40",
    seed: "12345",
    repetitionPenalty: "100",
    presencePenalty: "0",
    frequencyPenalty: "0",
    maxTokens: "512",

    // ========================================
    // Metadata
    // ========================================

    protocolVersion: "1",
    timestamp: "1750000000",
  };

  // ==========================================
  // Output Path
  // ==========================================

  const outputDir = path.join(
    __dirname,
    "../build/proofs"
  );

  const outputPath = path.join(
    outputDir,
    "aegis_commit_input.json"
  );

  // ==========================================
  // Ensure Output Directory Exists
  // ==========================================

  fs.mkdirSync(outputDir, {
    recursive: true,
  });

  // ==========================================
  // Write Input JSON
  // ==========================================

  fs.writeFileSync(
    outputPath,
    JSON.stringify(input, null, 2),
    "utf8"
  );

  console.log("");
  console.log("[OK] AegisCommitCore input generated.");
  console.log("");
  console.log("Output:");
  console.log(outputPath);
  console.log("");
  console.log("Public inputs:");
  console.log("  purposeId:", input.purposeId);
  console.log("  sessionId:", input.sessionId);
  console.log(
    "  expectedPromptRoot:",
    input.expectedPromptRoot
  );
  console.log(
    "  expectedOutputRoot:",
    input.expectedOutputRoot
  );
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
});

