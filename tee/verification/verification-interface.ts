/**
 * Phase 8.8 / 8.9B PoC verification result.
 * Not a production attestation verdict.
 */
export type VerificationPocScope = 'verification-stub' | 'offline-verification-poc';

export interface VerificationResult {
  isValid: boolean;
  provider: 'TDX' | 'SEV-SNP';
  tcbStatus: 'Unknown';
  pocScope: VerificationPocScope;
  message: string;
}

/**
 * Phase 8.8 research verifier interface.
 * Stub: structure only. Offline (8.9B): fixture-based ECDSA PoC.
 */
export interface TeeVerifier {
  verify(rawReport: Buffer): VerificationResult;
}
