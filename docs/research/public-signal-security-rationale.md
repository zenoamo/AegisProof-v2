# AegisProof v2 — Public Signal Security Rationale

**Status:** Documentation consolidation (Phase A)  
**Scope:** 30-signal layout semantics — **layout itself is frozen and unchanged**  
**SSoT:** [protocol/specs](../../protocol/specs)

---

## 1. Overview

AegisProof v2 exposes **30 public signals** in a canonical order. The circuit uses an **input-flip** mechanism: `commitment` and `nullifier` are public inputs equality-constrained to in-circuit Poseidon recomputations.

This document explains **why** each signal exists and **what security property** it supports. It does not authorize layout changes.

---

## 2. Signal Role Taxonomy

| Role | Purpose | Replay / binding |
|------|---------|------------------|
| **content** | Identifies what was proven | Bound via commitment |
| **context** | Usage/session context | Bound via nullifier |
| **domain** | Protocol/chain scope | Bound via nullifier (+ version in commitment) |
| **metadata** | Untrusted prover-chosen data | Contract window only |
| **derived** | Circuit-computed outputs | Equality-constrained |

---

## 3. Per-Signal Reference

| Idx | Name | Role | In Commitment | In Nullifier | Security rationale |
|-----|------|------|:-------------:|:------------:|-------------------|
| 0 | expectedPromptRoot | content | ✅ | ❌ | Binds proof to prompt Merkle root |
| 1 | expectedOutputRoot | content | ✅ | ❌ | Binds proof to output Merkle root |
| 2 | sessionId | context | ❌ | ✅ | Session-scoped consumption (Option A) |
| 3 | purposeId | context | ❌ | ✅ | Purpose whitelist at contract |
| 4 | weightsHash | content | ✅ (via modelManifest) | ❌ | Model identity component |
| 5 | tokenizerHash | content | ✅ (via modelManifest) | ❌ | Tokenizer identity |
| 6 | systemPromptHash | content | ✅ (via modelManifest) | ❌ | System prompt identity |
| 7 | loraHash | content | ✅ (via modelManifest) | ❌ | LoRA adapter identity |
| 8 | adapterHash | content | ✅ (via modelManifest) | ❌ | Adapter identity |
| 9 | safetyLayerHash | content | ✅ (via modelManifest) | ❌ | Safety layer identity |
| 10 | quantizationHash | content | ✅ (via executionEnv) | ❌ | Quantization config |
| 11 | precisionHash | content | ✅ (via executionEnv) | ❌ | Precision config |
| 12 | runtimeHash | content | ✅ (via executionEnv) | ❌ | Runtime identity |
| 13 | driverHash | content | ✅ (via executionEnv) | ❌ | Driver identity |
| 14 | temperature | content | ✅ (via generation) | ❌ | Sampling parameter |
| 15 | topP | content | ✅ (via generation) | ❌ | Nucleus sampling |
| 16 | topK | content | ✅ (via generation) | ❌ | Top-k sampling |
| 17 | seed | content | ✅ (via generation) | ❌ | Generation seed |
| 18 | repetitionPenalty | content | ✅ (via generation) | ❌ | Decoding parameter |
| 19 | presencePenalty | content | ✅ (via generation) | ❌ | Decoding parameter |
| 20 | frequencyPenalty | content | ✅ (via generation) | ❌ | Decoding parameter |
| 21 | maxTokens | content | ✅ (via generation) | ❌ | Generation limit |
| 22 | chainId | domain | ❌ | ✅ | Cross-chain replay prevention |
| 23 | protocolVersion | domain | ✅ | ✅ | Version binding (v2 = 2) |
| 24 | timestamp | metadata | ❌ | ❌ | **Unauthenticated**; contract window only |
| 25 | modelManifestCommitment | content | ✅ | ❌ | Poseidon tree over model hashes |
| 26 | executionEnvCommitment | content | ✅ | ❌ | Poseidon tree over env hashes |
| 27 | generationCommitment | content | ✅ | ❌ | Poseidon tree over generation params |
| 28 | commitment | derived | ❌ | ✅ | Content identity hash (input-flip) |
| 29 | nullifier | derived | ❌ | ❌ (output) | Consumption ID (input-flip) |

---

## 4. Commitment vs Nullifier Split

**Design intent (Option A):**
- **Commitment** = *what* was proven (content identity)
- **Nullifier** = *where/when/how consumed* (consumption domain)

**Excluded from commitment by design:**
- `sessionId`, `purposeId` — usage context via nullifier
- `timestamp` — untrusted metadata; freshness at contract only

**Rationale:** Separating content identity from consumption context allows same content proof with different sessions while preventing cross-session replay via nullifier registry.

---

## 5. Timestamp Policy

| Property | Value |
|----------|-------|
| In commitment | **No** |
| In nullifier | **No** |
| Contract enforcement | `MAX_AGE = 86400s`, `CLOCK_SKEW = 300s` |
| Replay protection | **Nullifier registry**, not timestamp |

**Security note:** Prover can choose arbitrary timestamp within circuit; contract rejects outside window. Timestamp must **not** be used as sole replay defense.

---

## 6. Chain Binding (Index 22)

Triple enforcement:
1. Circuit includes `chainId` in nullifier Poseidon(8)
2. Public signal exposed to verifier
3. Contract: `pubSignals[22] == block.chainid`

Malicious prover cannot omit chain binding without breaking proof validity.

---

## 7. Input-Flip Mechanism

**Problem solved:** AF-1 outputs-first layout from circom wire allocation.

**Solution:** All 30 signals declared as public **inputs** in canonical order. `commitment` and `nullifier` provided by prover but **equality-constrained** to in-circuit recomputation.

**Security property:** Verifier checks both proof validity and public input consistency with constrained values.

---

## 8. Contract Policy Cross-Reference

From `protocol/specs` contractPolicy:
- Zero checks: `sessionId`, `purposeId`, `commitment`, `nullifier` ≠ 0
- Version: `pubSignals[23] == SUPPORTED_PROTOCOL_VERSION (2)`
- Cross-contract: deployment domain at contract layer; address not in nullifier

---

## 9. What This Document Does Not Do

- Does **not** change signal order or count
- Does **not** modify circuit constraints
- Does **not** alter SDK `proveCanonical()` packing

Layout changes require Architecture Review per ADR-0001.

---

## References

- [protocol/specs](../../protocol/specs)
- [cryptographic-specification.md](./cryptographic-specification.md)
- [known-limitations.md](../../audit-ready/known-limitations.md) §4 (timestamp)
