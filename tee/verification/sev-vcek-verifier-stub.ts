import { SevReportParser } from '../parsers/sev-report-parser.js';
import { TeeVerifier, VerificationLevel, VerificationResult } from './verification-interface.js';

/**
 * Phase 8.8 PoC VCEK verifier stub.
 *
 * Cryptographic verification and KDS connection are not implemented.
 * Only structural report validation is performed.
 * Production use is prohibited.
 */
export class SevVcekVerifierStub implements TeeVerifier {
  verify(rawReport: Buffer): VerificationResult {
    try {
      SevReportParser.parse(rawReport);
      return {
        isValid: true,
        provider: 'SEV-SNP',
        tcbStatus: 'Unknown',
        pocScope: 'verification-stub',
        verificationLevel: VerificationLevel.STRUCTURE_ONLY,
        message: 'Structure valid; VCEK signature verification not implemented',
      };
    } catch (e: any) {
      return {
        isValid: false,
        provider: 'SEV-SNP',
        tcbStatus: 'Unknown',
        pocScope: 'verification-stub',
        verificationLevel: VerificationLevel.STRUCTURE_ONLY,
        message: e.message ?? 'SEV-SNP report structure validation failed',
      };
    }
  }
}
