import { TdxQuoteParser } from '../parsers/tdx-quote-parser.js';
import { TdxProvider } from '../providers/tdx-provider.js';
import assert from 'assert';

async function runTests() {
  console.log('--- Real TDX PoC Tests ---');
  
  // 1. Parser: Success
  const validBuffer = Buffer.alloc(48);
  validBuffer.writeUInt16LE(4, 0);
  const parsed = TdxQuoteParser.parse(validBuffer);
  assert.strictEqual(parsed.providerType, 'TDX');

  // 2. Parser: Invalid length
  try {
    TdxQuoteParser.parse(Buffer.alloc(10));
    assert.fail('Should reject short buffer');
  } catch (e: any) {
    assert.match(e.message, /too short/);
  }

  // 3. Parser: Invalid version
  try {
    const badVersion = Buffer.alloc(48);
    badVersion.writeUInt16LE(3, 0);
    TdxQuoteParser.parse(badVersion);
    assert.fail('Should reject invalid version');
  } catch (e: any) {
    assert.match(e.message, /Unsupported TDX Quote version/);
  }

  // 4. Provider: device unavailable
  const provider = new TdxProvider();
  try {
    await provider.generateEvidence(Buffer.from('test'));
    assert.fail('Should fail without device');
  } catch (e: any) {
    assert.match(e.message, /device unavailable/);
  }

  console.log('✅ Real TDX PoC Tests Passed');
}

runTests().catch(e => {
  console.error('❌ Real TDX PoC Tests Failed', e);
  process.exit(1);
});
