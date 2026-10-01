# AegisProof Architecture

**Version:** v2 (SSoT frozen)  
**Status:** Production artifacts pinned; **mainnet deployment NOT ACTIVE / NOT VERIFIED**

### Operational status (do not conflate)

| Label | Meaning in this repository |
|-------|----------------------------|
| **Production artifacts pinned** | Canonical R1CS, WASM, `production.zkey`, VK, and hash pins are fixed and regression-tested (T1–T9) |
| **Testnet dry-runs** | Sepolia / local Hardhat procedures documented; not a live production deployment |
| **Mainnet deployment** | **NOT ACTIVE** — no mainnet contracts deployed from this repository |
| **Live Vault / OIDC / Cloud HSM** | Code and tests exist; **NOT VERIFIED** against live infrastructure |
| **Production TEE** | **NOT VERIFIED** — `tee/` is research/PoC; offline/mock/fixture scope only |
| **Research demo** | `RESEARCH_DEMO_ONLY` — does not imply production cryptographic guarantees |

> **Frozen semantics:** *Frozen* means **cryptographic / protocol semantics and security boundaries** are immutable without Architecture Review. It does **not** mean every file under a frozen path is never edited — implementation, operational, and research layers may evolve **additively** within those boundaries (see [Frozen vs Mutable](#frozen-vs-mutable-boundary) below).

---

## Overview

AegisProof v2 is a **Groth16-based zero-knowledge protocol**. A prover demonstrates knowledge of secret inputs that generate a commitment and nullifier while binding 30 public signals into the proof. The circuit is implemented in Circom (compiled artifacts are pinned). Verification runs off-chain (Node.js) and on-chain (Solidity verifier and shield contract).

The production trusted setup was completed under explicit human authorization in **Phase 4**, producing a multi-contribution chain finalized with a **Bitcoin genesis block hash beacon**.

**Related:** [GitHub repository boundary](./github-repository-boundary.md) · [GitHub security boundary](./github-security-boundary.md) · [Full architecture diagrams](./aegisproof-v2-full-architecture.md)

---

## Components

### 1. Circuit (canonical binaries)

- **Source**: lost; compiled artifacts are the canonical ground truth.
- **Artifacts**:
  - `artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs` (`3d47226b…`)
  - `artifacts/phase2/r1cs/aegis_commit_core_v2.sym` (`3aea81b1…`)
  - `artifacts/phase2/r1cs/aegis_commit_core_v2_js/*.wasm` (`a0d3c53f…`)
- **Inputs/outputs**: 30 public signals, 2 private wires (`secretKey`, `deviceId`), 0 outputs (input-flip layout).
- **Commitment**: Poseidon(6).
- **Nullifier**: Poseidon(8) with domain separator derived from `"AEGIS_NULLIFIER_V2"`.

### 2. Protocol v2 (SSoT)

Defined in [specs](../../specs) (canonical 30-signal SSoT). Key policies:

| Policy | Value / Rule |
|---|---|
| Public signal order | Canonical, measured by C-1 gate; 30 signals |
| Timestamp binding | Untrusted metadata; excluded from commitment/nullifier |
| ChainId binding | Signal included in nullifier; enforced against `block.chainid` |
| Session binding | sessionId nullifier-bound + session registry on-chain |
| Replay protection | Shared canonical `AegisNullifierRegistry` + Shield-local observability state; supported chains pin the canonical registry address at contract level |
| Timestamp window | Contract-side: `now ∈ [ts - MAX_AGE - SKEW, ts + SKEW]` |
| Versions | `SUPPORTED_PROTOCOL_VERSION = 2`; future upgrades via versioning |

### 3. On-chain contracts

#### Verifier

- `protocol/contracts/Groth16VerifierV2Production.sol`: generated from the **production zkey**; IC constants embedded; 31-point linear combination for Groth16.
- Dev verifier also present: `protocol/contracts/Groth16VerifierV2.sol` (single-contribution dev setup, not for production use).

#### Shield

- `protocol/contracts/AegisShieldV2.sol`: immutable; operator-controlled session lifecycle; proof acceptance policy.
- `protocol/contracts/AegisNullifierRegistry.sol`: replay registry shared by all Shield deployments on a supported chain. `AegisShieldV2` fail-closes unless the supplied registry equals the chain's canonical address from `AegisCanonicalRegistry`.
- Constructor parameters: `_verifierAddress`, `_operator`, `_nullifierRegistry`; `_nullifierRegistry` is pinned to the supported chain's canonical registry address.
- Constants: `DEPLOYMENT_DOMAIN`, `SUPPORTED_PROTOCOL_VERSION`, `MAX_AGE_seconds`, `CLOCK_SKEW_seconds`.

### 4. SDK & tooling

- **TypeScript SDK** ([@aegisproof/sdk](../../packages/sdk)): proof loading, calldata generation, contract interaction helpers, typed errors.
- **Verification suite** (scripts): FAST/FULL modes, negative tests, IC/VK checks.
- **CI reproducibility** (`.github/workflows/aegis_repro_ci.yml`): FAST on push/PR, FULL weekly/manual.

### 5. TEE Adapter Layer (Layer B — research/PoC)

Isolated from protocol v2. **ADR-001 isolation boundary is frozen** per [ADR-001](../adr/001-architecture-hardening-freeze.md).

- **Pipeline:** [TEE Attestation Pipeline](./tee-pipeline.md) — compose-only orchestration
- **Regression:** Stage A–G via `npx tsx tee/scripts/evaluate.ts` (mock/fixture paths)
- **Trust model:** `VerificationLevel` + `ClaimsGate` (see ADR-001)
- **Verification scope today:** offline/mock/fixture only — **NOT VERIFIED** for DCAP/PCCS/KDS online paths or production TEE hardware
- **Protocol merge:** TEE claims do **not** silently alter Groth16, `publicSignals(30)`, or contract semantics; TEE → protocol v2 semantic merge is **forbidden**

Mock / fixture PASS in CI must **not** be read as live production TEE verification.

---

## Frozen vs Mutable boundary

### Frozen (Architecture Review required to change semantics)

| Domain | What is frozen |
|--------|----------------|
| Canonical circuit artifacts | Compiled WASM, R1CS, `production.zkey`, ceremony evidence / hash pins |
| Verification | Production VK, `Groth16VerifierV2Production.sol` semantics |
| Protocol | `protocol/` contract semantics, 30-signal public layout, `proveCanonical()` return semantics |
| SDK | `packages/sdk/` public API semantics |
| TEE boundary | ADR-001 isolation — no protocol merge, SB-01–SB-04 |

### Mutable / extension (additive within frozen semantics)

| Domain | May evolve additively |
|--------|----------------------|
| Prover backend | snarkjs, rapidsnark, witness tooling |
| Artifact resolver | `resolveArtifacts()` profiles, fail-closed pins |
| Provenance | SHA-256 manifest, ML-DSA-87 metadata layer, public-key registry |
| Auth research | Hybrid auth envelope (research-only) |
| CI / benchmarks | T1–T9 gates, penetration suites, research demo scripts |
| TEE adapters | Provider parsers, offline fixtures, evaluation stages — **not** live production attestation |

**Principle:** semantics are frozen; implementation and operational layers may evolve additively without changing Groth16 proof/verify meaning.

---

## Deployment topology

See [deployment.md](../deployment.md). Summary:

- **Local Hardhat**: in-process node; deploy verifier + canonical registry + shield; the deployment script fails closed if the registry address drifts.
- **Sepolia**: live testnet usage; deploy producer verifier; run on-chain verifier tests.
- **Mainnet**: documentation only at this time; no deployments have been performed.

Deployment model: **immutable**; no proxies or upgradeable patterns in Phase 5.

---

## Verification flows

### Off-chain proof generation

1. Input preparation: **private** `secretKey`, `deviceId`; **public metadata** mapped to the fixed 30-signal layout.
2. Witness generation via `*.witness_calculator.js` loaded from `aegis_commit_core_v2_js`.
3. Proving using canonical artifacts (WASM, R1CS, `production.zkey`) via **`proveCanonical()`**.
4. Produces `proof` + **`publicSignals[30]`** (frozen layout — see [public-signal-security-rationale](../research/public-signal-security-rationale.md)).

### Off-chain verification

1. Load production VK JSON (`artifacts/phase4/final/production-vkey.json`).
2. Verify using snarkjs (`groth16.verify(vkey, publicSignals, proof)`).
3. Cross-check public signals vs expected values (SSoT mapping).

### On-chain verification

1. Caller invokes `verifyProof(pA, pB, pC, pubSignals)` on the verifier contract.
2. If successful, caller may proceed to `verifyAndAccept` on the Shield contract.
3. Shield enforces additional policy (session validity, timestamp window, replay check).

**Responsibility split (unchanged):**

- **`chainId` / `sessionId` / nullifier:** bound in-circuit and enforced on-chain (replay protection).
- **`timestamp`:** circuit does **not** constrain timestamp; it is **untrusted metadata**; freshness is enforced **contract-side** only (`MAX_AGE`, `CLOCK_SKEW` window).

---

## Security considerations

See [GitHub security boundary](./github-security-boundary.md) and [`docs/key-management-policy.md`](../key-management-policy.md). Highlights:

- **IC binding**: any post-prove tampering of public signals breaks Groth16 verification.
- **Timestamp exclusion**: circuit does not constrain timestamp; freshness ensured contract-side within window.
- **Dev vs production keys**: strictly separated; dev keys must never be promoted to production.
- **Trusted setup**: Phase 4 ceremony completed; artifact hashes pinned; ceremony evidence preserved. Beacon / ceremony evidence explains **setup provenance** — it does not alone guarantee operational or deployment safety. Independent contribution recommended before high-value deployment.

---

## Operations

- **Operational checklist**: see [deployment-checklist.md](../deployment-checklist.md).
- **Incident response**: severity levels approved (Critical/Moderate/Low); see [incident-response.md](../incident-response.md).
- **Key management**: HSM/MPC-backed operator keys preferred; rotation policy documented in [key-management-policy.md](../key-management-policy.md).

---

## Versioning and compatibility

- **v1 (Phase 0)**: immutable evidence artifacts preserved; verifiers present (`Groth16Verifier29.sol`, `Groth16Verifier.sol`).
- **v2 (current)**: canonical R1CS/wasm/sym pinned; production VK committed; Shields enforce `SUPPORTED_PROTOCOL_VERSION = 2`.
- **v2 reconstruction**: deferred (task defined in [v2-circom-reconstruction-task.md](../v2-circom-reconstruction-task.md); no execution performed).

---

## Future phases

- **Phase 6+ / Phase 9 research:** PQ-ZK, STARK, or new verifier pairs are **research / evaluation only** — parallel migration paths; **no implicit replacement** of Groth16 v2.
- Proxy-based upgrade or new protocol versions are **separate architecture decisions** — not committed future deployments.
- Any change to frozen cryptographic / protocol semantics requires explicit Architecture Review and human authorization.
