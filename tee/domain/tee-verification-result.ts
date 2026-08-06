import { VerificationLevel } from './verification-level.js';

/**
 * Phase 8.8 / 8.9B research verification scope label.
 */
export type VerificationPocScope = 'verification-stub' | 'offline-verification-poc';

/**
 * Phase 8.9C-pre canonical TEE verification result.
 * Not a production attestation verdict.
 */
export interface TeeVerificationResult {
  isValid: boolean;
  provider: 'TDX' | 'SEV-SNP';
  tcbStatus: 'Unknown';
  pocScope: VerificationPocScope;
  verificationLevel: VerificationLevel;
  message: string;
}

/** @deprecated Prefer TeeVerificationResult — alias for incremental migration. */
export type VerificationResult = TeeVerificationResult;
