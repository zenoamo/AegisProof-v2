import { TeeProvider, Evidence } from '../mock/provider-interface.js';
import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import { TdxGuestReader } from '../acquisition/tdx-guest-reader.js';

export class TdxProvider implements TeeProvider {
  private errorType: string | null = null;
  private readonly reader: TdxGuestReader;

  constructor(reader: TdxGuestReader = new TdxGuestReader()) {
    this.reader = reader;
  }

  async generateEvidence(reportData: Buffer): Promise<Evidence> {
    if (this.errorType) {
      throw new Error(`Simulated Error: ${this.errorType}`);
    }

    const rawQuote = this.reader.acquireRawReport(reportData);
    return TdxQuoteParser.parse(rawQuote);
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

    if (evidence.providerType !== 'TDX') {
      return false;
    }

    try {
      TdxQuoteParser.parse(evidence.rawReport);
      return true;
    } catch {
      return false;
    }
  }

  simulateError(errorType: string | null): void {
    this.errorType = errorType;
  }
}
