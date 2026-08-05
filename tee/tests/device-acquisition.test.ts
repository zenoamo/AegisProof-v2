import { TdxGuestReader } from '../acquisition/tdx-guest-reader.js';
import { SevGuestReader } from '../acquisition/sev-guest-reader.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Device Acquisition Tests ---');

  const tdxReader = new TdxGuestReader();
  const sevReader = new SevGuestReader();

  assert.strictEqual(tdxReader.devicePath, '/dev/tdx_guest');
  assert.strictEqual(sevReader.devicePath, '/dev/sev-guest');

  if (!tdxReader.isAvailable()) {
    try {
      tdxReader.acquireRawReport(Buffer.from('test'));
      assert.fail('TDX reader should fail when device unavailable');
    } catch (e: any) {
      assert.match(e.message, /device unavailable/);
    }
  }

  if (!sevReader.isAvailable()) {
    try {
      sevReader.acquireRawReport(Buffer.from('test'));
      assert.fail('SEV reader should fail when device unavailable');
    } catch (e: any) {
      assert.match(e.message, /device unavailable/);
    }
  }

  console.log('✅ device-acquisition.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ device-acquisition.test.ts failed', e);
  process.exit(1);
});
