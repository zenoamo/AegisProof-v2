# Repository Boundary Report

**Audit date:** 2026-08-08  
**Scope:** AegisProof v2 GitHub Public Release preparation  
**References:** [github-repository-boundary.md](../architecture/github-repository-boundary.md), [github-security-boundary.md](../architecture/github-security-boundary.md)

---

## Summary

| Boundary | Status |
|----------|--------|
| Public / GitHub managed | **PASS** — 393 tracked files, auditable |
| External secure storage | **Documented** — target for zkey, private keys |
| Migration debt | **WARN** — 8 allowlisted paths pending externalization |
| Private / never commit | **PASS** — 0 CRITICAL hits in live scan |

---

## Public (GitHub — safe to publish)

| Category | Paths | Rationale |
|----------|-------|-----------|
| Source code | `scripts/`, `tests/`, `circuits/` (sources), `contracts/` | Reproducible build and audit |
| Frozen protocol/SDK | `protocol/`, `packages/sdk/`, `tee/` | Read-only; architecture review required to change |
| Documentation | `docs/` | Design, security, research, ADRs |
| CI configuration | `.github/workflows/` | Security gates and reproducibility |
| Provenance manifest | `artifacts/provenance/manifest.json` | SHA-256 pins, schema metadata |
| Public key registry | `artifacts/provenance/public-keys/` | ML-DSA-87 public keys only |
| Ceremony evidence | `artifacts/phase4/ceremony/`, `hashes/`, `transcripts/` | Non-secret audit trail |
| Hash constants | `scripts/lib/resolve-artifacts.mjs` | Integrity anchors (`ce5a3d30…6571`, `d012bd29…d2ec`) |
| Benchmark reports | `benchmarks/reports/baseline.json` (committed) | Performance evidence |

---

## Private (never commit)

| Material | Detection | Storage |
|----------|-----------|---------|
| Private keys (`*.key`, `*.pem`) | CRITICAL — `check:sensitive-files` | Vault / HSM |
| Environment secrets (`.env*`) | CRITICAL + `.gitignore` | CI secrets |
| PQC private keys | `artifacts/provenance/keys/` gitignored | Vault / HSM |
| HSM / signing credentials | Pattern scanner | Vault |
| Operator wallet credentials | Pattern scanner | HSM / MPC |
| Deployment secrets | `deployments/` gitignored | External vault |

---

## Migration Debt (allowlisted — WARN until migrated)

Managed via `scripts/sensitive-files-allowlist.json`:

| Path | Type | Target |
|------|------|--------|
| `crypto-artifacts/phase4/production.zkey` | production-zkey | External secure storage |
| `crypto-artifacts/phase2/phase2/setup/*.ptau` (5 files) | ceremony-ptau | External archive |
| `crypto-artifacts/phase2/phase2/setup/aegis_v2_0000.zkey` | dev-zkey | External archive |
| `crypto-artifacts/phase2/phase2/witness/witness_v2_baseline.wtns` | witness-binary | Regenerable / exclude |

**Policy:** New unallowlisted sensitive paths → FAIL. Allowlisted paths → WARN.

---

## External Storage (not on GitHub — target state)

| Asset | GitHub today | Target |
|-------|--------------|--------|
| `production.zkey` binary | Migration debt (tracked) | HSM / encrypted object store |
| ML-DSA signing keys | Never in git | Vault / HSM |
| Operator ECDSA keys | Never in git | HSM |
| Ceremony toxic waste | Partially tracked (ptau) | Air-gapped archive |

---

## Frozen Core Boundary

The following are **read-only** for this audit. No modifications detected:

- `circuits/`, `protocol/`, `packages/sdk/`, `tee/`
- Verifier contract, VK hash, `publicSignals(30)`, `proveCanonical()` semantics

---

## Verdict

**PASS** — Repository boundary is documented and enforced. Migration debt is acknowledged and allowlisted; does not block public source release with documented caveats.


## Migration update — 2026-10-01

Production zkey has been removed from the repository working tree as part of migration. External secure storage provisioning and CI retrieval are still pending, so production artifact verification is expected to remain blocked until the operator completes the secure-storage setup.
