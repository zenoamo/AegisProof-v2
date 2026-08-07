# Sensitive File Policy

**Version:** 1.0  
**Date:** 2026-08-08  
**Enforcement:** `npm run check:sensitive-files`, CI `security-boundary-check`  
**Implementation:** `scripts/lib/sensitive-files-policy.mjs`, `scripts/check-sensitive-files.mjs`

---

## Purpose

Prevent accidental commit of secrets and cryptographic private material to the public GitHub repository.

---

## Severity Levels

### CRITICAL — immediate FAIL

| Pattern ID | Rule | Examples |
|------------|------|----------|
| `env-file` | `.env`, `.env.*` | `.env`, `.env.local` |
| `private-key-ext` | `*.key`, `*.pem`, `*.private`, `*.secret` | `operator.pem` |
| `pqc-private-dir` | `artifacts/provenance/keys/` | ML-DSA private keys |
| `private-keys-dir` | `private-keys/` anywhere | Legacy key dirs |
| `deployments-secrets` | `deployments/` | Deployment credentials |
| `wallet-env` | mnemonic, wallet.json, keystore patterns | Wallet material |

CRITICAL paths are **never allowlisted**.

### MIGRATION — FAIL unless allowlisted

| Pattern ID | Rule | Examples |
|------------|------|----------|
| `production-zkey` | `production.zkey` | Proving key binary |
| `ceremony-ptau` | `*.ptau` | Trusted setup material |
| `dev-zkey` | `/setup/*.zkey` | Development zkey |
| `witness-binary` | `*.wtns` | Witness binaries |

Allowlist: `scripts/sensitive-files-allowlist.json` (8 paths as of 2026-08-08).

### EXCLUDED — not scanned

`rapidsnark/`, `node_modules/`, `circom/`, `.git/` (test certificates in vendored tooling).

---

## Commands

```bash
npm run check:sensitive-files          # default (WARN on allowlisted migration)
npm run check:sensitive-files -- --strict  # FAIL on any migration debt
npm run test:sensitive-files-boundary  # T-SEC unit tests
```

---

## `.gitignore` Alignment

| Pattern | gitignore | Scanner |
|---------|-----------|---------|
| `.env*` | Yes | CRITICAL |
| `*.key`, `*.pem` | Yes | CRITICAL |
| `artifacts/provenance/keys/` | Yes | CRITICAL |
| `**/production.zkey` | Yes (new commits blocked) | MIGRATION |
| `deployments/` | Yes | CRITICAL |

Note: Grandfathered tracked files remain until migrated; scanner emits WARN.

---

## Contributor Rules

1. Never commit private keys, `.env`, or signing material.
2. Do not add new paths matching MIGRATION patterns without security review.
3. Run `npm run check:sensitive-files` before opening a PR.
4. Public keys belong in `artifacts/provenance/public-keys/` only.

---

## References

- [github-security-boundary.md](../architecture/github-security-boundary.md)
- [repository-boundary-report.md](./repository-boundary-report.md)
- [penetration-test-plan.md](./penetration-test-plan.md) — PT-01
