import { TeeProvider, Evidence } from '../mock/provider-interface.js';
import { SevReportParser } from '../parsers/sev-report-parser.js';
import fs from 'fs';

export class SevSnpProvider implements TeeProvider {
  private errorType: string | null = null;

  async generateEvidence(reportData: Buffer): Promise<Evidence> {
    if (this.errorType) {
      throw new Error(`Simulated Error: ${this.errorType}`);
    }

    if (!fs.existsSync('/dev/sev-guest')) {
      throw new Error('device unavailable: /dev/sev-guest not found (controlled failure)');
    }

    const dummyReport = Buffer.alloc(1184);
    dummyReport.writeUInt32LE(2, 0);
    return SevReportParser.parse(dummyReport);
  }

  /**
   * Phase 8.6 PoC stub.
   *
   * Cryptographic verification is not implemented.
   * Only structural validation is performed.
   * Production use is prohibited.
   */
  async verifyEvidence(evidence: Evidence): Promise<boolean> {
    if (this.errorType) {
      throw new Error(`Simulated Error: ${this.errorType}`);
    }

    if (evidence.providerType !== 'SEV-SNP') {
      return false;
    }

    try {
      SevReportParser.parse(evidence.rawReport);
      return true;
    } catch {
      return false;
    }
  }

  simulateError(errorType: string | null): void {
    this.errorType = errorType;
  }
}
