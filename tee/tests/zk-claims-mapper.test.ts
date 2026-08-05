import { RealEvidenceNormalizer } from '../normalizers/real-evidence-normalizer.js';
import { ZkClaimsMapper } from '../integration/zk-claims-mapper.js';
import assert from 'assert';

async function runTests() {
  console.log('--- ZK Claims Mapper Tests ---');

  const tdxBuffer = Buffer.alloc(48);
  tdxBuffer.writeUInt16LE(4, 0);
  const tdxNormalized = RealEvidenceNormalizer.normalize({
    providerType: 'TDX',
    rawReport: tdxBuffer,
  });
  const tdxClaims = ZkClaimsMapper.toClaims(tdxNormalized, tdxBuffer);
  assert.strictEqual(tdxClaims.teeProviderId, 'TDX');
  assert.strictEqual(tdxClaims.pocScope, 'claims-mapper-poc');
  assert.strictEqual(tdxClaims.sourcePocScope, 'structure-only');
  assert.strictEqual(tdxClaims.measurementHash.length, 64);

  const sevBuffer = Buffer.alloc(1184);
  sevBuffer.writeUInt32LE(2, 0);
  const sevNormalized = RealEvidenceNormalizer.normalize({
    providerType: 'SEV-SNP',
    rawReport: sevBuffer,
  });
  const sevClaims = ZkClaimsMapper.toClaims(sevNormalized, sevBuffer);
  assert.strictEqual(sevClaims.teeProviderId, 'SEV-SNP');

  try {
    ZkClaimsMapper.toClaims(
      { ...tdxNormalized, isMock: true as false },
      tdxBuffer
    );
    assert.fail('Should reject mock flag');
  } catch (e: any) {
    assert.match(e.message, /Cannot map mock evidence/);
  }

  console.log('✅ zk-claims-mapper.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ zk-claims-mapper.test.ts failed', e);
  process.exit(1);
});
