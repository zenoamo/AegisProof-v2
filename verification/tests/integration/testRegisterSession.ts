import "dotenv/config";

import assert from "node:assert/strict";

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// ============================================================
// Environment
// ============================================================

const RPC_URL =
  process.env.SEPOLIA_RPC_URL;

const PRIVATE_KEY =
  process.env.SEPOLIA_PRIVATE_KEY;

const SHIELD_ADDRESS =
  process.env.AEGIS_SHIELD_ADDRESS;

if (!RPC_URL) {
  throw new Error(
    "SEPOLIA_RPC_URL is not set"
  );
}

if (!PRIVATE_KEY) {
  throw new Error(
    "SEPOLIA_PRIVATE_KEY is not set"
  );
}

if (!SHIELD_ADDRESS) {
  throw new Error(
    "AEGIS_SHIELD_ADDRESS is not set"
  );
}

const shieldAddress =
  SHIELD_ADDRESS as Address;

const account =
  privateKeyToAccount(
    PRIVATE_KEY as Hex
  );

// ============================================================
// ABI
// ============================================================

const shieldAbi = parseAbi([
  "function operator() view returns (address)",

  "function registerSession(uint256 sessionId, uint256 purposeId) external",

  "function sessionExists(uint256 sessionId) view returns (bool)",

  "function sessions(uint256 sessionId) view returns (uint256 purposeId, bool active)",

  "event SessionRegistered(uint256 indexed sessionId, uint256 indexed purposeId)",
]);

// ============================================================
// Clients
// ============================================================

const publicClient =
  createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

const walletClient =
  createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  });

// ============================================================
// Test Values
// ============================================================

const sessionId =
  BigInt(
    `100${Date.now().toString().slice(-6)}`
  );

const purposeId = 0n;

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "AegisShield registerSession Test"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Shield: ${shieldAddress}`
  );

  console.log(
    `Caller: ${account.address}`
  );

  console.log(
    `Session ID: ${sessionId}`
  );

  console.log(
    `Purpose ID: ${purposeId}`
  );

  // ==========================================================
  // 1. Contract existence
  // ==========================================================

  console.log(
    "\n[1] Checking contract"
  );

  const code =
    await publicClient.getBytecode({
      address: shieldAddress,
    });

  assert.ok(
    code && code !== "0x",
    "No contract found at SHIELD_ADDRESS"
  );

  console.log(
    "AegisShield contract found: OK"
  );

  // ==========================================================
  // 2. Check operator
  // ==========================================================

  console.log(
    "\n[2] Checking operator"
  );

  const operator =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "operator",
    });

  console.log(
    `Contract operator: ${operator}`
  );

  console.log(
    `Current account: ${account.address}`
  );

  assert.equal(
    operator.toLowerCase(),
    account.address.toLowerCase(),
    "Configured private key is not the contract operator"
  );

  console.log(
    "Operator check: OK"
  );

  // ==========================================================
  // 3. Check session before registration
  // ==========================================================

  console.log(
    "\n[3] Checking session before registration"
  );

  const beforeExists =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessionExists",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Session exists before registration: ${beforeExists}`
  );

  assert.equal(
    beforeExists,
    false,
    "Test session ID already exists. Use another session ID."
  );

  // ==========================================================
  // 4. registerSession
  // ==========================================================
console.log(
  `Session ID: ${sessionId}`
);

console.log(
  `Purpose ID: ${purposeId}`
);

assert.equal(
  purposeId,
  0n,
  "Expected purposeId to be 0"
);

  console.log(
    "\n[4] Calling registerSession"
  );

  const hash =
    await walletClient.writeContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "registerSession",
      args: [
        sessionId,
        purposeId,
      ],
    });

  console.log(
    `Transaction: ${hash}`
  );

  const receipt =
    await publicClient.waitForTransactionReceipt({
      hash,
    });

  console.log(
    `Status: ${receipt.status}`
  );

  assert.equal(
    receipt.status,
    "success",
    "registerSession transaction failed"
  );

  console.log(
    "registerSession: OK"
  );

  // ==========================================================
  // 5. Verify sessionExists
  // ==========================================================

  console.log(
    "\n[5] Checking sessionExists after registration"
  );

  const afterExists =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessionExists",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Session exists: ${afterExists}`
  );

  assert.equal(
    afterExists,
    true,
    "Session should exist after registration"
  );

  console.log(
    "sessionExists: OK"
  );

  // ==========================================================
  // 6. Read Session
  // ==========================================================

  console.log(
    "\n[6] Reading session data"
  );

  const session =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessions",
      args: [
        sessionId,
      ],
    });

  const registeredPurposeId =
    session[0];

  const active =
    session[1];

  console.log(
    `Purpose ID: ${registeredPurposeId}`
  );

  console.log(
    `Active: ${active}`
  );

  assert.equal(
    registeredPurposeId,
    purposeId,
    "Registered purpose ID mismatch"
  );

  assert.equal(
    active,
    true,
    "Newly registered session should be active"
  );

  console.log(
    "Session data: OK"
  );

  // ==========================================================
  // 7. SessionRegistered Event
  // ==========================================================

  console.log(
    "\n[7] Checking SessionRegistered event"
  );

  const logs =
    await publicClient.getLogs({
      address: shieldAddress,
      event: {
        type: "event",
        name: "SessionRegistered",
        inputs: [
          {
            indexed: true,
            name: "sessionId",
            type: "uint256",
          },
          {
            indexed: true,
            name: "purposeId",
            type: "uint256",
          },
        ],
      },
      fromBlock:
        receipt.blockNumber,
      toBlock:
        receipt.blockNumber,
    });

  const event =
    logs.find(
      (log) =>
        log.transactionHash === hash
    );

  assert.ok(
    event,
    "SessionRegistered event was not found"
  );

  assert.equal(
    event.args.sessionId,
    sessionId,
    "SessionRegistered sessionId mismatch"
  );

  assert.equal(
    event.args.purposeId,
    purposeId,
    "SessionRegistered purposeId mismatch"
  );

  console.log(
    "SessionRegistered event: OK"
  );

  // ==========================================================
  // 8. Final Result
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    "REGISTER SESSION TEST PASSED"
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Contract existence: OK"
  );

  console.log(
    "Operator authorization: OK"
  );

  console.log(
    "Session registration: OK"
  );

  console.log(
    "Session exists: OK"
  );

  console.log(
    "Purpose ID binding: OK"
  );

  console.log(
    "Session active state: OK"
  );

  console.log(
    "SessionRegistered event: OK"
  );

  console.log(
    `Transaction: ${hash}`
  );

  console.log(
    `Session ID: ${sessionId}`
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
      "\nREGISTER SESSION TEST FAILED"
    );

    console.error(error);

    process.exit(1);
  }
);