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

  "function deactivateSession(uint256 sessionId) external",

  "function sessionExists(uint256 sessionId) view returns (bool)",

  "function sessions(uint256 sessionId) view returns (uint256 purposeId, bool active)",

  "event SessionRegistered(uint256 indexed sessionId, uint256 indexed purposeId)",

  "event SessionDeactivated(uint256 indexed sessionId)",
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
    `200${Date.now().toString().slice(-6)}`
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
    "AegisShield deactivateSession Test"
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
  // 3. Register Session
  // ==========================================================

  console.log(
    "\n[3] Registering test session"
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

  assert.equal(
    beforeExists,
    false,
    "Test session ID already exists"
  );

  const registerHash =
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
    `Registration transaction: ${registerHash}`
  );

  const registerReceipt =
    await publicClient.waitForTransactionReceipt({
      hash: registerHash,
    });

  assert.equal(
    registerReceipt.status,
    "success",
    "registerSession transaction failed"
  );

  console.log(
    "Session registration: OK"
  );

  // ==========================================================
  // 4. Verify Active Session
  // ==========================================================

  console.log(
    "\n[4] Checking active session"
  );

  const sessionBefore =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessions",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Purpose ID: ${sessionBefore[0]}`
  );

  console.log(
    `Active: ${sessionBefore[1]}`
  );

  assert.equal(
    sessionBefore[0],
    purposeId,
    "Purpose ID mismatch before deactivation"
  );

  assert.equal(
    sessionBefore[1],
    true,
    "Session should be active before deactivation"
  );

  console.log(
    "Session active state: OK"
  );

  // ==========================================================
  // 5. Deactivate Session
  // ==========================================================

  console.log(
    "\n[5] Calling deactivateSession"
  );

  const deactivateHash =
    await walletClient.writeContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "deactivateSession",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Deactivation transaction: ${deactivateHash}`
  );

  const deactivateReceipt =
    await publicClient.waitForTransactionReceipt({
      hash: deactivateHash,
    });

  console.log(
    `Status: ${deactivateReceipt.status}`
  );

  assert.equal(
    deactivateReceipt.status,
    "success",
    "deactivateSession transaction failed"
  );

  console.log(
    "deactivateSession: OK"
  );

  // ==========================================================
  // 6. Verify Session Is Inactive
  // ==========================================================

  console.log(
    "\n[6] Checking session after deactivation"
  );

  const sessionAfter =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessions",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Purpose ID: ${sessionAfter[0]}`
  );

  console.log(
    `Active: ${sessionAfter[1]}`
  );

  assert.equal(
    sessionAfter[0],
    purposeId,
    "Purpose ID changed unexpectedly"
  );

  assert.equal(
    sessionAfter[1],
    false,
    "Session should be inactive after deactivation"
  );

  console.log(
    "Session inactive state: OK"
  );

  // ==========================================================
  // 7. Verify SessionDeactivated Event
  // ==========================================================

  console.log(
    "\n[7] Checking SessionDeactivated event"
  );

  const logs =
    await publicClient.getLogs({
      address: shieldAddress,
      event: {
        type: "event",
        name: "SessionDeactivated",
        inputs: [
          {
            indexed: true,
            name: "sessionId",
            type: "uint256",
          },
        ],
      },
      fromBlock:
        deactivateReceipt.blockNumber,
      toBlock:
        deactivateReceipt.blockNumber,
    });

  const event =
    logs.find(
      (log) =>
        log.transactionHash ===
        deactivateHash
    );

  assert.ok(
    event,
    "SessionDeactivated event was not found"
  );

  assert.equal(
    event.args.sessionId,
    sessionId,
    "SessionDeactivated sessionId mismatch"
  );

  console.log(
    "SessionDeactivated event: OK"
  );

  // ==========================================================
  // 8. Verify Session Still Exists
  // ==========================================================

  console.log(
    "\n[8] Checking sessionExists"
  );

  const existsAfter =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessionExists",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Session exists: ${existsAfter}`
  );

  assert.equal(
    existsAfter,
    true,
    "Session should continue to exist after deactivation"
  );

  console.log(
    "Session existence preserved: OK"
  );

  // ==========================================================
  // 9. Double Deactivation
  // ==========================================================

  console.log(
    "\n[9] Testing double deactivation rejection"
  );

  let rejected = false;

  try {
    const secondHash =
      await walletClient.writeContract({
        address: shieldAddress,
        abi: shieldAbi,
        functionName: "deactivateSession",
        args: [
          sessionId,
        ],
      });

    const secondReceipt =
      await publicClient.waitForTransactionReceipt({
        hash: secondHash,
      });

    assert.equal(
      secondReceipt.status,
      "reverted",
      "Second deactivation unexpectedly succeeded"
    );
  } catch (error) {
    rejected = true;

    console.log(
      "Double deactivation rejected: OK"
    );

    console.log(
      `Expected error: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }

  assert.equal(
    rejected,
    true,
    "Second deactivation should be rejected"
  );

  // ==========================================================
  // Final Result
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    "DEACTIVATE SESSION TEST PASSED"
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
    "Initial active state: OK"
  );

  console.log(
    "Session deactivation: OK"
  );

  console.log(
    "Inactive state: OK"
  );

  console.log(
    "SessionDeactivated event: OK"
  );

  console.log(
    "Session existence preserved: OK"
  );

  console.log(
    "Double deactivation: REJECTED"
  );

  console.log(
    `Registration transaction: ${registerHash}`
  );

  console.log(
    `Deactivation transaction: ${deactivateHash}`
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
      "\nDEACTIVATE SESSION TEST FAILED"
    );

    console.error(error);

    process.exit(1);
  }
);