# AegisProof Performance Benchmark Methodology

**Document Version:** 1.0  
**Purpose:** Document benchmark execution methodology for reproducibility  
**Date:** August 2026 (Phase 6)  

---

## Executive Summary

This document describes the methodology used to generate performance benchmarks for AegisProof v2. All measurements are reproducible using `scripts/run_benchmarks.mjs` with recorded environment metadata.

---

## Benchmark Categories

### 1. Proof Generation Timing

**Metrics Measured:**
- Circuit loading time (cold start vs cached)
- Witness calculation time (canonical input)
- Groth16 proof generation time

**Methodology:**
- Execute $N = 5$ iterations per metric
- First run measured as "cold start" (filesystem load)
- Remaining runs measure "cached" behavior (in-memory caching)
- Record mean, median, standard deviation, min, max

**Expected Ranges:**
- Circuit load cold: 100-300ms (first import + WASM compilation)
- Circuit load warm: <50ms (JavaScript module cache)
- Witness gen: 50-150ms (Poseidon hash computation)
- Proof gen: 2000-5000ms (Groth16 proving algorithm)

**Assumptions:**
- Canonical test vector loaded from disk (`artifacts/phase2/tests/input_v2.json`)
- Hardware capable of executing circom-generated WASM efficiently
- No network latency affecting local measurements

---

### 2. Verification Latency

**Metrics Measured:**
- Off-chain verification (snarkjs.groth16.verify)
- On-chain gas estimation (verifyProof function)
- EVM contract execution time

**Methodology:**
- Off-chain: Measure snarkjs verification against production VK hash
- On-chain gas: Manual estimate based on Solidity opcodes used in Groth16Verifier
- Execution time: Calculate based on gas × block throughput assumption (15M gas/s)

**Verification Formula:**
```solidity
// verifyProof(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[30] pubSignals)
// Estimated cost breakdown:
pA encoding: ~15k gas (G1 point parsing)
pB encoding: ~25k gas (G2 point parsing + coordinate swap)
pC encoding: ~10k gas (G1 point parsing)
pubSignals: 30 × ~8k gas (uint256 array parsing)
pairing checks: ~50k gas (e(α, β) + linear combination)
Total: ~285k gas conservative estimate
```

**Expected Ranges:**
- Off-chain: 5-50ms depending on hardware
- On-chain gas: 250k-350k gas (varies with optimization level)
- EVM execution: 17-23ms (at 15M gas/s block rate)

**Assumptions:**
- Production zkey/VK pair valid (verified via ceremony report)
- Gas estimates conservative (actual may be lower with optimization)
- Block throughput fixed at 15M gas/s for time conversion

---

### 3. Calldata Metrics

**Metrics Measured:**
- Raw public signal size (binary representation)
- Padded calldata size (hex strings for Solidity)
- JSON serialization overhead vs binary minimum
- Signal name→index conversion cost

**Calculations:**

**Raw Binary Size:**
```
30 signals × 32 bytes each = 960 bits = 120 bytes
```

**Padded Calldata Size:**
```
Each signal converted to 64-character hex string (uint256 padding):
30 signals × 64 characters = 1,920 characters = 1,920 bytes
```

Wait - correction for actual implementation:

**Corrected Calldata Format:**
```javascript
// Solidity expects uint[30], each value is 32 bytes
const paddedSignals = signals.map(s => s.padStart(64, "0")); // 64 chars = 32 bytes in memory
calldataSize = 30 × 32 = 960 bytes
```

So actual overhead comes from:
- **Binary minimum**: 30 × 32 bytes = 960 bytes (if serialized compactly)
- **JSON format**: Adds ~200-300 bytes for field names and structure
- **Hex string overhead**: None if stored as Uint8Array in calldata

**Expected Ranges:**
- Raw size: 960 bytes (30 × 32-byte field elements)
- JSON overhead: 20-30% additional bytes
- Conversion cost: <1ms per batch of 30 signals

---

### 4. Resource Usage

**Metrics Measured:**
- Peak heap memory increase (RSS measurement)
- CPU utilization percentage (wall-clock vs estimated CPU time)
- Temporary file footprint during benchmark execution

**Measurement Tools:**
- Node.js `process.memoryUsage()` for heap tracking
- `os.cpus()` for processor information
- `os.tmpdir()` for temporary artifact location
- `process.hrtime.bigint()` for precise timing

**Memory Calculation:**
```javascript
const before = process.memoryUsage().heapUsed;
// execute operations...
const after = process.memoryUsage().heapUsed;
const peakIncrease = (after - before) / 1024 / 1024; // MB
```

**CPU Utilization Assumption:**
- Node.js JavaScript primarily single-threaded
- Estimate CPU time as 80% of wall-clock duration
- Account for background OS processes not under control

**Expected Ranges:**
- Memory increase: 5-20 MB depending on WASM loading
- CPU utilization: 60-90% (Node.js efficiency varies)
- Temp files: <1 MB total (witness.dat, proof.bin, etc.)

---

## Statistical Analysis

### Sample Size Determination

**Why N=5?**
- Balance between statistical significance and execution time
- Provides enough data points for meaningful statistics without excessive runtime
- Industry-standard minimum for benchmarking small systems

**Statistical Measures Computed:**
- Mean (average) - central tendency
- Median (middle value) - robust against outliers
- Standard Deviation - variability/spread
- Min/Max - range coverage

**Example Output Format:**
```
Proof Generation Time:
   Average: 3245.67ms (3.246s)
   Std Dev: 156.32ms
   Range: 3089.12s - 3456.23s
```

---

## Environment Recording

All benchmark results include complete environment metadata for reproducibility:

| Field | Source | Example |
|---|---|---|
| Operating System | `os.platform() + os.release()` | `win32 10.0.19045` |
| Architecture | `os.arch()` | `x64` |
| CPUs | `os.cpus().length` | `8` |
| RAM | `os.totalmem() / 1GB` | `32 GB` |
| Node.js version | `process.version` | `v22.12.0` |
| npm version | `execFileSync("npm", ["--version"])` | `10.9.0` |
| Hardhat version | `npx hardhat --version` | `3.0.6` |
| Snarkjs version | `package.json` dependency | `0.7.6` |
| Circom version | Not applicable (artifacts only) | N/A |
| CI environment | `process.env.CI` | `GitHub Actions` or `Local Development` |

---

## Reproducibility Guarantees

### What Can Be Reproduced Exactly:
1. ✅ Calldata formatting (deterministic padding rules)
2. ✅ Signal conversion logic (SSoT order enforced)
3. ✅ Error handling behavior (typed exceptions)
4. ✅ Gas estimation formulas (opcode-based calculations)

### What Varies Between Runs:
1. ⚠️ Timing measurements (hardware-dependent, system load affects timing)
2. ⚠️ Memory allocation patterns (garbage collection timing varies)
3. ⚠️ File system access times (SSD vs HDD impact)
4. ⚠️ Network latency (if remote RPC used for verification)

### Mitigation Strategies:
- Run benchmarks multiple times (N=5 minimum)
- Report statistical measures, not single values
- Document environment conditions clearly
- Use controlled test environments when possible

---

## Known Limitations

### Benchmark Constraints:

1. **Single-Machine Measurement:**
   - Benchmarks run locally, not distributed across infrastructure
   - Cloud provider performance characteristics differ from local development machines

2. **Placeholder Values:**
   - Some sections use mock values where actual implementation requires WASM integration
   - Marked clearly as "placeholder" in code comments
   - Real measurements would require full circuit proving setup

3. **No Parallel Execution Testing:**
   - Sequential benchmark runner design
   - Does not measure concurrent workload scenarios
   - Single-threaded for isolation and reproducibility

4. **Gas Estimation Conservative:**
   - On-chain gas calculations assume worst-case opcode paths
   - Actual deployment may show lower gas costs via optimizer
   - Recommend testing with deployed contract for accurate figures

---

## Recommendations for Future Work

### Extended Benchmarking Scenarios:

1. **Batch Processing Measurements:**
   - Verify multiple proofs simultaneously
   - Measure amortized cost per proof (e.g., 10 proofs in one tx)
   
2. **Network Overhead Analysis:**
   - Remote RPC calls vs local node
   - Latency impact on UX
   - Bandwidth requirements per verification

3. **Hardware Scalability Study:**
   - Benchmark across different CPU cores (2-core vs 16-core machines)
   - Memory-constrained environments (IoT devices)
   - GPU-accelerated proving (future optimization path)

4. **Protocol Evolution Tracking:**
   - Track metrics over multiple protocol versions
   - Identify performance regressions early
   - Correlate changes with implementation decisions

---

## References

- **Implementation:** [`scripts/run_benchmarks.mjs`](./run_benchmarks.mjs) - Full benchmark suite
- **Reference Applications:** `examples/` - Demonstrates practical usage patterns
- **SDK API:** `packages/sdk/src/core.ts` - Core implementation being measured
- **Canonical Artifacts:** `artifacts/phase4/final/` - Production zkey/VK for verification tests

---

## Contact & Feedback

Questions or suggestions regarding this benchmark methodology should be directed to the AegisProof core team. Submit issues or PRs to improve documentation quality.
