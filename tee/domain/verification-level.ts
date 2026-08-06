/**
 * Phase 8.9C-pre trust level for TEE verification results.
 * Monotonic escalation only — higher levels are not production guarantees by themselves.
 */
export enum VerificationLevel {
  NONE = 0,
  STRUCTURE_ONLY = 1,
  OFFLINE_FIXTURE = 2,
  OFFLINE_VERIFIED = 3,
  HARDWARE_ROOTED = 4,
}

/** Minimum level required for research claims gate (future Phase 8.9C-pre.3). */
export function isAtLeast(level: VerificationLevel, minimum: VerificationLevel): boolean {
  return level >= minimum;
}
