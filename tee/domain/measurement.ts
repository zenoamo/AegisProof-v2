/**
 * Phase 8.9C-pre measurement value object (future parser extraction).
 */
export interface Measurement {
  readonly bytes: Buffer;
  readonly algorithm: 'SHA256' | 'SHA384';
}
