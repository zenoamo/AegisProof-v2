import { VerificationLevel } from '../domain/verification-level.js';

/**
 * Phase 8.9C-pre.2 verification level policy.
 *
 * Determines which VerificationLevel may proceed toward claims (ClaimsGate in pre.3).
 * Not wired into ZkClaimsMapper or the Stage A mock ZK+TEE policy test.
 */
export function isVerificationLevelAllowed(level: VerificationLevel): boolean {
  switch (level) {
    case VerificationLevel.OFFLINE_FIXTURE:
    case VerificationLevel.OFFLINE_VERIFIED:
    case VerificationLevel.HARDWARE_ROOTED:
      return true;
    case VerificationLevel.NONE:
    case VerificationLevel.STRUCTURE_ONLY:
    default:
      return false;
  }
}

/** Research default policy for future ClaimsGate wiring. */
export const DEFAULT_VERIFICATION_LEVEL_POLICY = {
  allows(level: VerificationLevel): boolean {
    return isVerificationLevelAllowed(level);
  },
} as const;
