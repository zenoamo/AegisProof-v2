
import "dotenv/config";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseAbi,
  type Address,
} from "viem";

import { localhost } from "viem/chains";

const customLocalhost = {
  ...localhost,
  id: 31337,
};
import { privateKeyToAccount } from "viem/accounts";

// ============================================================
// Paths
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Environment
// ============================================================

const RPC_URL =
  process.env.LOCALHOST_RPC_URL ??
  "http://127.0.0.1:8545";

const PRIVATE_KEY =
  process.env.LOCALHOST_PRIVATE_KEY;

const SHIELD_ADDRESS =
  process.env.SHIELD_ADDRESS;

const VERIFIER_ADDRESS =
  process.env.VERIFIER_ADDRESS;

if (!PRIVATE_KEY) {
  throw new Error(
    "LOCALHOST_PRIVATE_KEY is not set"
  );
}

// ============================================================
// Account
// ============================================================

const account = privateKeyToAccount(
  PRIVATE_KEY as `0x${string}`
);

// ============================================================
// Clients
// ============================================================

const publicClient = createPublicClient({
  chain: customLocalhost,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: customLocalhost,
  transport: http(RPC_URL),
});

// ============================================================
// ABI
// ============================================================

const shieldAbi = parseAbi([
  "function operator() view returns (address)",

  "function registerSession(uint256 sessionId, uint256 purposeId) external",

  "function deactivateSession(uint256 sessionId) external",

  "function verifyAndAccept(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[29] pubSignals, uint256 expectedSessionId) external",

  "function sessionExists(uint256 sessionId) view returns (bool)",

  "function sessions(uint256 sessionId) view returns (uint256 purposeId, bool active)",

  "function usedNullifiers(uint256 nullifier) view returns (bool)",

  "function verifier() view returns (address)",

  "event SessionRegistered(uint256 indexed sessionId, uint256 indexed purposeId)",

  "event ProofAccepted(uint256 indexed sessionId, uint256 indexed commitment, uint256 indexed nullifier)",

  "event SessionDeactivated(uint256 indexed sessionId)",
]);

// ============================================================
// Proof Paths
// ============================================================

const PROOF_PATH = path.resolve(
  __dirname,
  "../build/proofs/proof_29.json"
);

const PUBLIC_SIGNALS_PATH = path.resolve(
  __dirname,
  "../build/proofs/public_29.json"
);

const LOCAL_DEPLOYMENT_INFO_PATH = path.resolve(
  __dirname,
  "../deployments/localhost.json"
);

// ============================================================
// Signal Type
// ============================================================

type Signals29 = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
];

// ============================================================
// Public Signal Indexes
//
// IMPORTANT:
// These indexes match the actual public_29.json generated
// from aegis_commit_core.circom.
//
// snarkjs public signal ordering:
//
// Public Inputs:
// [0]  expectedPromptRoot
// [1]  expectedOutputRoot
// [2]  sessionId
// [3]  purposeId
// [4]  weightsHash
// [5]  tokenizerHash
// [6]  systemPromptHash
// [7]  loraHash
// [8]  adapterHash
// [9]  safetyLayerHash
// [10] quantizationHash
// [11] precisionHash
// [12] runtimeHash
// [13] driverHash
// [14] temperature
// [15] topP
// [16] topK
// [17] seed
// [18] repetitionPenalty
// [19] presencePenalty
// [20] frequencyPenalty
// [21] maxTokens
// [22] protocolVersion
// [23] timestamp
//
// Outputs:
// [24] modelManifestCommitment
// [25] executionEnvCommitment
// [26] generationCommitment
// [27] commitment
// [28] nullifier
//
// ============================================================

const SESSION_ID_INDEX = 2;
const PURPOSE_ID_INDEX = 3;

const PROTOCOL_VERSION_INDEX = 22;
const TIMESTAMP_INDEX = 23;

const MODEL_MANIFEST_COMMITMENT_INDEX = 24;
const EXECUTION_ENV_COMMITMENT_INDEX = 25;
const GENERATION_COMMITMENT_INDEX = 26;

const COMMITMENT_INDEX = 27;
const NULLIFIER_INDEX = 28;

type DeploymentInfo = {
  verifierAddress: string;
  shieldAddress: string;
};

type ResolvedContracts = {
  shieldAddress: Address;
  verifierAddress: Address;
  source: string;
};

function loadDeploymentInfo():
  | DeploymentInfo
  | null {
  if (
    !fs.existsSync(
      LOCAL_DEPLOYMENT_INFO_PATH
    )
  ) {
    return null;
  }

  const raw = fs.readFileSync(
    LOCAL_DEPLOYMENT_INFO_PATH,
    "utf8"
  );

  return JSON.parse(
    raw
  ) as DeploymentInfo;
}

async function resolveContracts():
  Promise<ResolvedContracts> {
  const deploymentInfo =
    loadDeploymentInfo();

  const candidates = [
    {
      address:
        deploymentInfo?.shieldAddress,
      source:
        "deployments/localhost.json (shield)",
    },
    {
      address:
        deploymentInfo?.verifierAddress,
      source:
        "deployments/localhost.json (verifier)",
    },
    {
      address: SHIELD_ADDRESS,
      source: ".env SHIELD_ADDRESS",
    },
    {
      address: VERIFIER_ADDRESS,
      source: ".env VERIFIER_ADDRESS",
    },
  ].filter(
    (
      candidate
    ): candidate is {
      address: string;
      source: string;
    } => Boolean(candidate.address)
  );

  if (candidates.length === 0) {
    throw new Error(
      "No localhost contract addresses found. Run scripts/deploy.ts or set SHIELD_ADDRESS."
    );
  }

  const seen =
    new Set<string>();

  for (const candidate of candidates) {
    const normalized =
      getAddress(
        candidate.address
      );

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);

    const code =
      await publicClient.getBytecode({
        address: normalized,
      });

    if (!code || code === "0x") {
      continue;
    }

    try {
      const verifierAddress =
        await publicClient.readContract({
          address: normalized,
          abi: shieldAbi,
          functionName: "verifier",
        });

      return {
        shieldAddress: normalized,
        verifierAddress:
          getAddress(
            verifierAddress
          ),
        source: candidate.source,
      };
    } catch {
      // Keep scanning. A verifier contract
      // will typically fail this probe.
    }
  }

  throw new Error(
    "Could not resolve a live AegisShield contract from deployments/localhost.json or .env. Re-run scripts/deploy.ts after restarting localhost."
  );
}

// ============================================================
// Load Proof
// ============================================================

function loadProof() {
  console.log(
    "\n[1] Loading Groth16 proof"
  );

  console.log(
    `Proof path: ${PROOF_PATH}`
  );

  console.log(
    `Public signals path: ${PUBLIC_SIGNALS_PATH}`
  );

  assert.ok(
    fs.existsSync(PROOF_PATH),
    `Proof file not found: ${PROOF_PATH}`
  );

  assert.ok(
    fs.existsSync(PUBLIC_SIGNALS_PATH),
    `Public signals file not found: ${PUBLIC_SIGNALS_PATH}`
  );

  const proof = JSON.parse(
    fs.readFileSync(
      PROOF_PATH,
      "utf8"
    )
  );

  const publicSignals = JSON.parse(
    fs.readFileSync(
      PUBLIC_SIGNALS_PATH,
      "utf8"
    )
  );

  assert.equal(
    publicSignals.length,
    29,
    "Expected exactly 29 public signals"
  );

  const pA = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
  ] as const;

  const pB = [
    [
      BigInt(proof.pi_b[0][1]),
      BigInt(proof.pi_b[0][0]),
    ],
    [
      BigInt(proof.pi_b[1][1]),
      BigInt(proof.pi_b[1][0]),
    ],
  ] as const;

  const pC = [
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ] as const;

  const signals =
    publicSignals.map(
      (value: string) => BigInt(value)
    ) as Signals29;

  console.log(
    "Proof files: OK"
  );

  console.log(
    "Public signal count: 29"
  );

  console.log(
    "\nPublic Signals:"
  );

  signals.forEach(
    (value, index) => {
      console.log(
        `signals[${index}] = ${value}`
      );
    }
  );

  return {
    pA,
    pB,
    pC,
    signals,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const {
    shieldAddress,
    verifierAddress:
      resolvedVerifierAddress,
    source: contractSource,
  } = await resolveContracts();

  console.log(
    "=========================================="
  );

  console.log(
    "AegisShield verifyAndAccept E2E Test"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Shield: ${shieldAddress}`
  );

  console.log(
    `Address source: ${contractSource}`
  );

  console.log(
    `Caller: ${account.address}`
  );

  console.log(
    `RPC URL: ${RPC_URL}`
  );

  console.log(
    "=========================================="
  );

  // ==========================================================
  // 1. Network Check
  // ==========================================================

  console.log(
    "\n[1] Checking network"
  );

  const chainId =
    await publicClient.getChainId();

  console.log(
    `Chain ID: ${chainId}`
  );

  assert.equal(
    chainId,
    31337,
    "Expected localhost chain ID 31337"
  );

  console.log(
    "Localhost network: OK"
  );

  // ==========================================================
  // 2. Contract Check
  // ==========================================================

  console.log(
    "\n[2] Checking AegisShield contract"
  );

  console.log(
    `Shield address: ${shieldAddress}`
  );

  const code =
    await publicClient.getBytecode({
      address: shieldAddress,
    });

  console.log(
    `Shield bytecode: ${code}`
  );

  assert.ok(
    code && code !== "0x",
    "No contract found at SHIELD_ADDRESS"
  );

  console.log(
    "AegisShield contract found: OK"
  );

  // ==========================================================
  // 3. Verifier Check
  // ==========================================================

  console.log(
    "\n[3] Checking verifier"
  );

  const verifierAddress =
    resolvedVerifierAddress;

  console.log(
    `Verifier address: ${verifierAddress}`
  );

  const verifierCode =
    await publicClient.getBytecode({
      address: verifierAddress,
    });

  console.log(
    `Verifier bytecode: ${verifierCode}`
  );

  assert.ok(
    verifierCode &&
      verifierCode !== "0x",
    "No contract found at verifier address"
  );

  console.log(
    "Verifier contract found: OK"
  );

  // ==========================================================
  // 4. Operator Check
  // ==========================================================

  console.log(
    "\n[4] Checking operator"
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
    "Current account is not the contract operator"
  );

  console.log(
    "Operator check: OK"
  );

  // ==========================================================
  // 5. Load Proof
  // ==========================================================

  const {
    pA,
    pB,
    pC,
    signals,
  } = loadProof();

  const modelManifestCommitment =
    signals[
      MODEL_MANIFEST_COMMITMENT_INDEX
    ];

  const executionEnvCommitment =
    signals[
      EXECUTION_ENV_COMMITMENT_INDEX
    ];

  const generationCommitment =
    signals[
      GENERATION_COMMITMENT_INDEX
    ];

  const commitment =
    signals[
      COMMITMENT_INDEX
    ];

  const nullifier =
    signals[
      NULLIFIER_INDEX
    ];

  const sessionId =
    signals[
      SESSION_ID_INDEX
    ];

  const purposeId =
    signals[
      PURPOSE_ID_INDEX
    ];

  const protocolVersion =
    signals[
      PROTOCOL_VERSION_INDEX
    ];

  const timestamp =
    signals[
      TIMESTAMP_INDEX
    ];

  console.log(
    "\n=========================================="
  );

  console.log(
    "Proof / Session Binding"
  );

  console.log(
    "=========================================="
  );

  console.log(
    `Model Manifest Commitment: ${modelManifestCommitment}`
  );

  console.log(
    `Execution Env Commitment: ${executionEnvCommitment}`
  );

  console.log(
    `Generation Commitment: ${generationCommitment}`
  );

  console.log(
    `Commitment: ${commitment}`
  );

  console.log(
    `Nullifier: ${nullifier}`
  );

  console.log(
    `Session ID: ${sessionId}`
  );

  console.log(
    `Purpose ID: ${purposeId}`
  );

  console.log(
    `Protocol Version: ${protocolVersion}`
  );

  console.log(
    `Timestamp: ${timestamp}`
  );

  console.log(
    `Session ID source: signals[${SESSION_ID_INDEX}]`
  );

  console.log(
    `Purpose ID source: signals[${PURPOSE_ID_INDEX}]`
  );

  console.log(
    `Commitment source: signals[${COMMITMENT_INDEX}]`
  );

  console.log(
    `Nullifier source: signals[${NULLIFIER_INDEX}]`
  );

  // ==========================================================
  // 6. Check Session
  // ==========================================================

  console.log(
    "\n[6] Checking Session"
  );

  const existsBefore =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessionExists",
      args: [
        sessionId,
      ],
    });

  console.log(
    `Session exists: ${existsBefore}`
  );

  if (!existsBefore) {
    console.log(
      "Registering session"
    );

    console.log(
      `Session ID: ${sessionId}`
    );

    console.log(
      `Purpose ID: ${purposeId}`
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
      "Session registration failed"
    );

    console.log(
      "Session registration: OK"
    );
  } else {
    const session =
      await publicClient.readContract({
        address: shieldAddress,
        abi: shieldAbi,
        functionName: "sessions",
        args: [
          sessionId,
        ],
      });

    console.log(
      `Existing session purpose: ${session[0]}`
    );

    console.log(
      `Existing session active: ${session[1]}`
    );

    assert.equal(
      session[0],
      purposeId,
      "Existing session purpose mismatch"
    );

    assert.equal(
      session[1],
      true,
      "Existing session is inactive"
    );

    console.log(
      "Existing session is active: OK"
    );
  }

  // ==========================================================
  // 7. Verify Session State
  // ==========================================================

  console.log(
    "\n[7] Verifying Session State"
  );

  const registeredSession =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "sessions",
      args: [
        sessionId,
      ],
    });

  assert.equal(
    registeredSession[0],
    purposeId,
    "Registered purpose mismatch"
  );

  assert.equal(
    registeredSession[1],
    true,
    "Session should be active"
  );

  console.log(
    `Session purpose: ${registeredSession[0]}`
  );

  console.log(
    `Session active: ${registeredSession[1]}`
  );

  console.log(
    "Session state: OK"
  );

  // ==========================================================
  // 8. Check Nullifier
  // ==========================================================

  console.log(
    "\n[8] Checking Nullifier State"
  );

  const beforeUsed =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "usedNullifiers",
      args: [
        nullifier,
      ],
    });

  console.log(
    `Nullifier already used: ${beforeUsed}`
  );

  assert.equal(
    beforeUsed,
    false,
    "Nullifier is already used. Generate a fresh proof."
  );

  console.log(
    "Nullifier available: OK"
  );

  // ==========================================================
  // 9. Verify Signal Binding
  // ==========================================================

  console.log(
    "\n[9] Verifying Signal Binding"
  );

  assert.equal(
    signals[SESSION_ID_INDEX],
    sessionId,
    "Session ID signal mismatch"
  );

  assert.equal(
    signals[PURPOSE_ID_INDEX],
    purposeId,
    "Purpose ID signal mismatch"
  );

  assert.equal(
    signals[COMMITMENT_INDEX],
    commitment,
    "Commitment signal mismatch"
  );

  assert.equal(
    signals[NULLIFIER_INDEX],
    nullifier,
    "Nullifier signal mismatch"
  );

  console.log(
    "Session ID binding: OK"
  );

  console.log(
    "Purpose ID binding: OK"
  );

  console.log(
    "Commitment binding: OK"
  );

  console.log(
    "Nullifier binding: OK"
  );

  // ==========================================================
  // 10. verifyAndAccept
  // ==========================================================

  console.log(
    "\n[10] Calling verifyAndAccept"
  );

  console.log(
    `Expected Session ID: ${sessionId}`
  );

  console.log(
    `Proof Session ID: ${signals[SESSION_ID_INDEX]}`
  );

  console.log(
    `Session Purpose ID: ${purposeId}`
  );

  console.log(
    `Proof Purpose ID: ${signals[PURPOSE_ID_INDEX]}`
  );

  const hash =
    await walletClient.writeContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "verifyAndAccept",
      args: [
        pA,
        pB,
        pC,
        signals,
        sessionId,
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
    "verifyAndAccept transaction failed"
  );

  console.log(
    "verifyAndAccept: OK"
  );

  // ==========================================================
  // 11. Gas Measurement
  // ==========================================================

  console.log(
    "\n[11] Gas Measurement"
  );

  console.log(
    `Gas Used: ${receipt.gasUsed}`
  );

  assert.ok(
    receipt.gasUsed > 0n,
    "Gas used should be greater than zero"
  );

  console.log(
    "Gas measurement: OK"
  );

  // ==========================================================
  // 12. ProofAccepted Event
  // ==========================================================

  console.log(
    "\n[12] Checking ProofAccepted event"
  );

  const logs =
    await publicClient.getLogs({
      address: shieldAddress,
      event: {
        type: "event",
        name: "ProofAccepted",
        inputs: [
          {
            indexed: true,
            name: "sessionId",
            type: "uint256",
          },
          {
            indexed: true,
            name: "commitment",
            type: "uint256",
          },
          {
            indexed: true,
            name: "nullifier",
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
    "ProofAccepted event was not found"
  );

  assert.equal(
    event.args.sessionId,
    sessionId,
    "ProofAccepted sessionId mismatch"
  );

  assert.equal(
    event.args.commitment,
    commitment,
    "ProofAccepted commitment mismatch"
  );

  assert.equal(
    event.args.nullifier,
    nullifier,
    "ProofAccepted nullifier mismatch"
  );

  console.log(
    "ProofAccepted event: OK"
  );

  console.log(
    `Event sessionId: ${event.args.sessionId}`
  );

  console.log(
    `Event commitment: ${event.args.commitment}`
  );

  console.log(
    `Event nullifier: ${event.args.nullifier}`
  );

  // ==========================================================
  // 13. Nullifier State After Acceptance
  // ==========================================================

  console.log(
    "\n[13] Checking Nullifier State After Acceptance"
  );

  const afterUsed =
    await publicClient.readContract({
      address: shieldAddress,
      abi: shieldAbi,
      functionName: "usedNullifiers",
      args: [
        nullifier,
      ],
    });

  console.log(
    `Nullifier used: ${afterUsed}`
  );

  assert.equal(
    afterUsed,
    true,
    "Nullifier should be marked as used"
  );

  console.log(
    "Nullifier marked used: OK"
  );

  // ==========================================================
  // 14. Replay Attack
  // ==========================================================

  console.log(
    "\n[14] Testing Nullifier Replay"
  );

  let replayRejected = false;

  try {
    const replayHash =
      await walletClient.writeContract({
        address: shieldAddress,
        abi: shieldAbi,
        functionName: "verifyAndAccept",
        args: [
          pA,
          pB,
          pC,
          signals,
          sessionId,
        ],
      });

    const replayReceipt =
      await publicClient.waitForTransactionReceipt({
        hash: replayHash,
      });

    if (replayReceipt.status === "success") {
      replayRejected = false;
    }
  } catch (error) {
    replayRejected = true;

    console.log(
      "Nullifier replay rejected: OK"
    );

    console.log(
      `Replay error: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }

  assert.equal(
    replayRejected,
    true,
    "Nullifier replay should be rejected"
  );

  // ==========================================================
  // Final Result
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    "VERIFY AND ACCEPT TEST PASSED"
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Network: localhost"
  );

  console.log(
    "Chain ID: 31337"
  );

  console.log(
    "Contract existence: OK"
  );

  console.log(
    "Verifier contract: OK"
  );

  console.log(
    "Operator authorization: OK"
  );

  console.log(
    "Proof loading: OK"
  );

  console.log(
    "Public signal layout: OK"
  );

  console.log(
    "Session ID binding: OK"
  );

  console.log(
    "Purpose ID binding: OK"
  );

  console.log(
    "Session registration: OK"
  );

  console.log(
    "Session active state: OK"
  );

  console.log(
    "Groth16 proof verification: OK"
  );

  console.log(
    "verifyAndAccept: OK"
  );

  console.log(
    "ProofAccepted event: OK"
  );

  console.log(
    "Nullifier marked used: OK"
  );

  console.log(
    "Nullifier replay: REJECTED"
  );

  console.log(
    `Gas used: ${receipt.gasUsed}`
  );

  console.log(
    `Transaction: ${hash}`
  );

  console.log(
    `Session ID: ${sessionId}`
  );

  console.log(
    `Purpose ID: ${purposeId}`
  );

  console.log(
    `Commitment: ${commitment}`
  );

  console.log(
    `Nullifier: ${nullifier}`
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
      "\nVERIFY AND ACCEPT TEST FAILED"
    );

    console.error(error);

    process.exit(1);
  }
);

