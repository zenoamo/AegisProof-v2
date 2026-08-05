import { TeeProvider } from './provider-interface.js';
import { TdxProviderMock } from './tdx-provider-mock.js';
import { SevProviderMock } from './sev-provider-mock.js';

export class EvidenceGenerator {
  static getProvider(type: 'TDX' | 'SEV-SNP'): TeeProvider {
    if (type === 'TDX') {
      return new TdxProviderMock();
    } else {
      return new SevProviderMock();
    }
  }
}
