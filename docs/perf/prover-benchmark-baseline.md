# Prover Benchmark Baseline (Phase 8.10)

**SSoT (machine-readable):** `benchmarks/reports/baseline.json`

Pinned performance reference for Groth16 BN128 / 6590 constraints / `production.zkey`.

## Artifact Hashes (immutable)

| Artifact | SHA-256 |
|----------|---------|
| production.zkey | `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571` |
| production-vkey | `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec` |
| v2 wasm | `a0d3c53f3cdce624d5140874f0884b6b8075e701539978bdd55a826e41db60bd` |

## Performance Summary

| Metric | Value |
|--------|-------|
| Legacy baseline | ~50,000 ms (`fullProve`, pre-optimization) |
| Canonical separated p50 | ~352 ms (M2 witness 7 ms + M3 prove 345 ms) |
| Warm canonical p50 | ~590 ms (M5) |
| Reduction | **~99%** vs legacy |

## Baseline Timings (snarkjs, 20 samples, win32 x64 Node 24)

| Mode | Label | p50 (ms) | p95 (ms) |
|------|-------|----------|----------|
| M1 | fullProve | 490 | 2460 |
| M2 | witness | 7 | 9 |
| M3 | snarkjs prove | 345 | 418 |
| M4 | rapidsnark prove | — | — (see rapidsnark-evaluation.json) |
| M5 | warm | 590 | 3925 |

## rapidsnark (optional, Linux CI)

```bash
npm run install:rapidsnark          # Linux/macOS only
npm run evaluate:rapidsnark         # T2/M4 evaluation record
RAPIDSNARK_BIN=./rapidsnark/package/bin/prover npm run prove:native
```

Evaluation record: `benchmarks/reports/rapidsnark-evaluation.json`

Windows local build: **not supported** (platform/binary issue). Use CI `prover-benchmark` job.

## Reproduce

```bash
npm run bench:prover -- --samples 20
npm run bench:prover:baseline       # refresh benchmarks/reports/baseline.json
npm run test:prover-compat          # T1–T9 regression
```
