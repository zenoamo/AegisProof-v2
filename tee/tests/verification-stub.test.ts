import { TdxDcapVerifierStub } from '../verification/tdx-dcap-verifier-stub.js';
import { SevVcekVerifierStub } from '../verification/sev-vcek-verifier-stub.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Verification Stub Tests ---');

  const tdxVerifier = new TdxDcapVerifierStub();
  const sevVerifier = new SevVcekVerifierStub();

  const validTdx = Buffer.alloc(48);
  validTdx.writeUInt16LE(4, 0);
  const tdxResult = tdxVerifier.verify(validTdx);
  assert.strictEqual(tdxResult.isValid, true);
  assert.strictEqual(tdxResult.pocScope, 'verification-stub');
  assert.match(tdxResult.message, /DCAP signature verification not implemented/);

  const validSev = Buffer.alloc(1184);
  validSev.writeUInt32LE(2, 0);
  const sevResult = sevVerifier.verify(validSev);
  assert.strictEqual(sevResult.isValid, true);
  assert.strictEqual(sevResult.pocScope, 'verification-stub');
  assert.match(sevResult.message, /VCEK signature verification not implemented/);

  const invalidTdx = tdxVerifier.verify(Buffer.alloc(10));
  assert.strictEqual(invalidTdx.isValid, false);

  const invalidSev = sevVerifier.verify(Buffer.alloc(100));
  assert.strictEqual(invalidSev.isValid, false);

  console.log('✅ verification-stub.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ verification-stub.test.ts failed', e);
  process.exit(1);
});
