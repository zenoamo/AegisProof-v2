# GitHub Repository Boundary — AegisProof v2

**Version:** 1.0  
**Date:** 2026-08-07  
**Scope:** Repository governance (no ZK protocol changes)

---

## Overview

This document defines what belongs on **GitHub** versus **Secure Storage / Vault / HSM**.

| Layer | Holds |
|-------|-------|
| GitHub | Code, design docs, verification evidence, public metadata |
| Secure Storage | Secrets, private keys, `production.zkey` (target state) |

---

## Inventory Classification

### A. Repository Managed (GitHub)

| Category | Paths | Rationale |
|----------|-------|-----------|
| Source code | `scripts/`, `tests/`, `circuits/` (sources), `protocol/` (frozen) | Reproducible build and audit |
| SDK | `packages/sdk/` | Public API surface |
| CI | `.github/workflows/` | Verification automation |
| Documentation | `docs/architecture/`, `docs/research/`, `docs/perf/` | Design and audit trail |
| Public metadata | `artifacts/provenance/manifest.json`, `artifacts/provenance/public-keys/` | SHA-256 hashes and ML-DSA public keys |
| Ceremony records | `artifacts/phase4/ceremony/`, `transcripts/`, `hashes/` | Non-secret evidence |
| Benchmarks | `benchmarks/reports/*.json` | Performance evidence |
| Hash pins | `scripts/lib/resolve-artifacts.mjs` constants | Integrity anchors |

**Tracked file count:** 393 files (excluding `node_modules/`, as of 2026-08-07).

### B. Never Commit

| Material | Examples | Detection |
|----------|----------|-----------|
| Private keys | `*.key`, `*.pem`, `*.private` | `check:sensitive-files` (CRITICAL) |
| Environment secrets | `.env`, `.env.*` | `.gitignore` + scanner |
| ML-DSA private keys | `artifacts/provenance/keys/` | `.gitignore` + scanner |
| Operator / wallet credentials | mnemonics, keystore | Pattern scanner |
| HSM / deployment credentials | `deployments/` | `.gitignore` + scanner |
| TEE production secrets | Runtime attestation keys | External vault |

### C. Hash / Metadata Only

GitHub stores hashes and metadata; binaries live elsewhere.

| Asset | On GitHub | Binary location |
|-------|-----------|-----------------|
| `production.zkey` | SHA-256 pin `ce5a3d30…6571` | Secure storage (currently migration debt in `crypto-artifacts/`) |
| `production-vkey.json` | File hash + ceremony hash `d012bd29…d2ec` | `crypto-artifacts/phase4/` or `artifacts/phase4/final/` |
| wasm / r1cs | Hash pins in manifest | `crypto-artifacts/phase2/` |
| ML-DSA public keys | `aegis-ci-mldsa87-v1.json` | Committed registry |

### D. External Storage

| Asset | Storage tier | Access |
|-------|-------------|--------|
| `production.zkey` (target) | HSM / encrypted object store | CI OIDC + short-lived download |
| ML-DSA signing keys | Vault / GitHub Encrypted Secrets | `AEGIS_PQC_PRIVATE_KEY_HEX` |
| Operator ECDSA keys | HSM / MPC | Not in repository |
| Ceremony toxic waste | Air-gapped archive | Off GitHub permanently |

---

## Current State (Read-Only Audit)

### Migration Debt

The paths below are **git-tracked today** but listed as migration debt in `scripts/sensitive-files-allowlist.json`:

| Path | Classification | Target |
|------|----------------|--------|
| `crypto-artifacts/phase4/production.zkey` | HIGH — proving key | External secure storage |
| `crypto-artifacts/phase2/phase2/setup/*.ptau` | HIGH — ceremony material | External archive |
| `crypto-artifacts/phase2/phase2/setup/aegis_v2_0000.zkey` | HIGH — dev zkey | External archive |
| `crypto-artifacts/phase2/phase2/witness/*.wtns` | MEDIUM — witness | Regenerable; exclude from Git |

**Policy:**

- New commits matching forbidden patterns → **FAIL** (`npm run check:sensitive-files`)
- Allowlisted paths → **WARN** until migrated

### Directory Map

Classification key: **[A]** repository managed · **[B]** never commit · **[C/D]** metadata or external storage

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

## Frozen vs Operational

| 🔴 Frozen Core | 🔵 Operational / Extension |
|----------------|---------------------------|
| circuits, R1CS, zkey hash, VK hash | scripts/, CI, benchmarks |
| `Groth16VerifierV2Production.sol` | provenance, PQC adapter |
| `protocol/contracts`, `packages/sdk` | hybrid auth (research) |
| `publicSignals(30)`, `proveCanonical()` | public key registry |
| `tee/` ADR-001 | `check:sensitive-files` |

---

## Directory Structure Review

Proposed layout compared with the current repository:

| Proposed | Current | Recommendation |
|----------|---------|----------------|
| `circuits/` | Present | Keep — frozen sources |
| `protocol/` | Via `contracts/` + `protocol/` | Keep frozen; no rename |
| `packages/` | `packages/sdk/` | Keep |
| `scripts/prover/` | Flat `scripts/` | Defer — split when script count grows |
| `scripts/provenance/` | `scripts/lib/artifact-provenance.mjs` | Defer — `lib/` pattern is sufficient |
| `scripts/pqc/` | `scripts/lib/pqc-signature.mjs` | Defer |
| `scripts/auth/` | `scripts/lib/hybrid-auth-envelope.mjs` | Defer |
| `tests/` | Present | Keep |
| `docs/architecture/` | Present + boundary docs | Keep |
| `docs/security/` | Partially in `docs/research/` | Add when threat model doc is ready |
| `benchmarks/` | Present | Keep |
| `artifacts/provenance/` | manifest + public-keys | Keep — `keys/` gitignored |
| `.github/workflows/` | `aegis_repro_ci.yml` | Keep + `security-boundary-check` job |
| `.gitignore` | Hardened | Keep |

**Decision:** Document logical grouping only. No directory moves in this governance phase (avoids import path churn and preserves the frozen boundary).

---

## Enforcement

```bash
npm run check:sensitive-files          # CRITICAL fail + migration allowlist WARN
npm run check:sensitive-files -- --strict   # fail on allowlisted paths too
npm run check:security-boundary        # sensitive scan + provenance verify
```

CI job `security-boundary-check` runs on every pull request.

---

## Related Documents

- [GitHub Security Boundary](./github-security-boundary.md) — trust model and lifecycle
- [AegisProof v2 Full Architecture](./aegisproof-v2-full-architecture.md)
- [Artifact Retention Policy](../artifact-retention.md)
