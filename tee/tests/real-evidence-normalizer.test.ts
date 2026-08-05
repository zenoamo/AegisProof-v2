import { RealEvidenceNormalizer } from '../normalizers/real-evidence-normalizer.js';
import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Real Evidence Normalizer Tests ---');

  const tdxRealBuffer = Buffer.alloc(48);
  tdxRealBuffer.writeUInt16LE(4, 0);
  const tdxNormalized = RealEvidenceNormalizer.normalize({
    providerType: 'TDX',
    rawReport: tdxRealBuffer,
  });
  assert.strictEqual(tdxNormalized.provider, 'TDX');
  assert.strictEqual(tdxNormalized.isMock, false);
  assert.strictEqual(tdxNormalized.pocScope, 'structure-only');
  assert.strictEqual(tdxNormalized.tcbStatus, 'Unknown');

  const sevRealBuffer = Buffer.alloc(1184);
  sevRealBuffer.writeUInt32LE(2, 0);
  const sevNormalized = RealEvidenceNormalizer.normalize({
    providerType: 'SEV-SNP',
    rawReport: sevRealBuffer,
  });
  assert.strictEqual(sevNormalized.provider, 'SEV-SNP');
  assert.strictEqual(sevNormalized.isMock, false);
  assert.strictEqual(sevNormalized.pocScope, 'structure-only');

  const mock = new TdxProviderMock();
  const mockEvidence = await mock.generateEvidence(Buffer.from('test'));
  try {
    RealEvidenceNormalizer.normalize(mockEvidence);
    assert.fail('Should reject mock evidence');
  } catch (e: any) {
    assert.match(e.message, /Cannot normalize mock data/);
  }

  try {
    RealEvidenceNormalizer.normalize({
      providerType: 'TDX',
      rawReport: Buffer.alloc(10),
    });
    assert.fail('Should reject malformed evidence');
  } catch (e: any) {
    assert.match(e.message, /too short/);
  }

  console.log('✅ real-evidence-normalizer.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ real-evidence-normalizer.test.ts failed', e);
  process.exit(1);
});
