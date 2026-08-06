import assert from 'assert';
import { VerificationLevel } from '../domain/verification-level.js';
import {
  DEFAULT_VERIFICATION_LEVEL_POLICY,
  isVerificationLevelAllowed,
} from '../policy/verification-policy.js';

async function runTests() {
  console.log('--- Verification Level Policy Tests (Phase 8.9C-pre.2) ---');

  assert.strictEqual(isVerificationLevelAllowed(VerificationLevel.NONE), false);
  assert.strictEqual(isVerificationLevelAllowed(VerificationLevel.STRUCTURE_ONLY), false);
  assert.strictEqual(isVerificationLevelAllowed(VerificationLevel.OFFLINE_FIXTURE), true);
  assert.strictEqual(isVerificationLevelAllowed(VerificationLevel.OFFLINE_VERIFIED), true);
  assert.strictEqual(isVerificationLevelAllowed(VerificationLevel.HARDWARE_ROOTED), true);

  assert.strictEqual(DEFAULT_VERIFICATION_LEVEL_POLICY.allows(VerificationLevel.STRUCTURE_ONLY), false);
  assert.strictEqual(DEFAULT_VERIFICATION_LEVEL_POLICY.allows(VerificationLevel.OFFLINE_FIXTURE), true);

  console.log('✅ verification-level-policy.test.ts passed');
}

runTests().catch((e) => {
  console.error('❌ verification-level-policy.test.ts failed', e);
  process.exit(1);
});
