# AegisProof v2 — Cryptographic Specification (Research Consolidation)

**Status:** Documentation consolidation (Phase A) — does not modify Frozen Core
**Version:** v2 (frozen semantics)
**Proof system:** Groth16 over BN128 (bn128 curve)

> **Frozen semantics:** Layout of **30 public signals**, `proveCanonical()` entry semantics, and hash-pinned artifacts are frozen. This document describes them; it does not authorize semantic change.

---

## 1. Purpose

This document consolidates cryptographic assumptions, security goals, and verification models for AegisProof v2. It is an **additive research document** for auditors and contributors. It does not replace `protocol/specs` or ADR-0001.

---

## 2. Trust Assumptions

| Assumption | Description | Evidence |
|------------|-------------|----------|
| **BN128 DLP hardness** | Discrete log on BN254 remains infeasible | Industry standard; Ethereum-aligned |
| **Groth16 soundness** | Valid proofs imply witness existence under trusted setup | Phase 4 ceremony + beacon |
| **Trusted setup integrity** | `production.zkey` matches pinned hash | `ce5a3d30…6571` pin, T1–T9 |
| **Poseidon collision resistance** | Poseidon(6)/Poseidon(8) suitable for commitments/nullifiers | circomlib standard |
| **Domain separation** | `AEGIS_NULLIFIER_V2` label prevents cross-protocol replay | `protocol/specs` domainSeparation |
| **Verifier key integrity** | VK ceremony hash matches pin | `d012bd29…d2ec` pin |
| **Honest prover (ZK)** | Prover knows witness for claimed public inputs | Standard ZK model |
| **Contract enforcement** | On-chain policy (timestamp window, chainId, nullifier registry) | `AegisShieldV2.sol` |

### Trusted Setup Caveat

Phase 4 ceremony used **orchestrated contributions** (not independent human MPC). Bitcoin genesis beacon applied. Residual risk: MEDIUM for high-value deployments — extend chain with independent contributors recommended.

---

## 3. Security Goals

1. **Knowledge soundness:** Prover demonstrates knowledge of `secretKey` and `deviceId` producing valid commitment and nullifier.
2. **Binding:** Public signals bind to in-circuit Poseidon recomputations (input-flip mechanism).
3. **Replay protection:** Nullifier registry prevents double-spend of consumption domain.
4. **Chain binding:** `chainId` in nullifier + contract check prevents cross-chain replay.
5. **Session binding:** `sessionId` in nullifier (Option A) ties consumption to session context.
6. **Artifact integrity:** SHA-256 provenance detects tampered binaries before prover runs.
7. **Metadata authenticity (additive):** ML-DSA-87 signs provenance entries — does not replace Groth16 verification.

---

## 4. Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Post-quantum Groth16 soundness | BN128 vulnerable to future quantum attacks; out of v2 scope |
| PQC replaces ZK verification | ADR-0003: PQC is outer metadata layer only |
| Timestamp in commitment | Flexibility; contract-side window enforcement |
| Contract address in nullifier | Undetermined at proving time; deployment domain at contract layer |
| TEE replaces ZK | TEE is research-only (ADR-001); Groth16 remains proof of record |
| Live KMS/OIDC/HSM guarantees | Code implemented; live trust chain **NOT VERIFIED** |
| Mainnet deployment guarantees | No mainnet deployment performed |

---

## 5. Groth16 Verification Model

```
Witness (secretKey, deviceId, ...)
    → Circom constraints
    → Groth16 proof (π)
    → Public signals[0..29]
    → snarkjs verify(VK, π, publicSignals)     [off-chain]
    → Groth16VerifierV2Production.verify(...)   [on-chain]
```

**Frozen invariants:**
- 30 public signals (canonical order)
- `proveCanonical()` entry semantics
- VK / zkey hash pins unchanged without Architecture Review

---

## 6. Commitment Semantics

**Hash:** Poseidon(6)

**Inputs (content identity, session-independent):**
- `expectedPromptRoot`, `expectedOutputRoot`
- `modelManifestCommitment`, `executionEnvCommitment`, `generationCommitment`
- `protocolVersion`

**Excluded from commitment:** `sessionId`, `purposeId`, `timestamp` (bound elsewhere or untrusted metadata)

**Property:** Same content roots → same commitment regardless of session context.

---

## 7. Nullifier Semantics

**Hash:** Poseidon(8)

**Inputs (consumption domain):**
- `DOMAIN_NULLIFIER_V2` (domain-separated constant)
- `secretKey`, `deviceId` (private)
- `purposeId`, `sessionId`, `commitment`, `protocolVersion`, `chainId` (public)

**Property:** Unique per consumption domain under Poseidon collision resistance. Contract rejects reused nullifiers.

**Collision assumption:** Negligible probability under standard hash assumptions — not unconditional injectivity.

---

## 8. Chain Binding

- `chainId` at public signal index 22
- Included in nullifier computation
- Contract validates `pubSignals[22] == block.chainid`
- Defense in depth: circuit constraint + nullifier + contract check

---

## 9. Public Signal Semantics

See [public-signal-security-rationale.md](./public-signal-security-rationale.md) for per-index analysis.

**Roles:**
- **Content:** Merkle roots, model/env/generation hashes → commitment inputs
- **Context:** `sessionId`, `purposeId` → nullifier inputs only
- **Domain:** `chainId`, `protocolVersion` → nullifier (+ commitment for version)
- **Metadata:** `timestamp` → contract window only; **not authenticated**
- **Derived:** `commitment`, `nullifier` → equality-constrained circuit outputs (input-flip)

---

## 10. Verification Key Integrity

| Artifact | Hash pin (prefix) | Module |
|----------|-------------------|--------|
| `production.zkey` | `ce5a3d30…6571` | `scripts/lib/resolve-artifacts.mjs` |
| VK ceremony | `d012bd29…d2ec` | `scripts/lib/resolve-artifacts.mjs` |

Provenance manifest cross-checks live file hashes against pins. Mismatch → fail-closed.

---

## 11. Frozen Core Boundary

**Frozen (Architecture Review required):**
- `circuits/`, `protocol/`, `packages/sdk/`, `verifier/`
- Groth16 artifacts, VK, `publicSignals(30)`, `proveCanonical()`

**Additive (may evolve):**
- `scripts/lib/artifact-provenance.mjs`, `pqc-signature.mjs`, `kms-*.mjs`
- `tests/security/`, `docs/research/`
- `tee/` (research layer per ADR-001)

---

## 12. Residual Cryptographic Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Lost `.circom` source | MEDIUM | R1CS behavioral oracle; hash pins |
| Orchestrated ceremony | MEDIUM | Beacon; extend with independent contributors |
| Quantum threat to BN128 | FUTURE | Monitor PQ-ZK research; PQC for metadata only today |
| Formal verification absent | MEDIUM | Extensive test suite; external audit recommended |

---

## References

- [protocol/specs](../../protocol/specs) — canonical 30-signal SSoT
- [cryptographic-assumptions.md](../../audit-ready/cryptographic-assumptions.md)
- [known-limitations.md](../../audit-ready/known-limitations.md)
- [ADR-0001](../adr/0001-frozen-core.md)
- [ADR-0003](../adr/0003-pqc-layer.md)
