import { TeeProvider, Evidence } from './provider-interface.js';

export class SevProviderMock implements TeeProvider {
  private errorToSimulate: string | null = null;

  async generateEvidence(reportData: Buffer): Promise<Evidence> {
    if (this.errorToSimulate) {
      throw new Error(`SEV-SNP Error: ${this.errorToSimulate}`);
    }
    
    // Create a dummy report structure with required flags
    const mockReport = Buffer.concat([
      Buffer.from('MOCK_DATA_ONLY'),
      Buffer.from('NOT_REAL_ATTESTATION'),
      Buffer.from('DO_NOT_USE_IN_PRODUCTION'),
      reportData
    ]);

    return {
      providerType: 'SEV-SNP',
      rawReport: mockReport
    };
  }

  async verifyEvidence(evidence: Evidence): Promise<boolean> {
    if (this.errorToSimulate) {
        throw new Error(`SEV-SNP Verification Error: ${this.errorToSimulate}`);
    }
    const reportStr = evidence.rawReport.toString();
    if (!reportStr.includes('MOCK_DATA_ONLY')) return false;
    if (!reportStr.includes('NOT_REAL_ATTESTATION')) return false;
    if (!reportStr.includes('DO_NOT_USE_IN_PRODUCTION')) return false;
    
    return true;
  }

  simulateError(errorType: string | null): void {
    this.errorToSimulate = errorType;
  }
}
