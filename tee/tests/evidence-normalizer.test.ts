import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { SevProviderMock } from '../mock/sev-provider-mock.js';
import { EvidenceNormalizer } from '../mock/evidence-normalizer.js';
import assert from 'assert';

async function runTests() {
  const tdx = new TdxProviderMock();
  const sev = new SevProviderMock();
  const dummyData = Buffer.from('test_data');

  // Test TDX
  const tdxEvidence = await tdx.generateEvidence(dummyData);
  const tdxNormalized = EvidenceNormalizer.normalize(tdxEvidence);
  assert.strictEqual(tdxNormalized.provider, 'TDX');
  assert.strictEqual(tdxNormalized.isMock, true);

  // Test SEV-SNP
  const sevEvidence = await sev.generateEvidence(dummyData);
  const sevNormalized = EvidenceNormalizer.normalize(sevEvidence);
  assert.strictEqual(sevNormalized.provider, 'SEV-SNP');
  assert.strictEqual(sevNormalized.isMock, true);

  // Test Real Data Rejection
  try {
    EvidenceNormalizer.normalize({ providerType: 'TDX', rawReport: Buffer.from('real_data') });
    assert.fail('Should reject real data');
  } catch (e: any) {
    assert.strictEqual(e.message, 'Cannot normalize production data in Mock Normalizer');
  }

  console.log('✅ evidence-normalizer.test.ts passed');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
