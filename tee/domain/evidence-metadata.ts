/**
 * Phase 8.9C-pre evidence provenance metadata (research only).
 */
export type EvidenceSource = 'mock' | 'placeholder' | 'fixture' | 'hardware';

export interface EvidenceMetadata {
  readonly source: EvidenceSource;
  readonly researchOnly: boolean;
}
