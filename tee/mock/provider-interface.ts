export interface Evidence {
  providerType: 'TDX' | 'SEV-SNP';
  rawReport: Buffer;
  normalizedData?: any;
}

export interface TeeProvider {
  generateEvidence(reportData: Buffer): Promise<Evidence>;
  verifyEvidence(evidence: Evidence): Promise<boolean>;
  simulateError(errorType: string | null): void;
}
