# AegisProof v2

Groth16-based zero-knowledge protocol for proving knowledge of secret inputs that produce a commitment and nullifier, with 30 public signals bound into the proof. Verification runs off-chain (Node.js) and on-chain (Solidity verifier + shield contract).

**Status:** Production artifacts pinned; testnet dry-runs only. No mainnet deployment performed.

---

## Documentation

| Topic | Document |
|-------|----------|
| Architecture overview | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Full architecture diagrams | [docs/architecture/aegisproof-v2-full-architecture.md](docs/architecture/aegisproof-v2-full-architecture.md) |
| GitHub repository boundary | [docs/architecture/github-repository-boundary.md](docs/architecture/github-repository-boundary.md) |
| GitHub security boundary | [docs/architecture/github-security-boundary.md](docs/architecture/github-security-boundary.md) |
| Getting started | [docs/getting-started.md](docs/getting-started.md) |
| Prover regression (T1–T9) | [docs/perf/prover-regression-contract.md](docs/perf/prover-regression-contract.md) |
| ADR-001 (TEE freeze) | [docs/adr/001-architecture-hardening-freeze.md](docs/adr/001-architecture-hardening-freeze.md) |
| External audit index | [EXTERNL_AUDIT_INDEX.md](EXTERNL_AUDIT_INDEX.md) |

---

## Frozen Core

The following require Architecture Review before modification:

- `circuits/` compiled artifacts, R1CS, `production.zkey`, verification key
- `Groth16VerifierV2Production.sol`, `protocol/contracts/`, `packages/sdk/`
- `publicSignals` layout (30), `proveCanonical()` semantics
- T1–T9 regression invariants

PQC (ML-DSA-87) and hybrid auth layers are **additive**. They strengthen artifact provenance and operator authorization; they do not replace Groth16.

---

## Quick Start

```bash
npm install
npx hardhat compile
npm run test:prover-compat          # T1–T9 regression
npm run verify:provenance -- --live # artifact hash verification
npm run check:sensitive-files       # repository security boundary
```

See [docs/getting-started.md](docs/getting-started.md) for the full local workflow.

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `circuits/` | Circuit sources (compiled artifacts pinned) |
| `contracts/` | Groth16 verifier and Shield contracts |
| `packages/sdk/` | TypeScript SDK (`@aegisproof/sdk`) |
| `scripts/` | Prover, provenance, CI, and verification tooling |
| `artifacts/` | Ceremony evidence, provenance manifest, public keys |
| `crypto-artifacts/` | Artifact mirror (migration debt for large binaries) |
| `tee/` | TEE adapter layer (ADR-001 isolated research) |
| `tests/` | Regression and provenance tests |
| `.github/workflows/` | CI security gates |

---

## Security Boundary

**GitHub managed:** source code, tests, docs, CI workflows, manifests, public metadata, ML-DSA public keys.

**External storage:** private keys, `production.zkey` (target state), secrets, operator credentials.

Enforcement: `npm run check:sensitive-files` and CI job `security-boundary-check`.

---

## CI

| Job | Trigger | Purpose |
|-----|---------|---------|
| `security-boundary-check` | PR / push | Sensitive scan, provenance verify, T1–T9 |
| `prover-compatibility` | PR / push | Extended prover and PQC tests |
| `fast` | PR / push | Phase 2 gates and verification suite |
| `provenance-pqc-hardening` | schedule / manual | Strict PQC verification (`--pqc`) |

Workflow: `.github/workflows/aegis_repro_ci.yml`

---

## General Audience

- [30-second summary (Japanese)](docs/general-audience-30sec.md)
- [Introduction (Japanese)](docs/general-audience-intro.md)
