import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import {
  OfflineCollateralLoader,
  verifyEcdsaSignature,
  verifyResearchCertChain,
} from './offline-collateral-loader.js';
import { TeeVerifier, VerificationResult } from './verification-interface.js';
import { OfflineQuoteFixture, OfflineCollateralFixture } from './offline-collateral-interface.js';

export interface TdxOfflineVerifierOptions {
  quoteFixture?: OfflineQuoteFixture;
  collateral?: OfflineCollateralFixture;
}

/**
 * Phase 8.9B offline DCAP verification PoC.
 *
 * Uses static research fixtures and Node.js crypto ECDSA P-256.
 * No PCCS connection. Not production DCAP verification.
 */
export class TdxDcapOfflineVerifier implements TeeVerifier {
  private readonly quoteFixture: OfflineQuoteFixture;
  private readonly collateral: OfflineCollateralFixture;

  constructor(options: TdxOfflineVerifierOptions = {}) {
    if (options.quoteFixture && options.collateral) {
      this.quoteFixture = options.quoteFixture;
      this.collateral = options.collateral;
    } else {
      const bundle = OfflineCollateralLoader.loadTdxBundle();
      this.quoteFixture = bundle.quote;
      this.collateral = bundle.collateral;
    }
  }

  verify(rawReport: Buffer): VerificationResult {
    try {
      TdxQuoteParser.parse(rawReport);

      if (rawReport.length < this.quoteFixture.signatureOffset + this.quoteFixture.signatureLength) {
        return this.fail('Report buffer too short for offline signature region');
      }

      if (!verifyResearchCertChain(this.collateral.certificateChainPem)) {
        return this.fail('Research certificate chain validation failed');
      }

      const payload = rawReport.subarray(
        this.quoteFixture.signedPayloadOffset,
        this.quoteFixture.signedPayloadOffset + this.quoteFixture.signedPayloadLength,
      );
      const signature = rawReport.subarray(
        this.quoteFixture.signatureOffset,
        this.quoteFixture.signatureOffset + this.quoteFixture.signatureLength,
      );

      const sigOk = verifyEcdsaSignature(
        this.collateral.leafPublicKeyPem,
        payload,
        signature,
        this.quoteFixture.hashAlgorithm,
      );

      if (!sigOk) {
        return this.fail('ECDSA signature verification failed (offline PoC)');
      }

      return {
        isValid: true,
        provider: 'TDX',
        tcbStatus: 'Unknown',
        pocScope: 'offline-verification-poc',
        message: 'Offline fixture ECDSA valid; not production DCAP verification',
      };
    } catch (e: any) {
      return this.fail(e.message ?? 'TDX offline verification failed');
    }
  }

  private fail(message: string): VerificationResult {
    return {
      isValid: false,
      provider: 'TDX',
      tcbStatus: 'Unknown',
      pocScope: 'offline-verification-poc',
      message,
    };
  }
}