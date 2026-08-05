import { TdxProviderMock } from '../mock/tdx-provider-mock.js';
import { EvidenceNormalizer } from '../mock/evidence-normalizer.js';
import { performance } from 'perf_hooks';

async function runPerformanceTests() {
  const tdx = new TdxProviderMock();
  const dummyData = Buffer.from('test_measurement_payload_for_performance_evaluation');
  
  const ITERATIONS = 1000;
  let totalGenerateTime = 0;
  let totalVerifyTime = 0;
  let totalNormalizeTime = 0;

  const startMem = process.memoryUsage().heapUsed;

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const evidence = await tdx.generateEvidence(dummyData);
    const t1 = performance.now();
    
    const isValid = await tdx.verifyEvidence(evidence);
    const t2 = performance.now();
    
    EvidenceNormalizer.normalize(evidence);
    const t3 = performance.now();

    totalGenerateTime += (t1 - t0);
    totalVerifyTime += (t2 - t1);
    totalNormalizeTime += (t3 - t2);
  }

  const endMem = process.memoryUsage().heapUsed;
  const memUsedMb = (endMem - startMem) / 1024 / 1024;

  console.log('--- Performance Evaluation (Mock) ---');
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Avg Generate Time: ${(totalGenerateTime / ITERATIONS).toFixed(4)} ms`);
  console.log(`Avg Verify Time: ${(totalVerifyTime / ITERATIONS).toFixed(4)} ms`);
  console.log(`Avg Normalize Time: ${(totalNormalizeTime / ITERATIONS).toFixed(4)} ms`);
  console.log(`Memory Usage Delta: ${memUsedMb.toFixed(2)} MB`);
  console.log(`Throughput: ${(1000 / (totalVerifyTime / ITERATIONS)).toFixed(0)} ops/sec`);
  console.log('✅ Performance Evaluation Completed');
}

runPerformanceTests().catch(e => {
  console.error('❌ Performance Evaluation Failed', e);
  process.exit(1);
});
