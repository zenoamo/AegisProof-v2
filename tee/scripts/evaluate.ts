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
} catch (error) {
  console.error('\n❌ Phase 8.6 Real TEE PoC Evaluation Failed.', error);
  console.error('   (Phase 8.4 Mock Evaluation result remains valid.)');
  process.exit(1);
}

console.log('\n--- Stage C: Phase 8.7 Device Acquisition Evaluation ---');
try {
  execSync('npx tsx tee/tests/device-acquisition.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.7 Device Acquisition Evaluation Passed.');
} catch (error) {
  console.error('\n❌ Phase 8.7 Device Acquisition Evaluation Failed.', error);
  console.error('   (Phase 8.4 Mock and Phase 8.6 PoC results remain valid.)');
  process.exit(1);
}

console.log('\n--- Stage D: Phase 8.8 Verification Stub + ZK Claims Evaluation ---');
try {
  execSync('npx tsx tee/tests/verification-stub.test.ts', { stdio: 'inherit' });
  execSync('npx tsx tee/tests/zk-claims-mapper.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.8 Verification Stub + ZK Claims Evaluation Passed.');
} catch (error) {
  console.error('\n❌ Phase 8.8 Evaluation Failed.', error);
  console.error('   (Prior stage results remain valid.)');
  process.exit(1);
}

console.log('\n--- Stage E: Phase 8.8b Experimental Acquisition Evaluation ---');
try {
  execSync('npx tsx tee/tests/ioctl-acquisition.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.8b Experimental Acquisition Evaluation Passed.');
} catch (error) {
  console.error('\n❌ Phase 8.8b Experimental Acquisition Evaluation Failed.', error);
  console.error('   (Prior stage results remain valid.)');
  process.exit(1);
}

console.log('\n--- Stage F: Phase 8.9B Offline DCAP/VCEK Verification ---');
try {
  execSync('npx tsx tee/tests/offline-verification.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.9B Offline Verification Evaluation Passed.');
} catch (error) {
  console.error('\n❌ Phase 8.9B Offline Verification Evaluation Failed.', error);
  console.error('   (Prior stage results remain valid.)');
  process.exit(1);
}

console.log('\n--- Stage G: Phase 8.9C-pre.4 Attestation Pipeline ---');
try {
  execSync('npx tsx tee/tests/pipeline-e2e.test.ts', { stdio: 'inherit' });

  console.log('\n✅ Phase 8.9C-pre.4 Attestation Pipeline Evaluation Passed.');
  console.log('\n✅ All TEE Adapter Layer Evaluations Passed Successfully.');
} catch (error) {
  console.error('\n❌ Phase 8.9C-pre.4 Attestation Pipeline Evaluation Failed.', error);
  console.error('   (Prior stage results remain valid.)');
  process.exit(1);
}
