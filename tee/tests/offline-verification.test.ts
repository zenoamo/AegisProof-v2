import assert from 'assert';
import { VerificationFactory } from '../verification/verification-factory.js';
import { TdxDcapVerifierStub } from '../verification/tdx-dcap-verifier-stub.js';
import { SevVcekVerifierStub } from '../verification/sev-vcek-verifier-stub.js';
import { TdxDcapOfflineVerifier } from '../verification/tdx-dcap-offline-verifier.js';
import { SevVcekOfflineVerifier } from '../verification/sev-vcek-offline-verifier.js';
import {
  OfflineCollateralLoader,
  bufferFromFixtureHex,
} from '../verification/offline-collateral-loader.js';

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const prev = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    fn();
  } finally {
    if (prev === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = prev;
    }
  }
}

async function runTests() {
  console.log('--- Offline Verification Tests (Phase 8.9B) ---');

  withEnv('TEE_VERIFICATION', undefined, () => {
    assert(VerificationFactory.getMode() === 'stub');
    assert(VerificationFactory.getTdxVerifier() instanceof TdxDcapVerifierStub);
    assert(VerificationFactory.getSevVerifier() instanceof SevVcekVerifierStub);
  });

  withEnv('TEE_VERIFICATION', 'offline', () => {
    assert(VerificationFactory.getMode() === 'offline');
    assert(VerificationFactory.getTdxVerifier() instanceof TdxDcapOfflineVerifier);
    assert(VerificationFactory.getSevVerifier() instanceof SevVcekOfflineVerifier);
  });

  const tdxBundle = OfflineCollateralLoader.loadTdxBundle();
  const tdxQuote = bufferFromFixtureHex(tdxBundle.quote.quoteHex);
  const tdxVerifier = new TdxDcapOfflineVerifier({
    quoteFixture: tdxBundle.quote,
    collateral: tdxBundle.collateral,
  });
  const tdxOk = tdxVerifier.verify(tdxQuote);
  assert.strictEqual(tdxOk.isValid, true);
  assert.strictEqual(tdxOk.pocScope, 'offline-verification-poc');
  assert.match(tdxOk.message, /not production DCAP/);

  const tdxInvalidFixture = OfflineCollateralLoader.loadTdxQuote('tdx/quote-invalid.json');
  const tdxBad = bufferFromFixtureHex(tdxInvalidFixture.quoteHex);
  const tdxBadResult = new TdxDcapOfflineVerifier({
    quoteFixture: tdxInvalidFixture,
    collateral: tdxBundle.collateral,
  }).verify(tdxBad);
  assert.strictEqual(tdxBadResult.isValid, false);

  const sevBundle = OfflineCollateralLoader.loadSevBundle();
  const sevReport = bufferFromFixtureHex(sevBundle.report.reportHex);
  const sevVerifier = new SevVcekOfflineVerifier({
    reportFixture: sevBundle.report,
    collateral: sevBundle.collateral,
  });
  const sevOk = sevVerifier.verify(sevReport);
  assert.strictEqual(sevOk.isValid, true);
  assert.strictEqual(sevOk.pocScope, 'offline-verification-poc');
  assert.match(sevOk.message, /not production VCEK/);

  const sevInvalidFixture = OfflineCollateralLoader.loadSevReport('sev/report-invalid.json');
  const sevBad = bufferFromFixtureHex(sevInvalidFixture.reportHex);
  const sevBadResult = new SevVcekOfflineVerifier({
    reportFixture: sevInvalidFixture,
    collateral: sevBundle.collateral,
  }).verify(sevBad);
  assert.strictEqual(sevBadResult.isValid, false);

  // Collateral loader is filesystem-only (no fetch / PCCS / KDS imports in module).
  assert.match(
    OfflineCollateralLoader.loadTdxBundle().collateral.description,
    /research|Synthetic/i,
  );

  console.log('✅ offline-verification.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ offline-verification.test.ts failed', e);
  process.exit(1);
});
