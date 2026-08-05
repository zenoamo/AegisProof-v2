import { Evidence } from '../mock/provider-interface.js';
import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import { SevReportParser } from '../parsers/sev-report-parser.js';

export interface RealNormalizedEvidence {
  isValid: boolean;
  provider: 'TDX' | 'SEV-SNP';
  isMock: false;
  tcbStatus: 'Unknown';
  timestamp: number;
  pocScope: 'structure-only';
}

const MOCK_FLAGS = [
  'MOCK_DATA_ONLY',
  'NOT_REAL_ATTESTATION',
  'DO_NOT_USE_IN_PRODUCTION',
] as const;

/**
 * Phase 8.6 PoC Real Evidence normalizer.
 *
 * Cryptographic verification is not implemented.
 * Only structural validation via parsers is performed.
 * Production use is prohibited.
 */
export class RealEvidenceNormalizer {
  static normalize(evidence: Evidence): RealNormalizedEvidence {
    const rawStr = evidence.rawReport.toString();
    const hasMockFlags = MOCK_FLAGS.every((flag) => rawStr.includes(flag));

    if (hasMockFlags) {
      throw new Error('Cannot normalize mock data in Real Evidence Normalizer');
    }

    if (evidence.providerType === 'TDX') {
      TdxQuoteParser.parse(evidence.rawReport);
    } else if (evidence.providerType === 'SEV-SNP') {
      SevReportParser.parse(evidence.rawReport);
    } else {
      throw new Error(`Unsupported provider type for Real Evidence Normalizer`);
    }

    return {
      isValid: true,
      provider: evidence.providerType,
      isMock: false,
      tcbStatus: 'Unknown',
      timestamp: Date.now(),
      pocScope: 'structure-only',
    };
  }
}
