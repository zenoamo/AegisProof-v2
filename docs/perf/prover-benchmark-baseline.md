# Prover Benchmark Baseline (Phase 8.11)

**SSoT (machine-readable):** `benchmarks/reports/baseline.json` (schemaVersion 2)

Pinned performance reference for Groth16 BN128 / 6590 constraints / `production.zkey`.

## Schema v2 Fields

| Field | Purpose |
|-------|---------|
| `schemaVersion` | Baseline format version (currently `2`) |
| `commit` | Git commit when baseline was pinned |
| `platform` | OS/arch summary |
| `environment` | Full runtime snapshot |
| `proverBackend` | Default prover (`snarkjs` / `rapidsnark`) |
| `artifacts` | zkey, VK, wasm, input hashes |
| `modes` | Map of M1–M5 timing stats |

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
| rapidsnark prove p50 (Linux) | ~183 ms (M4) |
| Reduction | **~99%** vs legacy |

## Baseline Timings

| Mode | Label | p50 (ms) | p95 (ms) |
|------|-------|----------|----------|
| M1 | fullProve | 490 | 2460 |
| M2 | witness | 7 | 9 |
| M3 | snarkjs prove | 345 | 418 |
| M4 | rapidsnark prove | 183 | 252 |
| M5 | warm | 590 | 3925 |

M4 sourced from Linux rapidsnark validation (`rapidsnark-evaluation.json`).

## Drift Detection

```bash
npm run bench:prover -- --samples 20
npm run check:bench-drift              # warn-only (default)
npm run check:bench-drift -- --enforce # fail on hard regression (>50%)
```

Thresholds: WARN at +30% p50, FAIL at +50% p50 (M2, M3, M4).

## rapidsnark (optional, Linux CI)

```bash
npm run install:rapidsnark
npm run evaluate:rapidsnark
RAPIDSNARK_BIN=./rapidsnark/package/bin/prover npm run prove:native
```

Evaluation record: `benchmarks/reports/rapidsnark-evaluation.json`

## Reproduce

```bash
npm run bench:prover -- --samples 20
npm run bench:prover:baseline       # refresh baseline.json (schema v2)
npm run test:prover-compat          # T1–T9 regression
npm run check:bench-drift
```

See also: `docs/perf/prover-regression-contract.md`
