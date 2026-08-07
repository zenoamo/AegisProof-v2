# Phase 8.13 Unified Regression Gate (Task 8)

**Status:** Complete  
**Phase:** 8.13 Task 8  
**Prerequisite:** Tasks 4–7  

---

## Purpose

Provide a single entry point that runs all Phase 8.13 additive-layer tests and live provenance verification in dependency order. T1–T9 prover regression remains in `security-boundary-check` and `prover-compatibility` jobs.

---

## Regression Order

```
test:sensitive-files-boundary   (T-SEC policy)
check:sensitive-files           (live git scan)
test:artifact-resolution
test:artifact-provenance
test:pqc-signature              (T-PQC)
test:hybrid-auth                (T-AUTH)
verify:provenance --live
```

```bash
npm run test:phase813
npm run test:phase813-gate      # metadata + CI wiring checks
```

---

## CI Integration

| Job | Trigger | Scope |
|-----|---------|-------|
| `security-boundary-check` | PR / push | T-SEC unit + T-813 gate + sensitive scan + T1–T9 |
| `phase813-regression` | schedule / manual | Full `test:phase813` unified run |

---

## Frozen Boundary

Unified gate validates outer layers only. Groth16 core unchanged.

---

## Related

- [Prover Regression Contract](../perf/prover-regression-contract.md)
- [Repository Security Gate](./phase8.13-repository-security-gate.md)
