import { loadTeeRuntimeConfig } from '../config/tee-runtime-config.js';
import { TeeProvider } from '../mock/provider-interface.js';
import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { SevProviderMock } from '../mock/sev-provider-mock.js';
import { TdxProvider } from './tdx-provider.js';
import { SevSnpProvider } from './sev-snp-provider.js';

/**
 * Phase 8.6 PoC provider selector.
 *
 * Default mode is mock.
 * Real TEE providers require explicit TEE_ENV selection.
 */
export class ProviderFactory {
  static getProvider(type: 'TDX' | 'SEV-SNP'): TeeProvider {
    const { env } = loadTeeRuntimeConfig();

    if (env === 'tdx') {
      return new TdxProvider();
    }
    if (env === 'sev-snp') {
      return new SevSnpProvider();
    }

    if (type === 'TDX') {
      return new TdxProviderMock();
    }
    return new SevProviderMock();
  }
}
