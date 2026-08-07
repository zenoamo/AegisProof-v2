# Cryptographic Assumptions Summary

**Purpose:** Document all cryptographic assumptions for independent review  
**Version:** v2 (frozen)  
**Proof system:** Groth16 over BN128 curve  

---

## Core Cryptographic Assumptions

### 1. BN128 Curve Security

**Assumption:** The BN254 elliptic curve remains secure against discrete logarithm attacks.

**Security margin:** 128-bit security level (current best attacks require ~2^128 operations)

**Status:** Industry-standard; used by Ethereum mainnet and many ZK protocols

**Risk assessment:** LOW — widely deployed and extensively reviewed

---

### 2. Groth16 Soundness

**Assumption:** The trusted setup ceremony produced valid proving/verification keys with no backdoor.

**Trust model:** Multi-contributor + Bitcoin genesis hash beacon (Phase 4 ceremony)

**Contributions:** 3 orchestrated contributions (disclosure: not independent human contributors)

**Mitigations:**
- Beacon is public and immutable (Bitcoin genesis block hash)
- Each contribution verified via `zKey.verifyFromR1cs`
- Final verification confirms IC integrity

**Recommendation:** Extend chain with independent human contributions before mainnet deployment of significant value

**Risk assessment:** MEDIUM — beacon provides assurance, but independent contributions recommended for high-value deployments

---

### 3. Poseidon Hash Function

**Assumption:** Poseidon hash function maintains collision resistance and preimage resistance.

**Parameters:** 
- Commitment: Poseidon(6) over field elements
- Nullifier: Poseidon(8) over field elements

**Security level:** 128-bit collision resistance, 256-bit preimage resistance

**Status:** Widely adopted in ZK circuits; designed specifically for SNARK-friendly arithmetic circuits

**Risk assessment:** LOW — standard in circom ecosystem; thoroughly analyzed

---

### 4. Domain Separation

**Assumption:** Domain separator `"AEGIS_NULLIFIER_V2"` prevents cross-protocol replay attacks.

**Derivation:** `Poseidon([UTF-8-BE("AEGIS_NULLIFIER_V2")])` → field element

**Purpose:** Ensure nullifiers computed here are incompatible with other protocols, even when inputs match.

**Risk assessment:** LOW — standard practice; label chosen at random from available space

---

### 5. Randomness Generation

**Assumption:** `crypto.randomBytes()` in Node.js provides cryptographically secure randomness.

**Usage contexts:**
- Local development witness generation
- Proof generation scripts (non-production environments)

**Production warning:** For production proof generation, use hardware-backed RNG or OS-level `/dev/urandom`

**Risk assessment:** MEDIUM — adequate for development/testing; verify production RNG source

---

### 6. ECDSA Key Security

**Assumption:** ECDSA keys on secp256k1 (Ethereum) maintain 128-bit security.

**Implications:** Private key compromise = total system compromise

**Mitigations:**
- HSM/MPC-backed operator wallets recommended
- Multi-signature approval workflows
- Key rotation every 90 days

**Risk assessment:** LOW if implemented correctly; HIGH if weak key management practices used

---

### 7. Gas Limit Stability

**Assumption:** Ethereum gas prices and block limits remain within operational bounds.

**Impact:** Verification costs may vary significantly based on network conditions

**Monitoring recommendation:** Alert when gas > 100 gwei to budget appropriately

**Risk assessment:** LOW — economic rather than cryptographic risk

---

## Attack Vectors & Mitigations

| Vector | Impact | Probability | Mitigation |
|---|---|---|---|
| Trusted setup backdoor | Critical | Low | Beacon + multi-contribution + verification at each step |
| BN128 break | Catastrophic | Extremely low | Industry-standard curve; no practical attacks known |
| Poseidon collision | Medium | Negligible | 128-bit security margin |
| Private key theft | High | Medium | HSM/MPC, multi-sig, rotation policy |
| Replay attack | High | Medium | Nullifier set + chain ID binding + timestamp window |
| Front-running | Low | Medium | No state changes before verification commitment |

---

## Unknown Unknowns

**Acknowledged limitations:**
- Circuit source lost; structural equivalence only proven via artifact hashes
- No formal verification of Solidity contracts yet
- No time-bound replay protection beyond timestamp window

**Open research questions:**
- Long-term security of pairing-based ZK-SNARKs vs post-quantum alternatives
- Optimal domain separator derivation strategies for large-scale deployments

---

## Review Status

- [ ] Internal security team review (completed)
- [ ] External auditor review (pending authorization)
- [ ] Community feedback period (pending release)
- [ ] Formal verification (deferred to future phase)

---

## References

- Groth16 specification: [Groth16 2016](https://ia.cr/2016/260)
- BN128 parameters: EIP-196, EIP-197
- Poseidon hash: [Poseidon paper](https://ia.cr/2019/458)
- Trusted setup best practices: [PHANTOM ceremony guidelines](https://github.com/privacy-scaling-explorations/phoenix)
