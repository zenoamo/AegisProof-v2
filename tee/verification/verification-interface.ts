/**
 * Phase 8.8 PoC verification result.
 * Not a production attestation verdict.
 */
export interface VerificationResult {
  isValid: boolean;
  provider: 'TDX' | 'SEV-SNP';
  tcbStatus: 'Unknown';
  pocScope: 'verification-stub';
  message: string;
}

/**
 * Phase 8.8 research verifier interface.
 * Cryptographic verification is out of scope for stub implementations.
 */
export interface TeeVerifier {
  verify(rawReport: Buffer): VerificationResult;
}
