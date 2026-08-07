# AegisProof v2 GitHub Public Release Audit Report

**Audit date:** 2026-08-08  
**Auditor scope:** Public release preparation (not new feature development)  
**Frozen core policy:** Read-only — no modifications to circuits, protocol, SDK, tee, verifier, zkey/VK hashes

---

## Repository Boundary

**PASS**

| Check | Result |
|-------|--------|
| Public assets documented | [repository-boundary-report.md](./repository-boundary-report.md) |
| GitHub vs external storage defined | [github-repository-boundary.md](../architecture/github-repository-boundary.md) |
| Tracked files scanned | 393 files |
| CRITICAL secret hits | **0** |
| Migration debt allowlisted | 8 paths (WARN) |
| Provenance manifest + public keys | Present and committable |

**Public:** source, tests, docs, CI, manifest, public keys, hash pins.  
**Private:** private keys, `.env`, HSM credentials, signing material.

---

## Sensitive File Audit

**PASS**

```
npm run check:sensitive-files
  Critical hits: 0
  Migration hits: 8 (8 allowlisted)
  Result: PASS
```

| Pattern | Status |
|---------|--------|
| `.env*` | CRITICAL — none tracked |
| `*.pem`, `*.key` | CRITICAL — none tracked |
| `provenance/keys/` | CRITICAL — gitignored |
| `production.zkey` | MIGRATION — allowlisted |
| `*.ptau`, `*.wtns` | MIGRATION — allowlisted |

Policy document: [sensitive-file-policy.md](./sensitive-file-policy.md)

---

## CI Security Gate

**PASS**

### PR / push (`aegis_repro_ci.yml`)

| Job | Checks |
|-----|--------|
| `security-boundary-check` | `check:sensitive-files`, T-SEC, T-813, PT-01–PT-10, T-KMS, `verify:provenance --live`, T1–T9 |
| `fast` | Gates + verification suite |
| `prover-compatibility` | Extended prover + PQC tests |

### Schedule / manual

| Job | Checks |
|-----|--------|
| `provenance-pqc-hardening` | Strict `--pqc`, T-PQC |
| `security-penetration-full` | Full PT + optional Shield live |
| `phase813-regression` | Unified Phase 8.13 gate |

### Added: `security.yml`

| Job | Purpose |
|-----|---------|
| `dependency-review` | PR high-severity dependency gate |
| `codeql` | JavaScript/TypeScript static analysis |
| `security-scripts-smoke` | Sensitive file scan |

Existing CI not modified structurally; supplementary workflow added.

---

## Artifact Governance

**PASS**

| Component | Status |
|-----------|--------|
| `manifest.json` | schemaVersion 1, pinned hashes |
| Public key registry | `aegis-ci-mldsa87-v1.json` |
| Hash verification | `verify:provenance --live` PASS |
| Artifact resolver | `resolveArtifacts()` canonical |
| Policy document | [artifact-policy.md](./artifact-policy.md) |
| ADRs | 0002-provenance, 0004-artifact-storage |

Lifecycle: Generate → Hash → Manifest → Verify → Retire (documented).

---

## Documentation

**PASS**

| Item | Status |
|------|--------|
| [docs/README.md](../README.md) | Documentation index created |
| [docs/adr/](../adr/) | 0001–0004 ADRs added |
| [docs/operations/README.md](../operations/README.md) | Ops index created |
| [docs/security/](../security/) | Boundary, policy, artifact, KMS, PT reports |
| [README.md](../../README.md) | Public-release oriented update |
| Mermaid / hash values | Unchanged in existing architecture docs |

---

## OSS Governance

**PASS**

| Item | Status |
|------|--------|
| [LICENSE](../../LICENSE) | MIT — **added** (was missing) |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Added |
| [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) | Added |
| Issue templates | bug, security, feature |
| PR template | Frozen core + secrets checklist |
| `.github/workflows/security.yml` | CodeQL + dependency review |

---

## Frozen Core Verification

**PASS**

| Invariant | Result |
|-----------|--------|
| `circuits/` diff | **0 files** |
| `protocol/` diff | **0 files** |
| `packages/sdk/` diff | **0 files** |
| `tee/` diff | **0 files** |
| Verifier contract diff | **0 files** |
| `production.zkey` hash pin | **PASS** `ce5a3d30…6571` |
| VK ceremony hash | **PASS** `d012bd29…d2ec` |
| `publicSignals` | **30/30** |
| Audit modifications | docs/, `.github/`, scripts/ (pre-existing Phase 8.13/8.14), no frozen paths |

### Validation test results

| Command | Result |
|---------|--------|
| `npm run check:sensitive-files` | **PASS** |
| `npm run test:penetration` | **PASS** 91/91 |
| `npm run test:phase813` | **PASS** |
| `npm run test:kms-signer` | **PASS** 26/26 |
| `npm run test:pqc-signature` | **PASS** 27/27 |
| `npm run verify:provenance -- --live` | **PASS** |

---

## Remaining Technical Debt

1. **Migration debt** — 8 git-tracked binary paths (`production.zkey`, ptau, wtns) pending external storage migration
2. **PQC PR tier** — manifest entries unsigned on PR; WARN until strict promotion (Phase 8.14 Task 3+)
3. **Untracked bench reports** — 14+ `benchmarks/reports/prover-bench-*.json` locally untracked; should not be committed
4. **KMS production wiring** — Vault/HSM live signing not yet integrated (design + stub complete)
5. **Hybrid auth** — research layer; not wired to deployment scripts
6. **`npm test`** — legacy entry points to missing `test/testVerifyAndAccept.ts`
7. **CodeQL** — first run may require GitHub Advanced Security enablement on repository

---

## Final Status

## PUBLIC RELEASE READY

**Conditions:**

- Source, tests, documentation, CI, and security gates are suitable for external review.
- Frozen core unchanged; verification commands pass.
- MIT license and OSS governance files in place.
- Migration debt is **documented and allowlisted** — not a secret exposure, but should be migrated post-release.
- Reviewers should read [repository-boundary-report.md](./repository-boundary-report.md) for binary artifact caveats.

**Groth16 core unchanged. No secrets introduced during this audit.**

---

## Files Added / Modified (Audit Only)

| Category | Files |
|----------|-------|
| Security docs | `repository-boundary-report.md`, `sensitive-file-policy.md`, `artifact-policy.md`, this report |
| ADRs | `0001`–`0004` |
| Docs index | `docs/README.md`, `docs/operations/README.md` |
| OSS | `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates |
| CI | `.github/workflows/security.yml` |
| Root | `README.md` (updated) |

No modifications to frozen core paths.
