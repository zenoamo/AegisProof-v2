import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import { TeeVerifier, VerificationResult } from './verification-interface.js';

/**
 * Phase 8.8 PoC DCAP verifier stub.
 *
 * Cryptographic verification and PCCS connection are not implemented.
 * Only structural quote validation is performed.
 * Production use is prohibited.
 */
export class TdxDcapVerifierStub implements TeeVerifier {
  verify(rawReport: Buffer): VerificationResult {
    try {
      TdxQuoteParser.parse(rawReport);
      return {
        isValid: true,
        provider: 'TDX',
        tcbStatus: 'Unknown',
        pocScope: 'verification-stub',
        message: 'Structure valid; DCAP signature verification not implemented',
      };
    } catch (e: any) {
      return {
        isValid: false,
        provider: 'TDX',
        tcbStatus: 'Unknown',
        pocScope: 'verification-stub',
        message: e.message ?? 'TDX quote structure validation failed',
      };
    }
  }
}
