import { execSync } from 'child_process';

console.log('🚀 Starting TEE Adapter Layer Evaluation (Research/PoC only — not for production use)...');

try {
  console.log('\n--- Stage A: Phase 8.4 Mock Evaluation ---');
  console.log('\n--- 1. Functional Evaluation ---');
  execSync('npx tsx tee/tests/evidence-normalizer.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/verification-policy.test.ts', { stdio: 'inherit' });

  console.log('\n--- 2. Security Evaluation ---');
  execSync('npx tsx tee/tests/security-evaluation.test.ts', { stdio: 'inherit' });

  console.log('\n--- 3. Performance Evaluation ---');
  execSync('npx tsx tee/tests/performance-evaluation.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.4 Mock Evaluation Passed.');
} catch (error) {
  console.error('\n❌ Phase 8.4 Mock Evaluation Failed.', error);
  process.exit(1);
}

console.log('\n--- Stage B: Phase 8.6 Real TEE PoC Evaluation ---');
try {
  execSync('npx tsx tee/tests/real-tdx-poc.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/real-sev-poc.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/provider-factory.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/real-evidence-normalizer.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.6 Real TEE PoC Evaluation Passed.');
  console.log('\n✅ All TEE Adapter Layer Evaluations Passed Successfully.');
} catch (error) {
  console.error('\n❌ Phase 8.6 Real TEE PoC Evaluation Failed.', error);
  console.error('   (Phase 8.4 Mock Evaluation result remains valid.)');
  process.exit(1);
}
