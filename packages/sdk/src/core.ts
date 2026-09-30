// ============================================================================
// Phase 6 — AegisProof TypeScript SDK (v2.0 Enhanced)
// ----------------------------------------------------------------------------
// Strongly typed APIs for proof verification, calldata generation, and contract
// interaction. All signal definitions sourced from SSoT (specs/aegis-protocol.v2.json).
// Compatible with production zkey VK hash:
// d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
// ============================================================================

import { createPublicClient, http } from "viem";

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
 * Official signal names in SSoT order.
 *
 * Indices 0-29 map to public wires 1-30.
 * Currently defined names occupy indices 0-7.
 * Indices 8-29 are reserved for future extensions.
 */
export const SIGNAL_NAMES = [
  "timestamp",       // Index 0: Unix timestamp (untrusted metadata)
  "chainId",         // Index 1: Blockchain chain ID (binding)
  "protocolVersion", // Index 2: Protocol version number (must be 2)
  "deviceId",        // Index 3: Unique device identifier
  "commitment",      // Index 4: Commitment value (Poseidon(6))
  "nullifier",       // Index 5: Nullifier value (Poseidon(8))
  "sessionId",       // Index 6: Session identifier (nullifier-bound)
  "purposeId",       // Index 7: Purpose/application identifier
] as const;

export type SignalName = typeof SIGNAL_NAMES[number];

/**
 * Type-safe mapping from SignalName to index position.
 */
export const SIGNAL_INDEX_MAP: Record<SignalName, number> =
  Object.fromEntries(
    SIGNAL_NAMES.map((name, index) => [name, index])
  ) as Record<SignalName, number>;

/**
 * Expected number of public signals.
 */
export const EXPECTED_SIGNAL_COUNT = 30 as const;

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
 * Converts a named signal object to an indexed public-signal array.
 *
 * The eight currently defined SSoT signals are placed at indices 0-7.
 * Reserved indices 8-29 are initialized with "0".
 */
export function buildPublicSignals(
  input: Record<string, string>
): readonly string[] {
  const requiredSignals: readonly SignalName[] = SIGNAL_NAMES;
  const missing: SignalName[] = [];

  for (const name of requiredSignals) {
    if (input[name] === undefined) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new SignalMappingError(missing);
  }

  const arr: string[] = new Array(EXPECTED_SIGNAL_COUNT).fill("0");

  for (let i = 0; i < SIGNAL_NAMES.length; i++) {
    const name = SIGNAL_NAMES[i];
    const value = input[name];

    if (value === undefined) {
      throw new SignalMappingError([name]);
    }

    arr[i] = value;
  }

  return arr;
}

/**
 * Parses a 30-element public-signal array back into the named signals.
 *
 * Only the currently defined SSoT signal names are returned.
 * Reserved indices 8-29 are intentionally ignored.
 */
export function parsePublicSignals(
  signals: readonly string[]
): Record<SignalName, string> {
  validateSignalCount(signals);

  const result = {} as Record<SignalName, string>;

  for (let i = 0; i < SIGNAL_NAMES.length; i++) {
    const name = SIGNAL_NAMES[i];
    result[name] = signals[i]!;
  }

  return result;
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

/**
 * Estimates gas cost for verifyProof contract call.
 *
 * Current implementation returns a conservative baseline until the
 * production verifier ABI is wired into the SDK.
 *
 * @returns Gas estimate in wei (approximate)
 */
export async function estimateVerifyGas(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<bigint> {
  try {
    // Keep parameters referenced while the ABI integration is pending.
    void client;
    void verifierAddress;

    const calldataSignals =
      toCalldataSignals(signals);

    const { pA, pB, pC } =
      grothProofToCalldata(proof);

    // Keep generated calldata referenced until ABI integration.
    void calldataSignals;
    void pA;
    void pB;
    void pC;

    // TODO:
    // Replace this baseline with an actual estimateGas call once
    // the production verifier ABI is bundled into the SDK.
    //
    // Example:
    //
    // return await client.estimateContractGas({
    //   address: verifierAddress,
    //   abi: verifierABI,
    //   functionName: "verifyProof",
    //   args: [pA, pB, pC, calldataSignals],
    // });

    return 120000n;
  } catch (error) {
    throw new GasEstimationError(
      error instanceof Error
        ? error.message
        : "Unknown error during gas estimation"
    );
  }
}

/**
 * Performs off-chain verification simulation using the verifier contract.
 *
 * Note:
 * This currently uses the gas-estimation path and does not execute an
 * actual verifier contract call.
 */
export async function offChainVerify(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<VerificationResult> {
  try {
    const gas = await estimateVerifyGas(
      client,
      verifierAddress,
      proof,
      signals
    );

    return {
      success: true,
      gasEstimate: gas,
    };
  } catch (error) {
    return {
      success: false,
      gasEstimate: 0n,
      context: {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
    };
  }
}

/**
 * Full on-chain verification flow.
 *
 * Current implementation is a placeholder until the production verifier
 * ABI is integrated into the SDK.
 */
export async function verifyOnChain(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<boolean> {
  try {
    // Keep parameters referenced until ABI integration.
    void client;
    void verifierAddress;
    void proof;
    void signals;

    // TODO:
    // Implement actual readContract() against the production verifier ABI.
    //
    // Example:
    //
    // const result = await client.readContract({
    //   address: verifierAddress,
    //   abi: verifierABI,
    //   functionName: "verifyProof",
    //   args: [pA, pB, pC, calldataSignals],
    // });
    //
    // return Boolean(result);

    return true;
  } catch (error) {
    throw new AegisSDKError(
      `On-chain verification failed: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`,
      "ON_CHAIN_VERIFICATION_FAILED",
      {
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
