# Repository Security Boundary Gate (Phase 8.13 Task 7)

**Status:** Complete  
**Phase:** 8.13 Task 7  
**Prerequisite:** Tasks 1–6 (provenance, PQC, hybrid auth), GitHub boundary planning  

---

## Purpose

Formalize GitHub repository security boundary enforcement as a testable, CI-integrated gate. This task adds policy unit tests and refactors the sensitive file scanner into a testable module without changing Groth16 or protocol layers.

---

## Architecture

```
scripts/lib/sensitive-files-policy.mjs   ← testable policy (CRITICAL / MIGRATION)
        ↓
scripts/check-sensitive-files.mjs        ← git scan CLI
        ↓
scripts/run-security-boundary-check.mjs  ← sensitive + provenance
        ↓
CI job security-boundary-check           ← PR hard gate
```

### Policy tiers

| Tier | Behavior | Examples |
|------|----------|----------|
| CRITICAL | Always FAIL | `.env`, `*.pem`, `artifacts/provenance/keys/` |
| MIGRATION | FAIL unless allowlisted | `production.zkey`, `*.ptau`, `*.wtns` |
| EXCLUDED | Ignored | `rapidsnark/` vendored test fixtures |

---

## Tests (T-SEC)

| ID | Case |
|----|------|
| T-SEC-01 | `.env` detected as critical |
| T-SEC-02 | `*.pem` detected as critical |
| T-SEC-03 | `artifacts/provenance/keys/` critical |
| T-SEC-04 | `production.zkey` migration (not critical) |
| T-SEC-05 | Allowlisted migration passes |
| T-SEC-06 | Unallowlisted migration fails |
| T-SEC-07 | `--strict` rejects allowlisted |
| T-SEC-08 | `rapidsnark/` excluded |
| T-SEC-09 | Critical never allowlisted |
| T-SEC-10 | Pattern catalog defined |

```bash
npm run test:sensitive-files-boundary
npm run check:sensitive-files
```

---

## Frozen Boundary

No changes to circuits, zkey, VK, verifier, SDK, protocol, tee, or `proveCanonical()`.

---

## Related

- [GitHub Repository Boundary](../../architecture/github-repository-boundary.md)
- [GitHub Security Boundary](../../architecture/github-security-boundary.md)
- [PQC CI Policy](./phase8.13-pqc-ci-policy.md)
