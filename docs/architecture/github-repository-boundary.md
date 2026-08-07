# GitHub Repository Boundary — AegisProof v2

**Version:** 1.0  
**Date:** 2026-08-07  
**Scope:** Repository governance — no ZK protocol changes  

---

## Purpose

Define what belongs on **GitHub** (reproducibility · auditability · development management) vs **Secure Storage / Vault / HSM** (secrets · high-value cryptographic material).

```
GitHub          = code · design · verification evidence · public metadata
Secure Storage  = secrets · private keys · production.zkey (target state)
```

---

## Task 1 — Repository Inventory Classification

### A. GitHub 管理対象 (Repository Managed)

| Category | Paths | Rationale |
|----------|-------|-----------|
| Source code | `scripts/`, `tests/`, `circuits/` (sources), `protocol/` (frozen) | Reproducible build & audit |
| SDK | `packages/sdk/` | Public API surface |
| CI | `.github/workflows/` | Verification automation |
| Documentation | `docs/architecture/`, `docs/research/`, `docs/perf/` | Design & audit trail |
| Public metadata | `artifacts/provenance/manifest.json`, `artifacts/provenance/public-keys/` | Hash + ML-DSA public keys |
| Ceremony records | `artifacts/phase4/ceremony/`, `transcripts/`, `hashes/` | Non-secret evidence |
| Benchmarks | `benchmarks/reports/*.json` | Performance evidence |
| Hash pins | `scripts/lib/resolve-artifacts.mjs` constants | Integrity anchors |

**Tracked file count:** ~404 files (excluding `node_modules/`).

### B. GitHub 管理禁止 (Never Commit)

| Material | Examples | Detection |
|----------|----------|-----------|
| Private keys | `*.key`, `*.pem`, `*.private` | `check:sensitive-files` CRITICAL |
| Environment secrets | `.env`, `.env.*` | gitignore + scanner |
| ML-DSA private keys | `artifacts/provenance/keys/` | gitignore + scanner |
| Operator / wallet credentials | mnemonics, keystore | pattern scanner |
| HSM / deployment credentials | `deployments/` | gitignore + scanner |
| TEE production secrets | runtime attestation keys | external vault |

### C. Hash / Metadata のみ管理 (Metadata Only)

| Asset | GitHub holds | Binary location |
|-------|-------------|-----------------|
| production.zkey | SHA-256 pin `ce5a3d30…6571` | **Target:** secure storage (currently migration debt in `crypto-artifacts/`) |
| production-vkey.json | File hash + ceremony hash `d012bd29…d2ec` | `crypto-artifacts/phase4/` or `artifacts/phase4/final/` |
| wasm / r1cs | Hash pins in manifest | `crypto-artifacts/phase2/` |
| ML-DSA public keys | `aegis-ci-mldsa87-v1.json` | Committed registry |

### D. External Storage 管理 (Secure Storage)

| Asset | Storage tier | Access |
|-------|-------------|--------|
| production.zkey (target) | HSM / encrypted object store | CI OIDC + short-lived download |
| ML-DSA signing keys | Vault / GitHub Encrypted Secrets | `AEGIS_PQC_PRIVATE_KEY_HEX` |
| Operator ECDSA keys | HSM / MPC | Never in repository |
| Ceremony toxic waste | Air-gapped archive | Off GitHub permanently |

---

## Current State Findings (Read-Only Audit)

### ⚠️ Migration Debt — Tracked Sensitive Paths

The following are **currently git-tracked** but classified as migration debt (allowlisted in `scripts/sensitive-files-allowlist.json`):

| Path | Classification | Target |
|------|----------------|--------|
| `crypto-artifacts/phase4/production.zkey` | HIGH — proving key | External secure storage |
| `crypto-artifacts/phase2/phase2/setup/*.ptau` | HIGH — ceremony material | External archive |
| `crypto-artifacts/phase2/phase2/setup/aegis_v2_0000.zkey` | HIGH — dev zkey | External archive |
| `crypto-artifacts/phase2/phase2/witness/*.wtns` | MEDIUM — witness | Regenerable, exclude |

**Policy:** New commits matching forbidden patterns → **FAIL** (`npm run check:sensitive-files`). Allowlisted paths → **WARN** until migrated.

### Directory Map

```
aegisproof-v2/
├── circuits/              [A] frozen sources / compiled refs
├── protocol/              [A] frozen contracts (via contracts/)
├── contracts/             [A] Groth16VerifierV2Production.sol 🔴
├── packages/sdk/          [A] frozen SDK 🔴
├── scripts/               [A] prover · provenance · pqc · auth tooling
│   └── lib/               resolver · provenance · pqc-signature · hybrid-auth
├── tests/                 [A] T1–T9 · PQC · hybrid auth
├── docs/                  [A] architecture · research · perf
├── benchmarks/            [A] reports (no secrets)
├── artifacts/
│   ├── phase2/            [A] r1cs evidence · reports (no setup/)
│   ├── phase4/            [A] ceremony metadata (no final/*.zkey)
│   └── provenance/        [A] manifest + public-keys/
│       └── keys/          [B] gitignored — private keys
├── crypto-artifacts/      [C/D] mirror — migration debt for zkey
├── tee/                   [A] ADR-001 isolated 🔴 boundary
├── .github/workflows/     [A] CI security gates
└── .gitignore             [A] policy enforcement
```

---

## Frozen vs Operational (Cross-Reference)

| 🔴 Frozen Core | 🔵 Operational / Extension |
|----------------|---------------------------|
| circuits, R1CS, zkey hash, VK hash | scripts/, CI, benchmarks |
| Groth16VerifierV2Production.sol | provenance, PQC adapter |
| protocol/contracts, packages/sdk | hybrid auth (research) |
| publicSignals(30), proveCanonical() | public key registry |
| tee/ ADR-001 | check:sensitive-files |

---

## Enforcement

```bash
npm run check:sensitive-files          # CRITICAL fail + migration allowlist WARN
npm run check:sensitive-files -- --strict   # fail on allowlisted too
npm run check:security-boundary        # sensitive + provenance
```

CI job: `security-boundary-check` on every PR.

---

## Related

- [GitHub Security Boundary](./github-security-boundary.md) — trust model & lifecycle
- [AegisProof v2 Full Architecture](./aegisproof-v2-full-architecture.md)
- [Artifact Retention Policy](../artifact-retention.md)

---

## Task 3 — Repository Structure Proposal (Review)

Proposed layout vs current state:

| Proposed | Current | Recommendation |
|----------|---------|----------------|
| `circuits/` | ✅ exists | Keep — frozen sources |
| `protocol/` | ✅ via `contracts/` + `protocol/` | Keep frozen; no rename |
| `packages/` | ✅ `packages/sdk/` | Keep |
| `scripts/prover/` | flat `scripts/` | **Defer** — subdir split is cosmetic; migrate when script count grows |
| `scripts/provenance/` | `scripts/lib/artifact-provenance.mjs` etc. | **Defer** — lib/ pattern works |
| `scripts/pqc/` | `scripts/lib/pqc-signature.mjs` | **Defer** |
| `scripts/auth/` | `scripts/lib/hybrid-auth-envelope.mjs` | **Defer** |
| `tests/` | ✅ exists | Keep |
| `docs/architecture/` | ✅ + new boundary docs | Keep |
| `docs/security/` | partial in `docs/research/` | Add `docs/security/` when threat model doc lands |
| `benchmarks/` | ✅ exists | Keep |
| `artifacts/provenance/` | ✅ manifest + public-keys | Keep — keys/ gitignored |
| `.github/workflows/` | ✅ `aegis_repro_ci.yml` | Keep + `security-boundary-check` job |
| `.gitignore` | ✅ hardened | Keep |

**Decision:** Adopt logical grouping in documentation; **no directory moves** in this governance phase (avoids import path churn, preserves frozen boundary).
