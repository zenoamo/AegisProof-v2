import { Evidence } from './provider-interface.js';

export interface NormalizedEvidence {
  isValid: boolean;
  provider: string;
  isMock: boolean;
  tcbStatus: string;
  timestamp: number;
}

export class EvidenceNormalizer {
  static normalize(evidence: Evidence): NormalizedEvidence {
    const rawStr = evidence.rawReport.toString();
    const isMock = rawStr.includes('MOCK_DATA_ONLY') && 
                   rawStr.includes('NOT_REAL_ATTESTATION') && 
                   rawStr.includes('DO_NOT_USE_IN_PRODUCTION');

    if (!isMock) {
      throw new Error("Cannot normalize production data in Mock Normalizer");
    }

    return {
      isValid: true,
      provider: evidence.providerType,
      isMock: true,
      tcbStatus: 'UpToDate',
      timestamp: Date.now()
    };
  }
}
