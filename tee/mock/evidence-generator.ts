import { TeeProvider } from './provider-interface.js';
import { ProviderFactory } from '../providers/provider-factory.js';

/**
 * Backward-compatible mock-only wrapper around ProviderFactory.
 * Always returns Mock providers regardless of external TEE_ENV.
 */
export class EvidenceGenerator {
  static getProvider(type: 'TDX' | 'SEV-SNP'): TeeProvider {
    const saved = process.env.TEE_ENV;
    process.env.TEE_ENV = 'mock';
    try {
      return ProviderFactory.getProvider(type);
    } finally {
      if (saved === undefined) {
        delete process.env.TEE_ENV;
      } else {
        process.env.TEE_ENV = saved;
      }
    }
  }
}
