import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { EvidenceNormalizer } from '../mock/evidence-normalizer.js';
import assert from 'assert';

class VerificationPolicy {
  static async evaluateZkAndTee(zkValid: boolean, teeEvidence: any, provider: any) {
    if (!zkValid) return false;
    
    try {
      const isValid = await provider.verifyEvidence(teeEvidence);
      if (!isValid) return false;

      const normalized = EvidenceNormalizer.normalize(teeEvidence);
      if (!normalized.isMock) {
          throw new Error('Production data leaked to Mock Policy');
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}

async function runTests() {
  const tdx = new TdxProviderMock();
  const dummyData = Buffer.from('test_data');
  const validEvidence = await tdx.generateEvidence(dummyData);

  // 1. ZK and TEE valid
  const result1 = await VerificationPolicy.evaluateZkAndTee(true, validEvidence, tdx);
  assert.strictEqual(result1, true, 'Both valid should pass');

  // 2. ZK invalid
  const result2 = await VerificationPolicy.evaluateZkAndTee(false, validEvidence, tdx);
  assert.strictEqual(result2, false, 'ZK invalid should fail');

  // 3. TEE invalid signature (simulate via error)
  tdx.simulateError('InvalidSignature');
  const result3 = await VerificationPolicy.evaluateZkAndTee(true, validEvidence, tdx);
  assert.strictEqual(result3, false, 'TEE invalid should fail');
  
  console.log('✅ verification-policy.test.ts passed');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
