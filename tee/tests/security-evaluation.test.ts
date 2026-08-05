import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { SevProviderMock } from '../mock/sev-provider-mock.js';
import { EvidenceNormalizer } from '../mock/evidence-normalizer.js';
import assert from 'assert';

async function runSecurityTests() {
  const tdx = new TdxProviderMock();
  const dummyData = Buffer.from('test_measurement');

  // 1. Fake Evidence Rejection
  try {
    const fakeEvidence = { providerType: 'TDX' as const, rawReport: Buffer.from('fake_report_without_flags') };
    EvidenceNormalizer.normalize(fakeEvidence);
    assert.fail('Should reject fake evidence missing mock flags');
  } catch (e: any) {
    assert.match(e.message, /Cannot normalize/);
  }

  // 2. Invalid Signature Rejection (Simulated)
  tdx.simulateError('InvalidSignature');
  try {
    const evidence = await tdx.generateEvidence(dummyData);
    await tdx.verifyEvidence(evidence);
    assert.fail('Should reject on InvalidSignature');
  } catch (e: any) {
    assert.match(e.message, /InvalidSignature/);
  }
  tdx.simulateError(null);

  // 3. Provider Timeout (Simulated)
  tdx.simulateError('Timeout');
  try {
    await tdx.generateEvidence(dummyData);
    assert.fail('Should reject on Timeout');
  } catch (e: any) {
    assert.match(e.message, /Timeout/);
  }
  tdx.simulateError(null);

  console.log('✅ Security Evaluation Passed');
}

runSecurityTests().catch(e => {
  console.error('❌ Security Evaluation Failed', e);
  process.exit(1);
});
