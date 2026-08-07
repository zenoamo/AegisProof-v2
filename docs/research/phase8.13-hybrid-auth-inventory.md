# Hybrid Auth Inventory (Phase 8.13)

**Date:** 2026-08-07  
**Scope:** Operator authentication and deployment authorization  
**Status:** Research inventory — no protocol changes  

---

## 1. Operator Authentication Flow

| Layer | Mechanism | Location |
|-------|-----------|----------|
| On-chain operator | EOA / contract `operator` role | `protocol/contracts/` (FROZEN) |
| Session lifecycle | `registerSession()` / `deactivateSession()` | Shield contract (FROZEN) |
| Deployment scripts | Hardhat signer account | `scripts/deploy.ts` |
| Key policy | HSM/MPC preferred | `docs/key-management-policy.md` |

**Current state:** Deployment uses Hardhat-managed accounts (local `.env` keys). No standalone off-chain auth envelope is enforced before `deploy.ts` executes. Operator authorization is **on-chain** at transaction time.

**PQC insertion point:** Pre-deployment authorization wrapper in `scripts/` — sign deployment intent before broadcast, without modifying contracts.

---

## 2. Deployment Scripts

| Script | Auth today | PQC-safe insertion |
|--------|-----------|-------------------|
| `scripts/deploy.ts` | Hardhat network signer | Wrap with `verifyHybridAuthEnvelope()` before deploy |
| `scripts/onchain-verify-once.ts` | Hardhat signer | Optional envelope for audit trail |
| `docs/deployment-playbook.md` | Human approval checklist | Document hybrid envelope step |

No deployment script currently verifies an off-chain authorization envelope.

---

## 3. Admin / Session Management

| Concern | Implementation | Frozen? |
|---------|----------------|---------|
| Session registry | On-chain Shield | Yes |
| Purpose allowances | `setPurposeAllowed()` | Yes |
| Timestamp window | Shield policy | Yes |
| sessionId binding | Circuit public signal [2] | Yes |

Session/admin logic lives in **protocol contracts** — out of scope for Task 6 changes.

---

## 4. Existing ECDSA Fixtures

| Context | Algorithm | Location |
|---------|-----------|----------|
| TEE offline PoC | ECDSA P-256 / P-384 | `tee/verification/*-offline-verifier.ts` |
| TEE ADR-001 boundary | `OFFLINE_FIXTURE` level | `docs/adr/001-architecture-hardening-freeze.md` |
| Hybrid auth research | ECDSA secp256k1 | `scripts/lib/hybrid-auth-envelope.mjs` (Task 6) |

TEE ECDSA fixtures are **isolated** from operator deployment auth. Task 6 uses secp256k1 for deployment-operator compatibility (Ethereum-style keys).

---

## 5. TEE Layer Boundary (ADR-001)

```
FROZEN: tee/ adapter pipeline
  Provider → Verifier → Normalizer → ClaimsGate → Policy

NOT IN SCOPE: tee/ modifications for hybrid auth
```

Hybrid auth envelope is a **scripts-layer** concern parallel to TEE attestation — no cross-boundary merge in Task 6.

---

## Trust Boundary Summary

```
                    ┌─────────────────────────────┐
  Operator ────────►│ Hybrid Auth Envelope (NEW)  │ scripts/ only
                    │  ECDSA + ML-DSA-87          │
                    └─────────────┬───────────────┘
                                  │ (optional gate)
                    ┌─────────────▼───────────────┐
                    │ deploy.ts / Hardhat signer  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │ protocol/contracts (FROZEN) │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │ Groth16 verify (FROZEN)     │
                    └─────────────────────────────┘
```

---

## PQC Insertion Point

**Recommended (Task 6):**

1. Operator builds `createDeploymentAuthPayload(operator, action, metadata)`
2. Signs with `createHybridAuthEnvelope()` — classical and/or PQC
3. CI / deployment tooling calls `verifyHybridAuthEnvelope()` before script proceeds
4. Protocol contracts unchanged — envelope is audit + policy layer only

---

## Frozen Boundary Confirmation

**Unchanged:**

- circuits/, R1CS, production.zkey, VK
- Groth16VerifierV2Production.sol
- publicSignals layout (30)
- protocol/contracts/, packages/sdk/, tee/
- proveCanonical() semantics

**Changed (allowed):**

- `scripts/lib/hybrid-auth-envelope.mjs`
- tests/, docs/research/, CI optional jobs

---

## Related

- `docs/research/phase8.13-hybrid-auth-envelope.md` — Task 6 design
- `docs/research/phase8.13-pqc-ci-policy.md` — provenance CI (parallel layer)
- `docs/key-management-policy.md` — operator key lifecycle
