/**
 * Phase 8.8 / 8.9B / 8.9C-pre verification interface.
 * Types live in tee/domain/ — re-exported here for backward compatibility.
 */
export type {
  VerificationPocScope,
  TeeVerificationResult,
  VerificationResult,
} from '../domain/tee-verification-result.js';

export { VerificationLevel } from '../domain/verification-level.js';

import type { TeeVerificationResult } from '../domain/tee-verification-result.js';

/**
 * Phase 8.8 research verifier interface.
 * Stub: structure only. Offline (8.9B): fixture-based ECDSA PoC.
 */
export interface TeeVerifier {
  verify(rawReport: Buffer): TeeVerificationResult;
}
