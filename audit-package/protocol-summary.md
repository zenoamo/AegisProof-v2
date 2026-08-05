# AegisProof Protocol Summary (v2)

**Purpose:** Human-readable description of cryptographic properties without secrets.  
**Version:** v2 (SSoT frozen)  
**Production VK Hash:** `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`

---

## Protocol Overview

AegisProof implements a Groth16-based zero-knowledge proof system for commitment and nullifier generation with public signal binding.

### Cryptographic Parameters

- **Curve:** BN128 (pairing-friendly elliptic curve)
- **Proof system:** Groth16 (optimized short proofs)
- **Public signals:** 30 values bound into proof
- **Private inputs:** 2 wires (secretKey, deviceId)
- **Circuit constraints:** ~6,590 linear constraints
- **Commitment:** Poseidon hash over 6 field elements
- **Nullifier:** Poseidon hash over 8 field elements with domain separator `"AEGIS_NULLIFIER_V2"`

### Security Properties

1. **IC Binding:** Public signals cannot be tampered post-prove without breaking verification
2. **Timestamp Policy:** Freshness enforced contract-side within window (`MAX_AGE=86400s`, `SKEW=300s`)
3. **ChainId Enforcement:** Proof valid only on specified chainID (signal[1])
4. **Session Nullifier-Binding:** sessionId included in nullifier computation for replay protection
5. **Versioning:** Future upgrades controlled via protocol version signal and contract-side enforcement

---

## Artifact Status

| Type | Hash | Status |
|---|---|---|
| Canonical R1CS | `3d47226b...` | Immutable (Phase 0 pinned) |
| WASM generator | `a0d3c53f...` | Immutable (Phase 0 pinned) |
| Production zkey | `ce5a3d30...` | Phase 4 finalized |
| Production vkey | `d012bd29...` | Phase 4 finalized |
| Phase 4 ptau | `4afdd19b...` | Multi-contributor + beacon |

All hashes verified against artifact manifest. No modifications permitted without explicit authorization.

---

## Deployment Model

- **Immutable contracts:** No proxy/upgradeable patterns in Phase 5
- **Operator control:** Session lifecycle managed via operator address
- **Replay protection:** Used-nullifier tracking in shield contract
- **No deployments performed:** All examples read-only; testnet deployments optional pending stakeholder approval

---

## References

- Full protocol spec: [`specs/aegis-protocol.v2.json`](../specs/aegis-protocol.v2.json)
- Ceremony report: [`docs/phase4-ceremony-report.md`](./ceremony-report-ref.md)
- Security model: [`docs/security-model.md`](../docs/security-model.md)
- Threat model: [`docs/threat-model.md`](../docs/threat-model.md)
