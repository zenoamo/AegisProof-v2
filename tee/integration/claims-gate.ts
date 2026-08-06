import { AttestationErrorCode } from '../domain/attestation-error.js';
import { err, ok, Result } from '../domain/attestation-result.js';
import { TeeVerificationResult } from '../domain/tee-verification-result.js';
import { isAtLeast, VerificationLevel } from '../domain/verification-level.js';
import { RealNormalizedEvidence } from '../normalizers/real-evidence-normalizer.js';
import { isVerificationLevelAllowed } from '../policy/verification-policy.js';
import { TeeClaims, ZkClaimsMapper } from './zk-claims-mapper.js';

/**
 * Phase 8.9C-pre.3 claims security gate.
 *
 * Requires a passing verification at OFFLINE_FIXTURE or above before
 * delegating to ZkClaimsMapper. Does not modify ZkClaimsMapper behavior.
 */
export class ClaimsGate {
  static canMapClaims(verification: TeeVerificationResult): boolean {
    return (
      verification.isValid &&
      isAtLeast(verification.verificationLevel, VerificationLevel.OFFLINE_FIXTURE) &&
      isVerificationLevelAllowed(verification.verificationLevel)
    );
  }

  static toClaims(
    normalized: RealNormalizedEvidence,
    verification: TeeVerificationResult,
    rawReport: Buffer,
  ): Result<TeeClaims> {
    if (normalized.isMock) {
      return err({
        code: AttestationErrorCode.MOCK_IN_REAL_PATH,
        message: 'Cannot map mock evidence through ClaimsGate',
        layer: 'claims',
      });
    }

    if (!verification.isValid) {
      return err({
        code: AttestationErrorCode.VERIFY_FAILED,
        message: verification.message,
        layer: 'verify',
      });
    }

    if (
      !isAtLeast(verification.verificationLevel, VerificationLevel.OFFLINE_FIXTURE) ||
      !isVerificationLevelAllowed(verification.verificationLevel)
    ) {
      return err({
        code: AttestationErrorCode.CLAIMS_GATE_DENIED,
        message: `Verification level ${verification.verificationLevel} insufficient for claims mapping`,
        layer: 'claims',
      });
    }

    try {
      return ok(ZkClaimsMapper.toClaims(normalized, rawReport));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Claims mapping failed';
      return err({
        code: AttestationErrorCode.UNSUPPORTED_POC_SCOPE,
        message,
        layer: 'claims',
      });
    }
  }
}
