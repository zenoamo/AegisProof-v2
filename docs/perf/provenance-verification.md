# Provenance Verification Performance

**Phase:** 8.13 Task 5  
**Scope:** Artifact provenance layer only — prover M1–M5 unaffected  

---

## Benchmark

```bash
npm run bench:provenance
```

Output: `benchmarks/reports/provenance-verify-benchmark.json`

## Cases

| Case | Description |
|------|-------------|
| `sha256-verify` | Classical hash + manifest integrity only |
| `sha256-plus-mldsa-verify` | SHA-256 + ML-DSA-87 signature verification |

## Policy

- Prover benchmark regression (M1–M5) must remain unchanged
- Performance degradation is evaluated on provenance verify path only
- CI uploads benchmark artifact from `provenance-pqc-hardening` job

## Expected overhead

ML-DSA-87 verify adds ~20–50ms p50 per full manifest (6 entries), depending on host CPU.

See `benchmarks/reports/provenance-verify-benchmark.json` for latest measured values.
