import { TeeProvider, Evidence } from '../mock/provider-interface.js';
import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import fs from 'fs';

export class TdxProvider implements TeeProvider {
  private errorType: string | null = null;

  async generateEvidence(reportData: Buffer): Promise<Evidence> {
    if (this.errorType) {
      throw new Error(`Simulated Error: ${this.errorType}`);
    }

    if (!fs.existsSync('/dev/tdx_guest')) {
      throw new Error('device unavailable: /dev/tdx_guest not found (controlled failure)');
    }

    const dummyQuote = Buffer.alloc(48);
    dummyQuote.writeUInt16LE(4, 0);
    return TdxQuoteParser.parse(dummyQuote);
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
