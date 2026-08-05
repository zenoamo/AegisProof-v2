/**
 * Phase 8.9B offline collateral types.
 * RESEARCH_FIXTURE_ONLY — not production credentials.
 */

export interface OfflineQuoteFixture {
  RESEARCH_FIXTURE_ONLY: boolean;
  description: string;
  quoteHex: string;
  signedPayloadOffset: number;
  signedPayloadLength: number;
  signatureOffset: number;
  signatureLength: number;
  hashAlgorithm: 'SHA256' | 'SHA384';
  curve: 'P-256' | 'P-384';
}

export interface OfflineReportFixture {
  RESEARCH_FIXTURE_ONLY: boolean;
  description: string;
  reportHex: string;
  signedPayloadOffset: number;
  signedPayloadLength: number;
  signatureOffset: number;
  signatureLength: number;
  hashAlgorithm: 'SHA256' | 'SHA384';
  curve: 'P-256' | 'P-384';
}

export interface OfflineCollateralFixture {
  RESEARCH_FIXTURE_ONLY: boolean;
  description: string;
  leafPublicKeyPem: string;
  certificateChainPem: string[];
  note?: string;
}

export interface OfflineTdxFixtureBundle {
  quote: OfflineQuoteFixture;
  collateral: OfflineCollateralFixture;
}

export interface OfflineSevFixtureBundle {
  report: OfflineReportFixture;
  collateral: OfflineCollateralFixture;
}
