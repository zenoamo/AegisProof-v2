import { execSync } from 'child_process';

console.log('🚀 Starting Phase 8.4 Evaluation...');

try {
  console.log('\n--- 1. Functional Evaluation ---');
  execSync('npx tsx tee/tests/evidence-normalizer.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/verification-policy.test.ts', { stdio: 'inherit' });

  console.log('\n--- 2. Security Evaluation ---');
  execSync('npx tsx tee/tests/security-evaluation.test.ts', { stdio: 'inherit' });

  console.log('\n--- 3. Performance Evaluation ---');
  execSync('npx tsx tee/tests/performance-evaluation.test.ts', { stdio: 'inherit' });

  console.log('\n✅ All Evaluations Passed Successfully.');
} catch (error) {
  console.error('\n❌ Evaluation Failed.', error);
  process.exit(1);
}
