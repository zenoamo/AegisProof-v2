import { AcquisitionFactory } from '../acquisition/acquisition-factory.js';
import { TdxGuestReader } from '../acquisition/tdx-guest-reader.js';
import { ExperimentalTdxGuestReader } from '../acquisition/experimental-tdx-guest-reader.js';
import { ExperimentalSevGuestReader } from '../acquisition/experimental-sev-guest-reader.js';
import assert from 'assert';

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const saved = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    fn();
  } finally {
    if (saved === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved;
    }
  }
}

async function runTests() {
  console.log('--- Ioctl Acquisition Tests (Phase 8.8b skeleton) ---');

  withEnv('TEE_ACQUISITION', undefined, () => {
    assert.ok(AcquisitionFactory.getTdxReader() instanceof TdxGuestReader);
  });

  withEnv('TEE_ACQUISITION', 'experimental', () => {
    assert.ok(AcquisitionFactory.getTdxReader() instanceof ExperimentalTdxGuestReader);
    assert.ok(AcquisitionFactory.getSevReader() instanceof ExperimentalSevGuestReader);
  });

  if (process.platform !== 'linux') {
    const reader = new ExperimentalTdxGuestReader();
    try {
      reader.acquireRawReport(Buffer.from('test'));
      assert.fail('Should require Linux');
    } catch (e: any) {
      assert.match(e.message, /requires Linux/);
    }
  } else if (!new ExperimentalTdxGuestReader().isAvailable()) {
    const reader = new ExperimentalTdxGuestReader();
    try {
      reader.acquireRawReport(Buffer.from('test'));
      assert.fail('Should fail when device unavailable');
    } catch (e: any) {
      assert.match(e.message, /device unavailable/);
    }
  }

  assert.strictEqual(process.env.TEE_ACQUISITION, undefined, 'TEE_ACQUISITION must be restored');

  console.log('✅ ioctl-acquisition.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ ioctl-acquisition.test.ts failed', e);
  process.exit(1);
});
