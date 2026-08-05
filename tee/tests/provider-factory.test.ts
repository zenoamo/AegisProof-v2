import { ProviderFactory } from '../providers/provider-factory.js';
import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { SevProviderMock } from '../mock/sev-provider-mock.js';
import { TdxProvider } from '../providers/tdx-provider.js';
import { SevSnpProvider } from '../providers/sev-snp-provider.js';
import assert from 'assert';

function withTeeEnv(env: string | undefined, fn: () => void): void {
  const saved = process.env.TEE_ENV;
  if (env === undefined) {
    delete process.env.TEE_ENV;
  } else {
    process.env.TEE_ENV = env;
  }
  try {
    fn();
  } finally {
    if (saved === undefined) {
      delete process.env.TEE_ENV;
    } else {
      process.env.TEE_ENV = saved;
    }
  }
}

async function runTests() {
  console.log('--- ProviderFactory Tests ---');

  withTeeEnv(undefined, () => {
    assert.ok(ProviderFactory.getProvider('TDX') instanceof TdxProviderMock);
    assert.ok(ProviderFactory.getProvider('SEV-SNP') instanceof SevProviderMock);
  });

  withTeeEnv('mock', () => {
    assert.ok(ProviderFactory.getProvider('TDX') instanceof TdxProviderMock);
    assert.ok(ProviderFactory.getProvider('SEV-SNP') instanceof SevProviderMock);
  });

  withTeeEnv('tdx', () => {
    assert.ok(ProviderFactory.getProvider('TDX') instanceof TdxProvider);
  });

  withTeeEnv('sev', () => {
    assert.ok(ProviderFactory.getProvider('SEV-SNP') instanceof SevSnpProvider);
  });

  assert.strictEqual(process.env.TEE_ENV, undefined, 'TEE_ENV must be restored after tests');

  console.log('✅ provider-factory.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ provider-factory.test.ts failed', e);
  process.exit(1);
});
