# Phase 8.10 Final Report

**Date:** 2026-08-06  
**Base HEAD:** `272edf4`  
**Scope:** Prover Performance Optimization (Layer A) — Architecture Freeze maintained

---

## Architecture Status

**PASS**

- Prover abstraction: `SnarkjsProver` / `RapidsnarkProver` share `prove(zkey, wtns)` → `{ proof, publicSignals }`
- Canonical path: `input → witness → prove → verify` unchanged at semantics level
- `resolveArtifacts()` is the single artifact resolver for Phase 8.10 pipeline
- No changes to `protocol/`, `packages/sdk/`, `tee/`, circuits, VK, zkey, or canonical verifier contract

### CI Artifact Policy (ADR)

| Mode | Behavior | Rationale |
|------|----------|-----------|
| **snarkjs regression (required)** | **FAIL** if `artifactsReady()` false | Security-critical path must not silently skip; `crypto-artifacts/` is tracked in Git |
| **rapidsnark (optional)** | **SKIP** T2/T4 if binary absent; job continues | Opt-in backend; does not affect soundness of snarkjs path |

Previous silent-skip removed: missing artifacts now emit explicit paths and exit 1.

---

## Performance Status

**PASS**

| Metric | Before | After (p50) | Reduction |
|--------|--------|-------------|-----------|
| Legacy fullProve | ~50,000 ms | 490 ms (M1) | ~99.0% |
| Canonical separated | — | 352 ms (M2+M3) | ~99.3% |
| Warm canonical | — | 590 ms (M5) | ~98.8% |

SSoT: `benchmarks/reports/baseline.json`  
Human doc: `docs/perf/prover-benchmark-baseline.md` (synced)

---

## Security Status

**PASS** (snarkjs path fully validated)

| Check | Result |
|-------|--------|
| zkey hash pinned | `ce5a3d30…` PASS |
| VK hash pinned | `d012bd29…` PASS |
| publicSignals 30/30 | PASS |
| tamper reject (snarkjs + on-chain) | PASS |
| Groth16VerifierV2Production canonical | unchanged |

---

## Benchmark

### Before
- `snarkjs.groth16.fullProve`: ~30–60 s (documented legacy)

### After (20 samples, win32, Node 24)
| Mode | p50 | p95 |
|------|-----|-----|
| M1 fullProve | 490 ms | 2460 ms |
| M2 witness | 7 ms | 9 ms |
| M3 snarkjs prove | 345 ms | 418 ms |
| M5 warm | 590 ms | 3925 ms |

### Reduction
~**99%** vs 50 s legacy baseline at p50.

---

## Prover Matrix

| Prover | snarkjs verify | on-chain verify | publicSignals | Status |
|--------|----------------|-----------------|---------------|--------|
| **snarkjs** | PASS (T1) | PASS (T3) | 30/30 (T5) | **VALIDATED** |
| **rapidsnark** | SKIP (T2) | SKIP (T4) | — | **CI-deferred** |

### rapidsnark Evaluation Record

File: `benchmarks/reports/rapidsnark-evaluation.json`

| Field | Value |
|-------|-------|
| Local (Windows) | SKIP — classification: **binary (platform)** |
| Install script | Fixed for Linux (`make host` → `package/bin/prover`) |
| CI path | `prover-compatibility` + `prover-benchmark` jobs |

---

## Changed Files

```
scripts/lib/resolve-artifacts.mjs
scripts/lib/provers.mjs
scripts/lib/canonical-prover.mjs
scripts/bench_prover.mjs
scripts/prove.js
scripts/install-rapidsnark.mjs
scripts/evaluate-rapidsnark.mjs
scripts/run-prover-compat.mjs
scripts/hardhat-prover.config.ts
scripts/prove_native.{mjs,sh}
tests/prover-compatibility.test.ts
.github/workflows/aegis_repro_ci.yml
benchmarks/reports/baseline.json
benchmarks/reports/rapidsnark-evaluation.json
docs/perf/prover-benchmark-baseline.md
docs/phase8.10-final-report.md
package.json
.gitignore
```

---

## Frozen Components

Unchanged:
- `circuits/`, R1CS, trusted setup ceremony records
- `production.zkey`, production VK
- `protocol/contracts/Groth16VerifierV2Production.sol` (canonical)
- publicSignals v2 layout (30 signals)
- `protocol/`, `packages/sdk/`, `tee/` (ADR-001)

---

## Remaining Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TD-01 | rapidsnark not locally validated on Windows | Linux CI `evaluate:rapidsnark` + weekly benchmark |
| TD-02 | Legacy scripts use hardcoded artifact paths | Isolated from Phase 8.10 pipeline; optional future unify |
| TD-04 | M5 p95 outlier (3925 ms) | Monitor via weekly benchmark; not a correctness issue |

---

## Next Phase Recommendation

**Phase 8.11 へ条件付き進行可能**

- snarkjs canonical path: production-ready
- rapidsnark: **Linux CI 初回 green 後**に Phase 8.10 を完全クローズ推奨
- 追加硬化（任意）: benchmark drift detection vs `baseline.json`

---

## Regression Final Check

```
npm run test:prover-compat  → 21/21 PASS
node scripts/evaluate-rapidsnark.mjs → SKIP (Windows platform)
```

Legacy `phase2_verify.mjs` / `phase4_verify_production.mjs`: use canonical `artifacts/` paths only; Phase 8.10 pipeline uses `resolveArtifacts()` with `crypto-artifacts/` mirror — **no conflict**.
