/**
 * Phase 8.9C-pre domain error codes for attestation pipeline (future use).
 */
export enum AttestationErrorCode {
  DEVICE_UNAVAILABLE = 'DEVICE_UNAVAILABLE',
  STRUCTURE_INVALID = 'STRUCTURE_INVALID',
  MOCK_IN_REAL_PATH = 'MOCK_IN_REAL_PATH',
  VERIFY_FAILED = 'VERIFY_FAILED',
  CLAIMS_GATE_DENIED = 'CLAIMS_GATE_DENIED',
  POLICY_DENIED = 'POLICY_DENIED',
  UNSUPPORTED_POC_SCOPE = 'UNSUPPORTED_POC_SCOPE',
}

export type AttestationErrorLayer =
  | 'acquisition'
  | 'parser'
  | 'verify'
  | 'normalize'
  | 'claims'
  | 'policy';

export interface AttestationError {
  readonly code: AttestationErrorCode;
  readonly message: string;
  readonly layer: AttestationErrorLayer;
}
