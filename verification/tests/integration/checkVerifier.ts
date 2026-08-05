import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(
  __dirname,
  ".."
);

const DEPLOYMENT_PATH = path.join(
  PROJECT_ROOT,
  "deployments",
  "localhost.json"
);

async function main() {
const { viem } =
  await network.connect({
    network: "localhost",
  });

  const publicClient =
    await viem.getPublicClient();

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "AegisShield Verifier Diagnostic"
  );
  console.log(
    "=========================================="
  );

  // ==========================================
  // 1. Load deployment info
  // ==========================================

  if (
    !fs.existsSync(
      DEPLOYMENT_PATH
    )
  ) {
    throw new Error(
      `Deployment file not found: ${DEPLOYMENT_PATH}`
    );
  }

  const deployment =
    JSON.parse(
      fs.readFileSync(
        DEPLOYMENT_PATH,
        "utf8"
      )
    );

  const shieldAddress =
    deployment.shieldAddress;

  const verifierAddress =
    deployment.verifierAddress;

  console.log(
    "Deployment file:",
    DEPLOYMENT_PATH
  );

  console.log(
    "Deployment chain ID:",
    deployment.chainId
  );

  console.log(
    "Shield address:",
    shieldAddress
  );

  console.log(
    "Verifier address:",
    verifierAddress
  );

  // ==========================================
  // 2. Check current network
  // ==========================================

  const chainId =
    await publicClient.getChainId();

  console.log("");
  console.log(
    "Current chain ID:",
    chainId
  );

  // ==========================================
  // 3. Check Shield bytecode
  // ==========================================

  const shieldCode =
    await publicClient.getBytecode({
      address:
        shieldAddress,
    });

  console.log("");
  console.log(
    "Shield bytecode length:",
    shieldCode
      ? shieldCode.length
      : 0
  );

  if (
    !shieldCode ||
    shieldCode === "0x"
  ) {
    throw new Error(
      "No Shield bytecode found at deployment address"
    );
  }

  console.log(
    "Shield bytecode: OK"
  );

  // ==========================================
  // 4. Check Verifier bytecode
  // ==========================================

  const verifierCode =
    await publicClient.getBytecode({
      address:
        verifierAddress,
    });

  console.log("");
  console.log(
    "Verifier bytecode length:",
    verifierCode
      ? verifierCode.length
      : 0
  );

  if (
    !verifierCode ||
    verifierCode === "0x"
  ) {
    throw new Error(
      "No Verifier bytecode found at deployment address"
    );
  }

  console.log(
    "Verifier bytecode: OK"
  );

  // ==========================================
  // 5. Get AegisShield contract
  // ==========================================

  const shield =
    await viem.getContractAt(
      "AegisShield",
      shieldAddress
    );

  console.log("");
  console.log(
    "Contract address:",
    shield.address
  );

  // ==========================================
  // 6. Read operator
  // ==========================================

  const operator =
    String(
      await shield.read.operator()
    );

  console.log("");
  console.log(
    "Operator:",
    operator
  );

  // ==========================================
  // 7. Read verifier
  // ==========================================

  console.log("");
  console.log(
    "Reading verifier()..."
  );

  const storedVerifier =
    String(
      await shield.read.verifier()
    );

  console.log(
    "Stored verifier:",
    storedVerifier
  );

  // ==========================================
  // 8. Compare
  // ==========================================

  console.log("");
  console.log(
    "Expected verifier:",
    verifierAddress
  );

  if (
    storedVerifier.toLowerCase() !==
    verifierAddress.toLowerCase()
  ) {
    throw new Error(
      `Verifier mismatch: expected ${verifierAddress}, got ${storedVerifier}`
    );
  }

  console.log("");
  console.log(
    "Verifier binding: OK"
  );

  console.log(
    "=========================================="
  );
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "DIAGNOSTIC FAILED"
    );
    console.error(error);
    process.exitCode = 1;
  }
);