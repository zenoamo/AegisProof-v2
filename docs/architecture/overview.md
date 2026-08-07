# AegisProof Architecture

**Version:** v2 (SSoT frozen)  
**Status:** Production artifacts pinned; no deployments beyond testnet dry-runs  

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

Defined in [specs/aegis-protocol.v2.json](../specs/aegis-protocol.v2.json). Key policies:

| Policy | Value / Rule |
|---|---|
| Public signal order | Canonical, measured by C-1 gate; 30 signals |
| Timestamp binding | Untrusted metadata; excluded from commitment/nullifier |
| ChainId binding | Signal included in nullifier; enforced against `block.chainid` |
| Session binding | sessionId nullifier-bound + session registry on-chain |
| Replay protection | Used-nullifier set in Shield contract |
| Timestamp window | Contract-side: `now ∈ [ts - MAX_AGE - SKEW, ts + SKEW]` |
| Versions | `SUPPORTED_PROTOCOL_VERSION = 2`; future upgrades via versioning |

### 3. On-chain contracts

#### Verifier

- `contracts/Groth16VerifierV2Production.sol`: generated from the **production zkey**; IC constants embedded; 31-point linear combination for Groth16.
- Dev verifier also present: `Groth16VerifierV2.sol` (single-contribution dev setup, not for production use).

#### Shield

- `contracts/AegisShieldV2.sol`: immutable; operator-controlled session lifecycle; proof acceptance policy.
- Constructor parameters: `_verifierAddress`, `_operator`.
- Constants: `DEPLOYMENT_DOMAIN`, `SUPPORTED_PROTOCOL_VERSION`, `MAX_AGE_seconds`, `CLOCK_SKEW_seconds`.

### 4. SDK & tooling

- **TypeScript SDK** ([@aegisproof/sdk](../packages/sdk)): proof loading, calldata generation, contract interaction helpers, typed errors.
- **Verification suite** (scripts): FAST/FULL modes, negative tests, IC/VK checks.
- **CI reproducibility** (`.github/workflows/aegis_repro_ci.yml`): FAST on push/PR, FULL weekly/manual.

### 5. TEE Adapter Layer (Layer B — research/PoC)

Isolated from protocol v2. Architecture frozen per [ADR-001](./adr/001-architecture-hardening-freeze.md).

- **Pipeline:** [TEE Attestation Pipeline](./architecture/tee-pipeline.md) — compose-only orchestration
- **Regression:** Stage A–G via `npx tsx tee/scripts/evaluate.ts`
- **Trust model:** `VerificationLevel` + `ClaimsGate` (see ADR-001)

---

## Deployment topology

See [`docs/deployment.md`](./deployment.md). Summary:

- **Local Hardhat**: in-process node; deploy verifier + shield; verify locally.
- **Sepolia**: live testnet usage; deploy producer verifier; run on-chain verifier tests.
- **Mainnet**: documentation only at this time; no deployments have been performed.

Deployment model: **immutable**; no proxies or upgradeable patterns in Phase 5.

---

## Verification flows

### Off-chain proof generation

1. Input preparation (public signals + private keys).
2. Witness generation via `*.witness_calculator.js` loaded from `aegis_commit_core_v2_js`.
3. Proving using the production zkey (`artifacts/phase4/final/production.zkey`).
4. Produces `proof` + `publicSignals`.

### Off-chain verification

1. Load production VK JSON (`artifacts/phase4/final/production-vkey.json`).
2. Verify using snarkjs (`groth16.verify(vkey, publicSignals, proof)`).
3. Cross-check public signals vs expected values (SSoT mapping).

### On-chain verification

1. Caller invokes `verifyProof(pA, pB, pC, pubSignals)` on the verifier contract.
2. If successful, caller may proceed to `verifyAndAccept` on the Shield contract.
3. Shield enforces additional policy (session validity, timestamp window, replay check).

---

## Security considerations

See [GitHub security boundary](./github-security-boundary.md) and [`docs/key-management-policy.md`](../key-management-policy.md). Highlights:

- **IC binding**: any post-prove tampering of public signals breaks Groth16 verification.
- **Timestamp exclusion**: circuit does not constrain timestamp; freshness ensured contract-side within window.
- **Dev vs production keys**: strictly separated; dev keys must never be promoted to production.
- **Trusted setup**: Phase 4 ceremony completed; independent contribution recommended before mainnet value deployment.

---

## Operations

- **Operational checklist**: see [`docs/deployment-checklist.md`](./deployment-checklist.md).
- **Incident response**: severity levels approved (Critical/Moderate/Low); see [`docs/incident-response.md`](./incident-response.md).
- **Key management**: HSM/MPC-backed operator keys preferred; rotation policy documented in [`docs/key-management-policy.md`](./key-management-policy.md).

---

## Versioning and compatibility

- **v1 (Phase 0)**: immutable evidence artifacts preserved; verifiers present (`Groth16Verifier29.sol`, `Groth16Verifier.sol`).
- **v2 (current)**: canonical R1CS/wasm/sym pinned; production VK committed; Shields enforce `SUPPORTED_PROTOCOL_VERSION = 2`.
- **v2 reconstruction**: deferred (task defined in [`docs/v2-circom-reconstruction-task.md`](../docs/v2-circom-reconstruction-task.md); no execution performed).

---

## Future phases

- **Phase 6**: potential expansion (e.g., ceremony extension by independent contributors, proxy-based operational flexibility if explicitly authorized, Python bindings for SDK).
- Any protocol modification requires explicit human authorization per current policy.
