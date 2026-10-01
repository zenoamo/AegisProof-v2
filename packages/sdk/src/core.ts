// ============================================================================
// Phase 6 — AegisProof TypeScript SDK (v2.0 Enhanced)
// ----------------------------------------------------------------------------
// Strongly typed APIs for proof verification, calldata generation, and contract
// interaction. All signal definitions sourced from SSoT (specs/aegis-protocol.v2.json).
// Compatible with production zkey VK hash:
// d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
// ============================================================================

import { createPublicClient, http } from "viem";
import { SIGNAL_INDEX, N_PUBLIC_SIGNALS } from "./generated/AegisSignals";

/** ==========================================================================
 * TYPE DEFINITIONS
 * ========================================================================== */

/**
 * Groth16 proof structure compatible with snarkjs output format.
 *
 * - pi_a: [G1 point x, G1 point y]
 * - pi_b: [[G2 point x_lo, G2 point x_hi], [G2 point y_lo, G2 point y_hi]]
 * - pi_c: [G1 point x, G1 point y]
 */
export interface GrothProof {
  pi_a: readonly [string, string];
  pi_b: readonly [
    readonly [string, string],
    readonly [string, string]
  ];
  pi_c: readonly [string, string];
}

/**
 * Complete proof bundle including public signals.
 * Used when loading proofs from JSON files or network responses.
 */
export interface ProofBundle {
  proof: GrothProof;
  publicSignals: readonly string[];
}

/**
 * Configuration for verifier client initialization.
 */
export interface VerifierClientConfig {
  /** Address of deployed Groth16VerifierV2Production.sol contract */
  verifierAddress: `0x${string}`;

  /** Viem public client instance (optional; auto-created if omitted) */
  publicClient?: ReturnType<typeof createPublicClient>;

  /** Chain ID used for cross-chain validation */
  chainId: number;
}

/**
 * Public verifier client returned by createVerifierClient().
 */
export interface VerifierClient {
  verifierAddress: `0x${string}`;
  chainId: number;
  client: ReturnType<typeof createPublicClient>;
}

/**
 * Verification result from off-chain or on-chain checks.
 */
export interface VerificationResult {
  /** Whether proof verification succeeded */
  success: boolean;

  /** Gas estimate for on-chain verification (if applicable) */
  gasEstimate?: bigint;

  /** Additional context about the verification outcome */
  context?: Record<string, unknown>;
}

/** ==========================================================================
 * SSOT-SUPPORTED SIGNAL TYPES
 * ========================================================================== */

/**
 * Canonical public-signal names generated directly from the protocol SSoT.
 *
 * The array order is the wire order used by Groth16 publicSignals[0..29].
 */
export const SIGNAL_NAMES = Object.keys(SIGNAL_INDEX) as Array<keyof typeof SIGNAL_INDEX>;

export type SignalName = typeof SIGNAL_NAMES[number];

/**
 * Type-safe mapping from SignalName to canonical index position.
 */
export const SIGNAL_INDEX_MAP: Record<SignalName, number> = SIGNAL_INDEX;

/**
 * Expected number of public signals.
 */
export const EXPECTED_SIGNAL_COUNT = N_PUBLIC_SIGNALS as 30;

/** ==========================================================================
 * CUSTOM ERROR CLASSES
 * ========================================================================== */

/**
 * Base error class for all SDK-related errors.
 */
export class AegisSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AegisSDKError";

    // Required for correct subclass behavior when targeting ES5-like runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when public signals count doesn't match expected (30).
 */
export class InvalidSignalCountError extends AegisSDKError {
  constructor(length: number) {
    super(
      `Expected ${EXPECTED_SIGNAL_COUNT} public signals, but got ${length}`,
      "INVALID_SIGNAL_COUNT",
      {
        expected: EXPECTED_SIGNAL_COUNT,
        actual: length,
      }
    );

    this.name = "InvalidSignalCountError";
  }
}

/**
 * Thrown when signal name mapping fails.
 */
export class SignalMappingError extends AegisSDKError {
  constructor(missingSignals: readonly SignalName[]) {
    super(
      `Missing required signals: ${missingSignals.join(", ")}`,
      "INCOMPLETE_SIGNAL_MAPPING",
      {
        missing: [...missingSignals],
      }
    );

    this.name = "SignalMappingError";
  }
}

/**
 * Thrown when Groth proof structure is invalid.
 */
export class InvalidProofStructureError extends AegisSDKError {
  constructor(
    field: keyof GrothProof,
    expectedLength: number,
    actualLength: number
  ) {
    super(
      `Invalid proof structure: ${field} expected ${expectedLength} fields, got ${actualLength}`,
      "INVALID_PROOF_STRUCTURE",
      {
        field,
        expectedLength,
        actualLength,
      }
    );

    this.name = "InvalidProofStructureError";
  }
}

/**
 * Thrown when verification key mismatch is detected.
 */
export class VerificationKeyMismatchError extends AegisSDKError {
  constructor(contractHash: string, localHash: string) {
    super(
      `Verification key mismatch: contract hash ${contractHash} ≠ local hash ${localHash}`,
      "VK_MISMATCH",
      {
        contractHash,
        localHash,
      }
    );

    this.name = "VerificationKeyMismatchError";
  }
}

/**
 * Thrown when gas estimation fails.
 */
export class GasEstimationError extends AegisSDKError {
  constructor(message: string) {
    super(message, "GAS_ESTIMATION_FAILED");
    this.name = "GasEstimationError";
  }
}

/** ==========================================================================
 * PUBLIC SIGNAL HELPER FUNCTIONS
 * ========================================================================== */

/**
 * Validates that public signals array has exactly 30 elements.
 *
 * @throws InvalidSignalCountError
 */
export function validateSignalCount(
  signals: readonly string[]
): void {
  if (signals.length !== EXPECTED_SIGNAL_COUNT) {
    throw new InvalidSignalCountError(signals.length);
  }
}

/**
 * Converts a named signal object to the canonical public-signal array.
 *
 * Every one of the 30 SSoT signals is required. No reserved/implicit slots
 * are synthesized by the SDK.
 */
export function buildPublicSignals(
  input: Record<string, string>
): readonly string[] {
  const missing = SIGNAL_NAMES.filter((name) => input[name] === undefined);

  if (missing.length > 0) {
    throw new SignalMappingError(missing);
  }

  return SIGNAL_NAMES.map((name) => input[name]!);
}

/**
 * Parses a canonical 30-element public-signal array back into named signals.
 */
export function parsePublicSignals(
  signals: readonly string[]
): Record<SignalName, string> {
  validateSignalCount(signals);

  return Object.fromEntries(
    SIGNAL_NAMES.map((name, index) => [name, signals[index]!])
  ) as Record<SignalName, string>;
}

/** ==========================================================================
 * CALLDATA GENERATION UTILITIES
 * ========================================================================== */

/**
 * Converts string signals to padded hex calldata format for Solidity uint[30].
 *
 * Each element becomes a 64-character hexadecimal string.
 *
 * @throws InvalidSignalCountError
 */
export function toCalldataSignals(
  signals: readonly string[]
): readonly string[] {
  validateSignalCount(signals);

  return signals.map((signal) =>
    signal.padStart(64, "0")
  );
}

/**
 * Converts snarkjs-format GrothProof to Solidity calldata format.
 *
 * Snarkjs format:
 *   pi_b = [[y_lo, y_hi], [x_lo, x_hi]]
 *
 * Solidity verifier representation:
 *   pB = [[x_lo, x_hi], [y_lo, y_hi]]
 */
export function grothProofToCalldata(
  proof: GrothProof
): {
  pA: readonly [bigint, bigint];
  pB: readonly [
    readonly [bigint, bigint],
    readonly [bigint, bigint]
  ];
  pC: readonly [bigint, bigint];
} {
  if (proof.pi_a.length !== 2) {
    throw new InvalidProofStructureError(
      "pi_a",
      2,
      proof.pi_a.length
    );
  }

  if (
    proof.pi_b.length !== 2 ||
    proof.pi_b[0].length !== 2 ||
    proof.pi_b[1].length !== 2
  ) {
    const actualLength =
      proof.pi_b.length +
      (proof.pi_b[0]?.length ?? 0) +
      (proof.pi_b[1]?.length ?? 0);

    throw new InvalidProofStructureError(
      "pi_b",
      4,
      actualLength
    );
  }

  if (proof.pi_c.length !== 2) {
    throw new InvalidProofStructureError(
      "pi_c",
      2,
      proof.pi_c.length
    );
  }

  const pA = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
  ] as const;

  // Swap G2 coordinates from snarkjs (y,x)
  // to Solidity verifier order (x,y).
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

  return {
    pA,
    pB,
    pC,
  };
}

/** ==========================================================================
 * CONTRACT INTERACTION HELPERS
 * ========================================================================== */

/**
 * Creates a VerifierClient configured for the specified chain ID.
 *
 * If a publicClient is supplied, it is reused.
 * Otherwise a viem public client is created with HTTP transport.
 *
 * Note:
 * chainId is retained as explicit SDK metadata. The SDK does not attempt
 * to construct a Chain object dynamically from an arbitrary numeric ID.
 */
export function createVerifierClient(
  config: VerifierClientConfig
): VerifierClient {
  const {
    verifierAddress,
    chainId,
    publicClient: customClient,
  } = config;

  const client =
    customClient ??
    createPublicClient({
      transport: http(),
    });

  return {
    verifierAddress,
    chainId,
    client,
  };
}

const VERIFIER_ABI = [
  {
    type: "function",
    name: "verifyProof",
    stateMutability: "view",
    inputs: [
      {
        name: "_pA",
        type: "uint256[2]",
        internalType: "uint256[2]",
      },
      {
        name: "_pB",
        type: "uint256[2][2]",
        internalType: "uint256[2][2]",
      },
      {
        name: "_pC",
        type: "uint256[2]",
        internalType: "uint256[2]",
      },
      {
        name: "_pubSignals",
        type: "uint256[30]",
        internalType: "uint256[30]",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
  },
] as const;

function verifierArgs(proof: GrothProof, signals: readonly string[]) {
  validateSignalCount(signals);
  const { pA, pB, pC } = grothProofToCalldata(proof);
  const pubSignals = signals.map((signal) => BigInt(signal)) as [
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint
  ];
  return [pA, pB, pC, pubSignals] as const;
}

/**
 * Estimates gas for the production verifier's actual verifyProof call.
 */
export async function estimateVerifyGas(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<bigint> {
  try {
    const [pA, pB, pC, pubSignals] = verifierArgs(proof, signals);

    return await client.estimateContractGas({
      address: verifierAddress,
      abi: VERIFIER_ABI,
      functionName: "verifyProof",
      args: [pA, pB, pC, pubSignals],
    });
  } catch (error) {
    throw new GasEstimationError(
      error instanceof Error
        ? error.message
        : "Unknown error during gas estimation"
    );
  }
}

/**
 * Performs a real eth_call against the production verifier without sending a
 * transaction. This is verification, not a gas-only simulation.
 */
export async function offChainVerify(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<VerificationResult> {
  try {
    const [pA, pB, pC, pubSignals] = verifierArgs(proof, signals);
    const result = await client.readContract({
      address: verifierAddress,
      abi: VERIFIER_ABI,
      functionName: "verifyProof",
      args: [pA, pB, pC, pubSignals],
    });

    return {
      success: Boolean(result),
      context: { verifierAddress },
    };
  } catch (error) {
    return {
      success: false,
      context: {
        verifierAddress,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Full on-chain verifier read path.
 *
 * This performs an eth_call against Groth16VerifierV2Production.verifyProof.
 * It does not submit a transaction.
 */
export async function verifyOnChain(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<boolean> {
  try {
    const [pA, pB, pC, pubSignals] = verifierArgs(proof, signals);

    const result = await client.readContract({
      address: verifierAddress,
      abi: VERIFIER_ABI,
      functionName: "verifyProof",
      args: [pA, pB, pC, pubSignals],
    });

    return Boolean(result);
  } catch (error) {
    throw new AegisSDKError(
      `On-chain verification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "ON_CHAIN_VERIFICATION_FAILED",
      {
        verifierAddress,
        proofHash: JSON.stringify(proof).slice(0, 100),
      }
    );
  }
}

/** ==========================================================================
 * UTILITY FUNCTIONS
 * ========================================================================== */

/**
 * Decodes contract revert reasons into a human-readable representation.
 *
 * Extracts the first 4-byte selector and, when present, the text preceding
 * the " REVERT" marker.
 */
export function decodeRevertReason(
  reasonOrData: string
): {
  selector?: string;
  message?: string;
} | null {
  if (
    !reasonOrData ||
    !reasonOrData.startsWith("0x")
  ) {
    return null;
  }

  const selector = reasonOrData.slice(0, 10);

  const revertIndex =
    reasonOrData.indexOf(" REVERT");

  const message =
    revertIndex >= 0
      ? reasonOrData.slice(0, revertIndex)
      : undefined;

  return {
    selector,
    message,
  };
}

/**
 * Computes a simple XOR-based hash of proof data.
 *
 * This is intended for caching/deduplication only.
 * It is NOT a cryptographic hash.
 */
export function computeProofHash(
  proof: GrothProof
): string {
  const xorValues = [
    BigInt(proof.pi_a[0]) ^
      BigInt(proof.pi_a[1]),

    BigInt(proof.pi_b[0][0]) ^
      BigInt(proof.pi_b[0][1]) ^
      BigInt(proof.pi_b[1][0]) ^
      BigInt(proof.pi_b[1][1]),

    BigInt(proof.pi_c[0]) ^
      BigInt(proof.pi_c[1]),
  ];

  const reduced = xorValues.reduce(
    (acc, value) => acc ^ value,
    0n
  );

  return `0x${reduced
    .toString(16)
    .padStart(64, "0")}`;
}

/** ==========================================================================
 * END OF SDK CORE
 * ========================================================================== */
