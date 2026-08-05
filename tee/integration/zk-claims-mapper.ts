import crypto from 'crypto';
import { RealNormalizedEvidence } from '../normalizers/real-evidence-normalizer.js';

/**
 * Phase 8.8 PoC claims object for future ZK integration research.
 * Does not connect to AegisProof protocol or circuits.
 */
export interface TeeClaims {
  teeProviderId: 'TDX' | 'SEV-SNP';
  measurementHash: string;
  bindingNonce: string;
  pocScope: 'claims-mapper-poc';
  sourcePocScope: RealNormalizedEvidence['pocScope'];
}

/**
 * Phase 8.8 PoC ZK claims mapper.
 *
 * Maps normalized Real Evidence to a plain claims object.
 * No protocol/, circuits/, or signal schema changes.
 * Production use is prohibited.
 */
export class ZkClaimsMapper {
  static toClaims(normalized: RealNormalizedEvidence, rawReport: Buffer): TeeClaims {
    if (normalized.isMock) {
      throw new Error('Cannot map mock evidence to ZK claims');
    }

    if (normalized.pocScope !== 'structure-only') {
      throw new Error(`Unsupported source pocScope: ${normalized.pocScope}`);
    }

    return {
      teeProviderId: normalized.provider,
      measurementHash: crypto.createHash('sha256').update(rawReport).digest('hex'),
      bindingNonce: crypto.createHash('sha256').update(rawReport.subarray(0, 16)).digest('hex'),
      pocScope: 'claims-mapper-poc',
      sourcePocScope: normalized.pocScope,
    };
  }
}
