import { SevReportParser } from '../parsers/sev-report-parser.js';
import {
  OfflineCollateralLoader,
  verifyEcdsaSignature,
  verifyResearchCertChain,
} from './offline-collateral-loader.js';
import { TeeVerifier, VerificationLevel, VerificationResult } from './verification-interface.js';
import { OfflineReportFixture, OfflineCollateralFixture } from './offline-collateral-interface.js';

export interface SevOfflineVerifierOptions {
  reportFixture?: OfflineReportFixture;
  collateral?: OfflineCollateralFixture;
}

/**
 * Phase 8.9B offline VCEK verification PoC.
 *
 * Uses static research fixtures and Node.js crypto ECDSA P-384.
 * No KDS connection. Not production VCEK verification.
 */
export class SevVcekOfflineVerifier implements TeeVerifier {
  private readonly reportFixture: OfflineReportFixture;
  private readonly collateral: OfflineCollateralFixture;

  constructor(options: SevOfflineVerifierOptions = {}) {
    if (options.reportFixture && options.collateral) {
      this.reportFixture = options.reportFixture;
      this.collateral = options.collateral;
    } else {
      const bundle = OfflineCollateralLoader.loadSevBundle();
      this.reportFixture = bundle.report;
      this.collateral = bundle.collateral;
    }
  }

  verify(rawReport: Buffer): VerificationResult {
    try {
      SevReportParser.parse(rawReport);

      if (rawReport.length < this.reportFixture.signatureOffset + this.reportFixture.signatureLength) {
        return this.fail('Report buffer too short for offline signature region');
      }

      if (!verifyResearchCertChain(this.collateral.certificateChainPem)) {
        return this.fail('Research certificate chain validation failed');
      }

      const payload = rawReport.subarray(
        this.reportFixture.signedPayloadOffset,
        this.reportFixture.signedPayloadOffset + this.reportFixture.signedPayloadLength,
      );
      const signature = rawReport.subarray(
        this.reportFixture.signatureOffset,
        this.reportFixture.signatureOffset + this.reportFixture.signatureLength,
      );

      const sigOk = verifyEcdsaSignature(
        this.collateral.leafPublicKeyPem,
        payload,
        signature,
        this.reportFixture.hashAlgorithm,
      );

      if (!sigOk) {
        return this.fail('ECDSA signature verification failed (offline PoC)');
      }

      return {
        isValid: true,
        provider: 'SEV-SNP',
        tcbStatus: 'Unknown',
        pocScope: 'offline-verification-poc',
        verificationLevel: VerificationLevel.OFFLINE_FIXTURE,
        message: 'Offline fixture ECDSA valid; not production VCEK verification',
      };
    } catch (e: any) {
      return this.fail(e.message ?? 'SEV offline verification failed');
    }
  }

  private fail(message: string): VerificationResult {
    return {
      isValid: false,
      provider: 'SEV-SNP',
      tcbStatus: 'Unknown',
      pocScope: 'offline-verification-poc',
      verificationLevel: VerificationLevel.OFFLINE_FIXTURE,
      message,
    };
  }
}

export function verifySevOfflineSignatureOnly(
  rawReport: Buffer,
  reportFixture: OfflineReportFixture,
  collateral: OfflineCollateralFixture,
): boolean {
  const payload = rawReport.subarray(
    reportFixture.signedPayloadOffset,
    reportFixture.signedPayloadOffset + reportFixture.signedPayloadLength,
  );
  const signature = rawReport.subarray(
    reportFixture.signatureOffset,
    reportFixture.signatureOffset + reportFixture.signatureLength,
  );
  return verifyEcdsaSignature(
    collateral.leafPublicKeyPem,
    payload,
    signature,
    reportFixture.hashAlgorithm,
  );
}
