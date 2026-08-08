# AegisProof v2

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/zenoamo/AegisProof-v2?label=v2.0.1)](https://github.com/zenoamo/AegisProof-v2/releases/tag/v2.0.1)
[![CI](https://img.shields.io/github/actions/workflow/status/zenoamo/AegisProof-v2/aegis_repro_ci.yml?branch=master&label=CI)](https://github.com/zenoamo/AegisProof-v2/actions/workflows/aegis_repro_ci.yml)

Groth16-based zero-knowledge protocol for proving knowledge of secret inputs that produce a commitment and nullifier, with **30 public signals** bound into the proof. Verification runs off-chain (Node.js) and on-chain (Solidity verifier + shield contract).

**License:** [MIT](LICENSE)

---

## Overview

AegisProof v2 separates a **frozen Groth16 core** (circuit, trusted setup hashes, verifier, SDK) from **additive governance layers** (artifact provenance, ML-DSA-87 metadata signing, CI security gates). External reviewers can verify integrity without trusting undocumented binaries.

---

## What it does

Today this repository lets you:

- **Prove and verify** Groth16 proofs with 30 pinned public signals (off-chain via Node.js, on-chain via Solidity verifier)
- **Run T1–T9 regression** to confirm prover/verifier compatibility across snarkjs and optional rapidsnark
- **Verify artifact integrity** via SHA-256 provenance manifest against live files
- **Audit the security boundary** with sensitive-file scanning and penetration tests (PT-01–PT-10)
- **Evaluate additive layers** — ML-DSA-87 metadata signing, hybrid auth envelope, KMS signer abstraction (mock/stub backends)

What it does **not** do today:

- Operate a live mainnet deployment
- Provide production HSM/Vault signing (Phase 8.14 Task 3+ — OIDC CI wiring pending)
- Enforce strict PQC manifest signing on PR-tier CI (WARN-only until promotion)

---

## Architecture

| Layer | Location | Role |
|-------|----------|------|
| Frozen ZK core | `circuits/`, `contracts/`, `protocol/`, `packages/sdk/` | Groth16 prove/verify |
| Provenance | `artifacts/provenance/`, `scripts/lib/artifact-provenance.mjs` | SHA-256 + optional ML-DSA-87 |
| Security gates | `scripts/check-sensitive-files.mjs`, CI | Repository boundary |
| TEE research | `tee/` (ADR-001 isolated) | Research adapter only |

Full diagrams: [docs/architecture/aegisproof-v2-full-architecture.md](docs/architecture/aegisproof-v2-full-architecture.md)

---

## Security Model

**GitHub (public):** source, tests, documentation, manifest, public keys, hash pins, CI workflows.

**External (private):** private keys, HSM credentials, `production.zkey` target storage, operator secrets.

Enforcement:

```bash
npm run check:sensitive-files       # 0 CRITICAL required
npm run verify:provenance -- --live # hash verification
npm run test:penetration            # PT-01–PT-10
```

See [docs/security/repository-boundary-report.md](docs/security/repository-boundary-report.md).

---

## Frozen Core

The following require **Architecture Review** before modification:

- `circuits/`, R1CS, `production.zkey` hash, verification key hash
- `Groth16VerifierV2Production.sol`, `protocol/contracts/`, `packages/sdk/`
- `publicSignals` layout (30), `proveCanonical()` semantics
- T1–T9 regression invariants

ADR: [docs/adr/0001-frozen-core.md](docs/adr/0001-frozen-core.md)

PQC (ML-DSA-87) and hybrid auth are **additive** — they do not replace Groth16 verification.

---

## Quick Start

```bash
git clone https://github.com/zenoamo/AegisProof-v2.git
cd AegisProof-v2
git checkout v2.0.1
npm install
npx hardhat compile

# Core verification
npm run test:prover-compat          # T1–T9 regression
npm run verify:provenance -- --live # artifact hashes
npm run check:sensitive-files       # secret boundary

# Security suites
npm run test:penetration            # PT-01–PT-10
npm run test:phase813               # unified Phase 8.13 gate
npm run test:kms-signer             # KMS abstraction (Phase 8.14)
```

Full guide: [docs/getting-started.md](docs/getting-started.md)

---

## Verification Commands

| Command | Purpose |
|---------|---------|
| `npm run test:prover-compat` | Groth16 T1–T9 (off-chain + on-chain) |
| `npm run verify:provenance -- --live` | Manifest SHA-256 vs live files |
| `npm run check:sensitive-files` | Secret / migration boundary |
| `npm run test:penetration` | Penetration test suite |
| `npm run test:pqc-signature` | ML-DSA-87 adapter tests |
| `npm run test:phase813` | Phase 8.13 unified regression |

Pinned hashes: zkey `ce5a3d30…6571`, VK ceremony `d012bd29…d2ec`.

---

## Documentation

| Index | Link |
|-------|------|
| Documentation hub | [docs/README.md](docs/README.md) |
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Security | [docs/security/](docs/security/) |
| ADRs | [docs/adr/](docs/adr/) |
| Release notes | [docs/release/v2.0.1-release-notes.md](docs/release/v2.0.1-release-notes.md) |
| Public release audit | [docs/security/github-public-release-audit-report.md](docs/security/github-public-release-audit-report.md) |

---

## CI

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `aegis_repro_ci.yml` | push / PR | Reproducibility + `security-boundary-check` |
| `security.yml` | push / PR / weekly | CodeQL + dependency review |
| `release.yml` | tag push (`v*.*.*`) | GitHub Release publish |

Primary security job (`security-boundary-check`): sensitive scan, penetration tests, provenance verify, T1–T9.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Use the PR checklist: frozen core unchanged, no secrets, tests run, docs updated.

Report security issues via [SECURITY.md](SECURITY.md).

---

## Status

| Area | State |
|------|-------|
| Production artifacts | Hash-pinned; reproducibility CI enforced |
| Mainnet deployment | **Not active.** Mainnet deployment is not currently active. |
| Testnet | Sepolia dry-runs documented; no production mainnet contracts |
| TEE layer (`tee/`) | Research-only adapter (ADR-001 isolated) |
| PQC manifest signing | Additive; PR tier emits WARN when unsigned |
| Phase 8.14 KMS/HSM | **Partial** — live Vault Transit + cloud HSM backends hardened (Task 3); GitHub OIDC CI wiring pending (Task 4) |
| Migration debt | 8 allowlisted binary paths (see [repository boundary report](docs/security/repository-boundary-report.md)) |

This repository is provided for **review and research**, not as a production deployment artifact.

---

## General Audience (Japanese)

- [30-second summary](docs/general-audience-30sec.md)
- [Introduction](docs/general-audience-intro.md)

---

## Disclaimer

This repository is provided for review and research. Artifact hashes are pinned for reproducibility; PQC manifest signing on PR tier may emit WARN until strict promotion. Migration debt (8 allowlisted binary paths) is documented in [docs/security/repository-boundary-report.md](docs/security/repository-boundary-report.md).

---

## License

This project is licensed under the [MIT License](LICENSE).

You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the conditions in the license file. The software is provided "as is", without warranty of any kind.
