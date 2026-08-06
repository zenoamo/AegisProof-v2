import assert from 'assert';
import { AttestationErrorCode } from '../domain/attestation-error.js';
import { VerificationLevel } from '../domain/verification-level.js';
import { TeeVerificationResult } from '../domain/tee-verification-result.js';
import { ClaimsGate } from '../integration/claims-gate.js';
import { RealEvidenceNormalizer } from '../normalizers/real-evidence-normalizer.js';
import { ZkClaimsMapper } from '../integration/zk-claims-mapper.js';
import {
  OfflineCollateralLoader,
  bufferFromFixtureHex,
} from '../verification/offline-collateral-loader.js';
import { TdxDcapOfflineVerifier } from '../verification/tdx-dcap-offline-verifier.js';

function makeVerification(
  overrides: Partial<TeeVerificationResult> = {},
): TeeVerificationResult {
  return {
    isValid: true,
    provider: 'TDX',
    tcbStatus: 'Unknown',
    pocScope: 'offline-verification-poc',
    verificationLevel: VerificationLevel.OFFLINE_FIXTURE,
    message: 'Offline fixture ECDSA valid; not production DCAP verification',
    ...overrides,
  };
}

async function runTests() {
  console.log('--- Claims Gate Tests (Phase 8.9C-pre.3) ---');

  const tdxBuffer = Buffer.alloc(48);
  tdxBuffer.writeUInt16LE(4, 0);
  const normalized = RealEvidenceNormalizer.normalize({
    providerType: 'TDX',
    rawReport: tdxBuffer,
  });

  const structureOnly = makeVerification({
    verificationLevel: VerificationLevel.STRUCTURE_ONLY,
    pocScope: 'verification-stub',
    message: 'Structure valid; DCAP signature verification not implemented',
  });
  assert.strictEqual(ClaimsGate.canMapClaims(structureOnly), false);
  const structureOnlyResult = ClaimsGate.toClaims(normalized, structureOnly, tdxBuffer);
  assert.strictEqual(structureOnlyResult.ok, false);
  if (!structureOnlyResult.ok) {
    assert.strictEqual(structureOnlyResult.error.code, AttestationErrorCode.CLAIMS_GATE_DENIED);
  }

  const noneLevel = makeVerification({ verificationLevel: VerificationLevel.NONE });
  assert.strictEqual(ClaimsGate.canMapClaims(noneLevel), false);
  const noneResult = ClaimsGate.toClaims(normalized, noneLevel, tdxBuffer);
  assert.strictEqual(noneResult.ok, false);
  if (!noneResult.ok) {
    assert.strictEqual(noneResult.error.code, AttestationErrorCode.CLAIMS_GATE_DENIED);
  }

  const offlineFixture = makeVerification({
    verificationLevel: VerificationLevel.OFFLINE_FIXTURE,
  });
  assert.strictEqual(ClaimsGate.canMapClaims(offlineFixture), true);
  const offlineResult = ClaimsGate.toClaims(normalized, offlineFixture, tdxBuffer);
  assert.strictEqual(offlineResult.ok, true);
  if (offlineResult.ok) {
    const direct = ZkClaimsMapper.toClaims(normalized, tdxBuffer);
    assert.deepStrictEqual(offlineResult.value, direct);
  }

  const hardwareRooted = makeVerification({
    verificationLevel: VerificationLevel.HARDWARE_ROOTED,
    message: 'Hardware-rooted verification (research placeholder)',
  });
  assert.strictEqual(ClaimsGate.canMapClaims(hardwareRooted), true);
  const hardwareResult = ClaimsGate.toClaims(normalized, hardwareRooted, tdxBuffer);
  assert.strictEqual(hardwareResult.ok, true);

  const invalidVerification = makeVerification({
    isValid: false,
    message: 'ECDSA signature verification failed (offline PoC)',
  });
  assert.strictEqual(ClaimsGate.canMapClaims(invalidVerification), false);
  const invalidResult = ClaimsGate.toClaims(normalized, invalidVerification, tdxBuffer);
  assert.strictEqual(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.strictEqual(invalidResult.error.code, AttestationErrorCode.VERIFY_FAILED);
  }

  const mockNormalized = { ...normalized, isMock: true as false };
  const mockResult = ClaimsGate.toClaims(mockNormalized, offlineFixture, tdxBuffer);
  assert.strictEqual(mockResult.ok, false);
  if (!mockResult.ok) {
    assert.strictEqual(mockResult.error.code, AttestationErrorCode.MOCK_IN_REAL_PATH);
  }

  const tdxBundle = OfflineCollateralLoader.loadTdxBundle();
  const tdxQuote = bufferFromFixtureHex(tdxBundle.quote.quoteHex);
  const liveVerification = new TdxDcapOfflineVerifier({
    quoteFixture: tdxBundle.quote,
    collateral: tdxBundle.collateral,
  }).verify(tdxQuote);
  const liveNormalized = RealEvidenceNormalizer.normalize({
    providerType: 'TDX',
    rawReport: tdxQuote,
  });
  const liveResult = ClaimsGate.toClaims(liveNormalized, liveVerification, tdxQuote);
  assert.strictEqual(liveResult.ok, true);
  if (liveResult.ok) {
    assert.strictEqual(liveResult.value.teeProviderId, 'TDX');
    assert.strictEqual(liveResult.value.pocScope, 'claims-mapper-poc');
  }

  console.log('✅ claims-gate.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ claims-gate.test.ts failed', e);
  process.exit(1);
});
