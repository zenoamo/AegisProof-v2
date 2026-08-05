import { TeeProvider, Evidence } from '../mock/provider-interface.js';
import { SevReportParser } from '../parsers/sev-report-parser.js';
import { TeeDeviceReader } from '../acquisition/device-reader-interface.js';
import { AcquisitionFactory } from '../acquisition/acquisition-factory.js';

export class SevSnpProvider implements TeeProvider {
  private errorType: string | null = null;
  private readonly reader: TeeDeviceReader;

  constructor(reader: TeeDeviceReader = AcquisitionFactory.getSevReader()) {
    this.reader = reader;
  }

  async generateEvidence(reportData: Buffer): Promise<Evidence> {
    if (this.errorType) {
      throw new Error(`Simulated Error: ${this.errorType}`);
    }

    const rawReport = this.reader.acquireRawReport(reportData);
    return SevReportParser.parse(rawReport);
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
