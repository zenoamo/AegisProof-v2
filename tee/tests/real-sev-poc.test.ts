import { SevReportParser } from '../parsers/sev-report-parser.js';
import { SevSnpProvider } from '../providers/sev-snp-provider.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Real SEV-SNP PoC Tests ---');
  
  // 1. Parser: Success
  const validBuffer = Buffer.alloc(1184);
  validBuffer.writeUInt32LE(2, 0);
  const parsed = SevReportParser.parse(validBuffer);
  assert.strictEqual(parsed.providerType, 'SEV-SNP');

  // 2. Parser: Invalid length
  try {
    SevReportParser.parse(Buffer.alloc(100));
    assert.fail('Should reject short buffer');
  } catch (e: any) {
    assert.match(e.message, /too short/);
  }

  // 3. Parser: Invalid version
  try {
    const badVersion = Buffer.alloc(1184);
    badVersion.writeUInt32LE(1, 0);
    SevReportParser.parse(badVersion);
    assert.fail('Should reject invalid version');
  } catch (e: any) {
    assert.match(e.message, /Unsupported SEV-SNP Report version/);
  }

  // 4. Provider: device unavailable
  const provider = new SevSnpProvider();
  try {
    await provider.generateEvidence(Buffer.from('test'));
    assert.fail('Should fail without device');
  } catch (e: any) {
    assert.match(e.message, /device unavailable/);
  }

  console.log('✅ Real SEV-SNP PoC Tests Passed');
}

runTests().catch(e => {
  console.error('❌ Real SEV-SNP PoC Tests Failed', e);
  process.exit(1);
});
