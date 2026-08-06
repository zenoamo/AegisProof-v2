import assert from 'assert';
import { VerificationLevel, isAtLeast } from '../domain/verification-level.js';
import { TdxDcapVerifierStub } from '../verification/tdx-dcap-verifier-stub.js';
import { SevVcekVerifierStub } from '../verification/sev-vcek-verifier-stub.js';
import { TdxDcapOfflineVerifier } from '../verification/tdx-dcap-offline-verifier.js';
import { SevVcekOfflineVerifier } from '../verification/sev-vcek-offline-verifier.js';
import {
  OfflineCollateralLoader,
  bufferFromFixtureHex,
} from '../verification/offline-collateral-loader.js';

async function runTests() {
  console.log('--- Verification Level Tests (Phase 8.9C-pre.1) ---');

  assert.strictEqual(VerificationLevel.NONE, 0);
  assert.strictEqual(VerificationLevel.STRUCTURE_ONLY, 1);
  assert.strictEqual(VerificationLevel.OFFLINE_FIXTURE, 2);
  assert.strictEqual(VerificationLevel.OFFLINE_VERIFIED, 3);
  assert.strictEqual(VerificationLevel.HARDWARE_ROOTED, 4);

  assert.strictEqual(isAtLeast(VerificationLevel.OFFLINE_FIXTURE, VerificationLevel.STRUCTURE_ONLY), true);
  assert.strictEqual(isAtLeast(VerificationLevel.STRUCTURE_ONLY, VerificationLevel.OFFLINE_FIXTURE), false);

  const validTdx = Buffer.alloc(48);
  validTdx.writeUInt16LE(4, 0);
  const tdxStub = new TdxDcapVerifierStub().verify(validTdx);
  assert.strictEqual(tdxStub.verificationLevel, VerificationLevel.STRUCTURE_ONLY);

  const validSev = Buffer.alloc(1184);
  validSev.writeUInt32LE(2, 0);
  const sevStub = new SevVcekVerifierStub().verify(validSev);
  assert.strictEqual(sevStub.verificationLevel, VerificationLevel.STRUCTURE_ONLY);

  const tdxBundle = OfflineCollateralLoader.loadTdxBundle();
  const tdxQuote = bufferFromFixtureHex(tdxBundle.quote.quoteHex);
  const tdxOffline = new TdxDcapOfflineVerifier({
    quoteFixture: tdxBundle.quote,
    collateral: tdxBundle.collateral,
  }).verify(tdxQuote);
  assert.strictEqual(tdxOffline.verificationLevel, VerificationLevel.OFFLINE_FIXTURE);

  const sevBundle = OfflineCollateralLoader.loadSevBundle();
  const sevReport = bufferFromFixtureHex(sevBundle.report.reportHex);
  const sevOffline = new SevVcekOfflineVerifier({
    reportFixture: sevBundle.report,
    collateral: sevBundle.collateral,
  }).verify(sevReport);
  assert.strictEqual(sevOffline.verificationLevel, VerificationLevel.OFFLINE_FIXTURE);

  const tdxInvalidFixture = OfflineCollateralLoader.loadTdxQuote('tdx/quote-invalid.json');
  const tdxInvalid = new TdxDcapOfflineVerifier({
    quoteFixture: tdxInvalidFixture,
    collateral: tdxBundle.collateral,
  }).verify(bufferFromFixtureHex(tdxInvalidFixture.quoteHex));
  assert.strictEqual(tdxInvalid.isValid, false);
  assert.strictEqual(tdxInvalid.verificationLevel, VerificationLevel.OFFLINE_FIXTURE);

  console.log('✅ verification-level.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ verification-level.test.ts failed', e);
  process.exit(1);
});
