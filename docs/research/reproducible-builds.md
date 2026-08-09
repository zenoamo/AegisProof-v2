# AegisProof v2 — Reproducible Builds (Research)

**Status:** Research documentation (Phase B)  
**Scope:** CI reproducibility, prover regression, benchmark baselines

---

## 1. Goals

1. Independent cloner can verify artifact hashes match committed pins
2. T1–T9 prover regression passes on clean checkout
3. Performance drift detectable against committed baseline
4. No nondeterministic secrets in reproducibility path

---

## 2. Reproducibility Contract

### Post-clone verification (documented in README)

```bash
git checkout v2.0.1
npm ci
npx hardhat compile
npm run check:sensitive-files       # CRITICAL 0
npm run verify:provenance -- --live # hash PASS
npm run test:prover-compat          # T1–T9 PASS
```

### CI workflow

| Workflow | Purpose |
|----------|---------|
| `aegis_repro_ci.yml` | Primary reproducibility + security-boundary-check |
| `security.yml` | CodeQL + dependency review |

**Note:** `.github/` workflows are frozen for research expansion — this doc describes existing behavior only.

---

## 3. Hash Pin Sources of Truth

| Constant | Module |
|----------|--------|
| `PRODUCTION_ZKEY_HASH` | `scripts/lib/resolve-artifacts.mjs` |
| `PRODUCTION_VKEY_HASH` | `scripts/lib/resolve-artifacts.mjs` |
| Manifest entries | `artifacts/provenance/manifest.json` |

Changing pins requires Architecture Review — not part of research expansion.

---

## 4. T1–T9 Regression

Documented in [prover-regression-contract.md](../perf/prover-regression-contract.md).

| Test | Validates |
|------|-----------|
| T1 | snarkjs prove → verify |
| T2–T8 | Cross-backend compatibility |
| T9 | Benchmark report schema + artifact hashes |

**Frozen Core integrity gate:** PT-08 confirms prover-compat in CI workflow source.

---

## 5. Benchmark Baselines

| Report | Path | Overwrite policy |
|--------|------|------------------|
| Prover baseline | `benchmarks/reports/baseline.json` | **Do not overwrite** without explicit baseline promotion |
| Provenance verify | `benchmarks/reports/provenance-verify-benchmark.json` | Schedule/manual |
| Hybrid auth | `benchmarks/reports/hybrid-auth-benchmark.json` | Schedule/manual |
| Research pipeline | `benchmarks/reports/research-pipeline-benchmark.json` | New file (Phase G) |

Drift thresholds: `bench-baseline.mjs` — WARN 1.3×, FAIL 1.5× for M2–M4

---

## 6. Environment Factors

Documented in baseline `environment` block:
- OS, arch, Node version
- Prover backend (snarkjs vs rapidsnark)
- Sample count

Rapidsnark M4 baseline sourced from Linux Docker evaluation — platform-specific.

---

## 7. Non-Goals

- Bit-identical WASM witness across all platforms (not guaranteed)
- Reproducing trusted setup ceremony (historical artifact)
- Live KMS-signed manifest reproduction without Vault

---

## References

- [supply-chain-security.md](./supply-chain-security.md)
- [prover-benchmark-baseline.md](../perf/prover-benchmark-baseline.md)
- [implementation-status-matrix.md](./implementation-status-matrix.md)
