import assert from 'assert';
import { loadTeeRuntimeConfig } from '../config/tee-runtime-config.js';

function configFrom(env: Record<string, string | undefined>) {
  return loadTeeRuntimeConfig(env as NodeJS.ProcessEnv);
}

async function runTests() {
  console.log('--- TeeRuntimeConfig Tests (Phase 8.9C-pre.2) ---');

  const defaults = configFrom({});
  assert.strictEqual(defaults.env, 'mock');
  assert.strictEqual(defaults.acquisition, 'default');
  assert.strictEqual(defaults.verification, 'stub');

  assert.strictEqual(configFrom({ TEE_ENV: undefined }).env, 'mock');
  assert.strictEqual(configFrom({ TEE_ENV: 'mock' }).env, 'mock');
  assert.strictEqual(configFrom({ TEE_ENV: 'tdx' }).env, 'tdx');
  assert.strictEqual(configFrom({ TEE_ENV: 'sev' }).env, 'sev-snp');
  assert.strictEqual(configFrom({ TEE_ENV: 'sev-snp' }).env, 'sev-snp');
  assert.strictEqual(configFrom({ TEE_ENV: 'production' }).env, 'mock');

  assert.strictEqual(configFrom({ TEE_ACQUISITION: undefined }).acquisition, 'default');
  assert.strictEqual(configFrom({ TEE_ACQUISITION: 'experimental' }).acquisition, 'experimental');
  assert.strictEqual(configFrom({ TEE_ACQUISITION: 'ioctl' }).acquisition, 'default');

  assert.strictEqual(configFrom({ TEE_VERIFICATION: undefined }).verification, 'stub');
  assert.strictEqual(configFrom({ TEE_VERIFICATION: 'offline' }).verification, 'offline');
  assert.strictEqual(configFrom({ TEE_VERIFICATION: ' OFFLINE ' }).verification, 'offline');
  assert.strictEqual(configFrom({ TEE_VERIFICATION: 'remote' }).verification, 'stub');

  console.log('✅ tee-runtime-config.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ tee-runtime-config.test.ts failed', e);
  process.exit(1);
});
