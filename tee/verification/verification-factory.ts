import { loadTeeRuntimeConfig } from '../config/tee-runtime-config.js';
import { TdxDcapVerifierStub } from './tdx-dcap-verifier-stub.js';
import { SevVcekVerifierStub } from './sev-vcek-verifier-stub.js';
import { TdxDcapOfflineVerifier } from './tdx-dcap-offline-verifier.js';
import { SevVcekOfflineVerifier } from './sev-vcek-offline-verifier.js';
import { TeeVerifier } from './verification-interface.js';

export type VerificationMode = 'stub' | 'offline';

/**
 * Phase 8.9B verification factory.
 *
 * TEE_VERIFICATION unset → stub (default, Stage D unchanged)
 * TEE_VERIFICATION=offline → offline fixture verifiers (Stage F)
 */
export class VerificationFactory {
  static getMode(): VerificationMode {
    return loadTeeRuntimeConfig().verification;
  }

  static getTdxVerifier(): TeeVerifier {
    if (this.getMode() === 'offline') {
      return new TdxDcapOfflineVerifier();
    }
    return new TdxDcapVerifierStub();
  }

  static getSevVerifier(): TeeVerifier {
    if (this.getMode() === 'offline') {
      return new SevVcekOfflineVerifier();
    }
    return new SevVcekVerifierStub();
  }
}
