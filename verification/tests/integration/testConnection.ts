
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPublicClient,
  http,
  getAddress,
  parseAbi,
} from "viem";

import { sepolia } from "viem/chains";

// ============================================================
// Load root .env
//
// test/testConnection.ts
// -> ../.env
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// ============================================================
// Environment
// ============================================================

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const SHIELD_ADDRESS = process.env.SHIELD_ADDRESS;

if (!RPC_URL) {
  throw new Error(
    "SEPOLIA_RPC_URL is not set"
  );
}

if (!SHIELD_ADDRESS) {
  throw new Error(
    "AEGIS_SHIELD_ADDRESS is not set"
  );
}

const shieldAddress =
  getAddress(SHIELD_ADDRESS);

// ============================================================
// ABI
// ============================================================

const aegisShieldAbi = parseAbi([
  "function sessionExists(uint256) view returns (bool)",
  "function sessions(uint256) view returns (uint256 purposeId, bool active)",
]);

// ============================================================
// Client
// ============================================================

const client =
  createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "AegisShield Connection Test"
  );

  console.log(
    "=========================================="
  );

  // ==========================================================
  // 1. Sepolia RPC Connection
  // ==========================================================

  console.log(
    "\n[1] Connecting to Sepolia..."
  );

  const blockNumber =
    await client.getBlockNumber();

  console.log(
    "Connected!"
  );

  console.log(
    "Current block:",
    blockNumber
  );

  // ==========================================================
  // 2. Shield Address
  // ==========================================================

  console.log(
    "\n[2] AegisShield Address"
  );

  console.log(
    shieldAddress
  );

  // ==========================================================
  // 3. Contract Existence Check
  // ==========================================================

  console.log(
    "\n[3] Checking Contract"
  );

  const code =
    await client.getBytecode({
      address: shieldAddress,
    });

  if (!code || code === "0x") {
    throw new Error(
      "No contract found at AEGIS_SHIELD_ADDRESS"
    );
  }

  console.log(
    "AegisShield contract found!"
  );

  console.log(
    "Bytecode length:",
    code.length
  );

  // ==========================================================
  // 4. Session Read Test
  // ==========================================================

  const sessionId =
    1001n;

  console.log(
    "\n[4] Testing Session Registry"
  );

  console.log(
    "Session ID:",
    sessionId
  );

  // ----------------------------------------------------------
  // 4-1. sessionExists()
  // ----------------------------------------------------------

  const exists =
    await client.readContract({
      address: shieldAddress,
      abi: aegisShieldAbi,
      functionName: "sessionExists",
      args: [
        sessionId,
      ],
    });

  console.log(
    "Session exists:",
    exists
  );

  // ----------------------------------------------------------
  // 4-2. sessions()
  // ----------------------------------------------------------

  if (exists) {
    const session =
      await client.readContract({
        address: shieldAddress,
        abi: aegisShieldAbi,
        functionName: "sessions",
        args: [
          sessionId,
        ],
      });

    console.log(
      "Purpose ID:",
      session[0]
    );

    console.log(
      "Active:",
      session[1]
    );
  } else {
    console.log(
      "Session does not exist."
    );

    console.log(
      "Skipping sessions() read."
    );
  }

  // ==========================================================
  // Final Result
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    "CONNECTION TEST PASSED"
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Sepolia RPC: OK"
  );

  console.log(
    "AegisShield contract: OK"
  );

  console.log(
    "Session Registry read: OK"
  );

  console.log(
    "=========================================="
  );
}

// ============================================================
// Execute
// ============================================================

main().catch(
  (error) => {
    console.error(
      "\nCONNECTION TEST FAILED"
    );

    console.error(error);

    process.exit(1);
  }
);

