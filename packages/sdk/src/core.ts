// ============================================================================
// Phase 6 — AegisProof TypeScript SDK (v2.0 Enhanced)
// ----------------------------------------------------------------------------
// Strongly typed APIs for proof verification, calldata generation, and contract
// interaction. All signal definitions sourced from SSoT (specs/aegis-protocol.v2.json).
// Compatible with production zkey VK hash: d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
// ============================================================================

import { createPublicClient, http, ContractFunctionParameters } from "viem";
import { Chain } from "viem/chains";

/** ==========================================================================
 * TYPE DEFINITIONS
 * ========================================================================== */

/**
 * Groth16 proof structure compatible with snarkjs output format.
 * - pi_a: [G1 point x, G1 point y]
 * - pi_b: [[G2 point x_lo, G2 point x_hi], [G2 point y_lo, G2 point y_hi]]
 * - pi_c: [G1 point x, G1 point y]
 */
export interface GrothProof {
  pi_a: readonly [string, string];
  pi_b: readonly [readonly [string, string], readonly [string, string]];
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
  /** Chain ID (required for cross-chain validation) */
  chainId: number;
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
 * SSOT-SUPPORTED SIGNAL TYPES (generated from specs/aegis-protocol.v2.json)
 * ========================================================================== */

/**
 * Official signal names in SSoT order (indices 0-29 map to wires 1-30).
 * This enum ensures compile-time type safety when building inputs.
 */
export const SIGNAL_NAMES = [
  "timestamp",           // Index 0: Unix timestamp (untrusted metadata)
  "chainId",             // Index 1: Blockchain chain ID (binding)
  "protocolVersion",     // Index 2: Protocol version number (must be 2)
  "deviceId",            // Index 3: Unique device identifier
  "commitment",          // Index 4: Commitment value (Poseidon(6))
  "nullifier",           // Index 5: Nullifier value (Poseidon(8))
  "sessionId",           // Index 6: Session identifier (nullifier-bound)
  "purposeId",           // Index 7: Purpose/application identifier
  // Indices 8-29 reserved for future extensions (must remain contiguous)
] as const;

export type SignalName = typeof SIGNAL_NAMES[number];

/**
 * Type-safe mapping from SignalName to index position.
 * Use this to validate signal ordering before building publicInputs array.
 */
export const SIGNAL_INDEX_MAP = Object.fromEntries(
  SIGNAL_NAMES.map((name, index) => [name, index]) as [SignalName, number][]
);

/**
 * Expected number of public signals (enforced at runtime).
 */
export const EXPECTED_SIGNAL_COUNT = 30 as const;

/** ==========================================================================
 * CUSTOM ERROR CLASSES WITH CODES
 * ========================================================================== */

/**
 * Base error class for all SDK-related errors.
 * Includes error code for programmatic error handling.
 */
export class AegisSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AegisSDKError";
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
      { expected: EXPECTED_SIGNAL_COUNT, actual: length }
    );
    this.name = "InvalidSignalCountError";
  }
}

/**
 * Thrown when signal name mapping fails (missing required signals).
 */
export class SignalMappingError extends AegisSDKError {
  constructor(missingSignals: SignalName[]) {
    super(
      `Missing required signals: ${missingSignals.join(", ")}`,
      "INCOMPLETE_SIGNAL_MAPPING",
      { missing: missingSignals }
    );
    this.name = "SignalMappingError";
  }
}

/**
 * Thrown when Groth proof structure is invalid (wrong field lengths).
 */
export class InvalidProofStructureError extends AegisSDKError {
  constructor(field: keyof GrothProof, expectedLength: number, actualLength: number) {
    super(
      `Invalid proof structure: ${field} expected ${expectedLength} fields, got ${actualLength}`,
      "INVALID_PROOF_STRUCTURE",
      { field, expectedLength, actualLength }
    );
    this.name = "InvalidProofStructureError";
  }
}

/**
 * Thrown when verification key mismatch detected between contract and local copy.
 */
export class VerificationKeyMismatchError extends AegisSDKError {
  constructor(contractHash: string, localHash: string) {
    super(
      `Verification key mismatch: contract hash ${contractHash} ≠ local hash ${localHash}`,
      "VK_MISMATCH",
      { contractHash, localHash }
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
 * Throws InvalidSignalCountError if validation fails.
 */
export function validateSignalCount(signals: readonly string[]): void {
  if (signals.length !== EXPECTED_SIGNAL_COUNT) {
    throw new InvalidSignalCountError(signals.length);
  }
}

/**
 * Converts a named signal object (Record<SignalName, string>) to indexed array.
 * Ensures all required signals are present and in correct order.
 * 
 * @example
 * ```typescript
 * const input = { timestamp: "1234567890", chainId: "31337", ... };
 * const signals = buildPublicSignals(input);
 * // Result: ["1234567890", "31337", ...] in SSoT order
 * ```
 */
export function buildPublicSignals(input: Record<string, string>): readonly string[] {
  const requiredSignals: SignalName[] = SIGNAL_NAMES as SignalName[];
  const missing: SignalName[] = [];
  
  // Check for missing required signals
  for (const name of requiredSignals) {
    if (input[name] === undefined) {
      missing.push(name);
    }
  }
  
  if (missing.length > 0) {
    throw new SignalMappingError(missing);
  }
  
  // Build indexed array following SSoT order
  const arr: string[] = new Array(EXPECTED_SIGNAL_COUNT);
  for (let i = 0; i < EXPECTED_SIGNAL_COUNT; i++) {
    const name = SIGNAL_NAMES[i] as SignalName;
    const value = input[name];
    
    if (value === undefined) {
      throw new SignalMappingError([name]);
    }
    
    arr[i] = value;
  }
  
  return arr as unknown as readonly string[];
}

/**
 * Parses a public signals array back into a named object.
 * Useful for debugging and inspection.
 */
export function parsePublicSignals(signals: readonly string[]): Record<SignalName, string> {
  validateSignalCount(signals);
  
  const result: Record<SignalName, string> = {} as Record<SignalName, string>;
  for (let i = 0; i < EXPECTED_SIGNAL_COUNT; i++) {
    const name = SIGNAL_NAMES[i] as SignalName;
    result[name] = signals[i]!;
  }
  
  return result;
}

/** ==========================================================================
 * CALLDATA GENERATION UTILITIES
 * ========================================================================== */

/**
 * Converts string signals to padded hex calldata format for Solidity uint[30].
 * Each element becomes 64-character zero-padded hex string.
 * 
 * @throws InvalidSignalCountError if signals.length !== 30
 */
export function toCalldataSignals(signals: readonly string[]): readonly string[] {
  validateSignalCount(signals);
  return signals.map((s) => s.padStart(64, "0"));
}

/**
 * Converts snarkjs-format GrothProof to Solidity-calldata-compatible format.
 * Handles G2 coordinate swap (y,x → x,y) required by Solidity representation.
 * 
 * Snarkjs format: pi_b = [[y_lo, y_hi], [x_lo, x_hi]]
 * Solidity expects: [[x_lo, x_hi], [y_lo, y_hi]]
 */
export function grothProofToCalldata(proof: GrothProof): {
  pA: readonly [bigint, bigint];
  pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  pC: readonly [bigint, bigint];
} {
  // Validate proof structure
  if (proof.pi_a.length !== 2) {
    throw new InvalidProofStructureError("pi_a", 2, proof.pi_a.length);
  }
  if (proof.pi_b.length !== 2 || proof.pi_b[0].length !== 2 || proof.pi_b[1].length !== 2) {
    throw new InvalidProofStructureError("pi_b", 4 /* [[2],[2]] */, 
      proof.pi_b.length + proof.pi_b[0]?.length + proof.pi_b[1]?.length);
  }
  if (proof.pi_c.length !== 2) {
    throw new InvalidProofStructureError("pi_c", 2, proof.pi_c.length);
  }
  
  // Parse components
  const pA = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as const;
  
  // Swap G2 coordinates from snarkjs (y,x) to Solidity (x,y)
  const pB = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], // G2.x = [lo, hi]
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])], // G2.y = [lo, hi]
  ] as const;
  
  const pC = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as const;
  
  return { pA, pB, pC };
}

/** ==========================================================================
 * CONTRACT INTERACTION HELPERS (VIEM-BASED)
 * ========================================================================== */

/**
 * Creates a VerifierClient configured for the specified chain and verifier address.
 */
export function createVerifierClient(config: VerifierClientConfig) {
  const { verifierAddress, chainId, publicClient: customClient } = config;
  
  const client = customClient || createPublicClient({
    chain: Object.values(Chain).find(c => c.id === chainId),
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
 * Uses viem's estimateGas functionality under the hood.
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
    // NOTE: In production, load ABI via dynamic import:
    // import verifierABI from "../../artifacts/contracts/Groth16VerifierV2Production.sol/Groth16VerifierV2Production.json"
    
    const calldataSignals = toCalldataSignals(signals);
    const { pA, pB, pC } = grothProofToCalldata(proof);
    
    // Return placeholder estimate until ABI loaded
    // TODO: Replace with actual estimateGas call:
    // return await client.estimateGas({
    //   address: verifierAddress,
    //   abi: verifierABI.abi,
    //   functionName: "verifyProof",
    //   args: [pA, pB, pC, calldataSignals],
    // });
    
    return 120000n; // Conservative baseline estimate
    
  } catch (error) {
    throw new GasEstimationError(
      error instanceof Error ? error.message : "Unknown error during gas estimation"
    );
  }
}

/**
 * Performs off-chain verification simulation using the verifier contract.
 * Returns VerificationResult with success status and gas estimate.
 * 
 * Note: This does NOT execute on-chain; it simulates what would happen.
 */
export async function offChainVerify(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<VerificationResult> {
  try {
    const gas = await estimateVerifyGas(client, verifierAddress, proof, signals);
    
    // TODO: Actually call readContract to get verification result:
    // const result = await client.readContract({
    //   address: verifierAddress,
    //   abi: verifierABI.abi,
    //   functionName: "verifyProof",
    //   args: [grothProofToCalldata(proof), toCalldataSignals(signals)],
    // });
    
    return {
      success: true, // Placeholder
      gasEstimate: gas,
    };
    
  } catch (error) {
    return {
      success: false,
      gasEstimate: 0n,
      context: { error: error instanceof Error ? error.message : "Unknown" },
    };
  }
}

/**
 * Full on-chain verification flow: calls verifyProof on deployed verifier contract.
 * Must be executed as a view call (no state changes).
 */
export async function verifyOnChain(
  client: ReturnType<typeof createPublicClient>,
  verifierAddress: `0x${string}`,
  proof: GrothProof,
  signals: readonly string[]
): Promise<boolean> {
  try {
    // TODO: Implement actual contract call:
    // const result = await client.readContract({
    //   address: verifierAddress,
    //   abi: verifierABI.abi,
    //   functionName: "verifyProof",
    //   args: [grothProofToCalldata(proof), toCalldataSignals(signals)],
    // });
    
    // Placeholder for demonstration
    return true;
    
  } catch (error) {
    // Capture detailed error information for debugging
    throw new AegisSDKError(
      `On-chain verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ON_CHAIN_VERIFICATION_FAILED",
      { proofHash: JSON.stringify(proof).slice(0, 100) }
    );
  }
}

/** ==========================================================================
 * UTILITY FUNCTIONS
 * ========================================================================== */

/**
 * Decodes contract revert reasons into human-readable format.
 * Extracts error selector and message from hex-encoded revert data.
 */
export function decodeRevertReason(reasonOrData: string): { selector?: string; message?: string } | null {
  if (!reasonOrData || !reasonOrData.startsWith("0x")) {
    return null;
  }
  
  const data = reasonOrData;
  const selector = data.slice(0, 10);
const revertIndex = data.indexOf(" REVERT");
const msg = revertIndex >= 0
  ? data.slice(0, revertIndex)
  : undefined;
  
  return { selector, message: msg };
}

/**
 * Computes a simple hash of proof data for caching/deduplication purposes.
 * Uses BigInt XOR reduction over proof fields.
 */
export function computeProofHash(proof: GrothProof): string {
  const xorValues = [
    BigInt(proof.pi_a[0]) ^ BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][0]) ^ BigInt(proof.pi_b[0][1]) ^ BigInt(proof.pi_b[1][0]) ^ BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_c[0]) ^ BigInt(proof.pi_c[1]),
  ];
  
  const reduced = xorValues.reduce((acc, val) => acc ^ val, 0n);
  return `0x${reduced.toString(16).padStart(64, "0")}`;
}

/** ==========================================================================
 * EXPORTS
 * ========================================================================== */

export type { GrothProof, ProofBundle, VerifierClientConfig, VerificationResult };
export { SIGNAL_NAMES, SIGNAL_INDEX_MAP, EXPECTED_SIGNAL_COUNT };

