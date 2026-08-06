import { AttestationError } from './attestation-error.js';

/**
 * Phase 8.9C-pre Result type for pipeline boundaries (future AttestationPipeline).
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AttestationError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: AttestationError): Result<T> {
  return { ok: false, error };
}
