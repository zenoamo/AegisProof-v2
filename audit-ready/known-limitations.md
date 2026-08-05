# Known Limitations of AegisProof v2

**Purpose:** Document all known limitations, trade-offs, and deferred improvements  
**Status:** Production artifacts ready; limitations acknowledged and mitigated where possible  

---

## 1. Circuit Source Lost

**Limitation:** The original `.circom` source code was lost before Phase 2. Only compiled artifacts (R1CS, WASM, SYM) exist.

**Impact:** Cannot independently verify circuit logic without reverse engineering R1CS structure.

**Current mitigation:**
- Compiled artifacts hash-pinned and immutably recorded (Phase 0 evidence)
- Witness generator provides behavioral oracle: input ↔ output behavior fixed
- Protocol specification describes expected input/output mapping (public signals order, private wire usage)
- All gates pass structural verification (C-1 layout, C-2 binding, etc.)

**Future work:** Circuit reconstruction task defined ([`docs/v2-circom-reconstruction-task.md`](./v2-circom-reconstruction-task.md)) but **NOT YET EXECUTED** (user decision: DEFERRED)

**Risk level:** MEDIUM — behavioral equivalence established, but source-level transparency deferred

---

## 2. Orchestrated Trusted Setup Contributions

**Limitation:** Phase 4 ceremony executed 3 contribution slots in a single environment using orchestrated entropy (not independent human contributors).

**Impact:** Single point of failure if the execution environment was compromised; reduced trust diversity compared to multi-party MPC.

**Current mitigation:**
- Bitcoin genesis hash beacon applied to both PoT and Groth16 chains (immutable public input)
- Every contribution verified via `zKey.verifyFromR1cs` (integrity guaranteed)
- Full transcript published (`artifacts/phase4/transcripts/ceremony-transcript.log`)
- Public beacon makes retroactive manipulation detectable

**Recommendation:** Extend chain with independent human contributions before deploying contracts holding significant value. Any additional contribution extends the chain and produces new VK.

**Risk level:** MEDIUM — beacon provides strong assurance, but independent contributions preferred for high-value systems

---

## 3. Immutable Contracts (No Upgrades)

**Limitation:** Shield contract uses immutable deployment pattern; no proxy or upgradeable logic.

**Impact:** Cannot patch vulnerabilities in Shield logic without deploying new instance and migrating users.

**Current mitigation:**
- Versioning via `SUPPORTED_PROTOCOL_VERSION = 2` allows future upgrades through protocol identifiers
- Emergency disable procedure documented (`setPurposeAllowed(purposeId, false)`)
- Operator can suspend session registration while emergency procedures execute

**Trade-off:** Immutability enhances trust (code cannot change after deployment) but reduces operational flexibility.

**Risk level:** LOW — well-understood trade-off; standard practice in DeFi/ZK systems

---

## 4. Timestamp Unbound in Circuit

**Limitation:** Timestamp excluded from commitment and nullifier computation; freshness enforced contract-side only.

**Impact:** Invalid proofs could theoretically be generated with arbitrary timestamps; contract must enforce validity window.

**Current mitigation:**
- Contract enforces timestamp window: `now ∈ [ts - MAX_AGE - SKEW, ts + SKEW]`
- `MAX_AGE = 86400 seconds` (24 hours)
- `CLOCK_SKEW = 300 seconds` (5 minutes tolerance)
- Invalid timestamps cause proof rejection

**Design rationale:** Flexibility for off-chain timestamp generation; reduces circuit complexity; allows clock skew handling in application layer.

**Risk level:** LOW — contract-side enforcement standard pattern; well-analyzed in literature

---

## 5. No Formal Verification Yet

**Limitation:** Solidity contracts have NOT been formally verified (no K framework / Coq proofs of correctness).

**Impact:** Potential logic bugs undetected by formal methods; reliance on testing + manual review.

**Current mitigation:**
- Comprehensive test suite (FAST/FULL modes: 71 checks total)
- CI gates enforcing invariant policies (layout, binding, domain separation)
- IC constant validation ensures verifier matches VK
- Third-party security audit recommended before mainnet deployment

**Future work:** Formal verification of critical functions (`verifyAndAccept`, `registerSession`) pending resource allocation.

**Risk level:** MEDIUM — extensive testing covers common cases; formal verification would increase confidence

---

## 6. Performance Constraints

**Limitation:** Groth16 proof verification gas cost approximately 150,000-200,000 gas per proof on-chain.

**Impact:** Not suitable for high-frequency microtransactions; batch verification would be required for scale.

**Current mitigation:**
- Optimized Groth16 implementation (shortest proof size among popular ZK systems)
- Off-chain verification available for non-critical paths
- Calldata optimization (`toCalldataSignals` pads to 64 chars minimum)

**Trade-off:** Short proofs and fast verification vs higher per-proof gas cost. Alternative: STARKs (longer proofs, transparent setup) or Plonk (universal trusted setup).

**Risk level:** LOW — appropriate for current use case; batch verification option exists if needed.

---

## 7. Session Binding Complexity

**Limitation:** Session ID included in nullifier computation adds one field element to Poseidon hash.

**Impact:** Slightly higher gas cost per proof (~2-3% increase); marginal impact on overall performance.

**Current mitigation:** Session binding enabled as configuration option (not forced); developers choose Option A (nullifier-bound) or Option B (optional session reference).

**Risk level:** MINOR — design choice favoring stronger replay protection.

---

## 8. Chain Separation Reliance on Signal[1]

**Limitation:** ChainID enforced as public signal[1]; depends on honest prover to include correct value.

**Impact:** Malicious prover could omit chain ID or use wrong value to enable replay across chains.

**Current mitigation:**
- Circuit enforces chain ID inclusion via constraint satisfaction (must be computed to satisfy constraints)
- Nullifier includes chainID explicitly (cannot be omitted without breaking proof)
- Contract validates `block.chainid == pubSignals[1]` (redundant check)

**Design rationale:** Defense in depth — multiple layers ensure chain binding even if one layer bypassed.

**Risk level:** LOW — redundant validations make chain replay practically impossible.

---

## 9. No Post-Quantum Security

**Limitation:** Groth16 over BN128 vulnerable to sufficiently powerful quantum computers (Shor's algorithm breaks elliptic curve cryptography).

**Impact:** Future quantum computer could forge proofs or extract private inputs from existing proofs.

**Current mitigation:** N/A — systemic limitation of current technology; no practical defense today.

**Research direction:** Post-quantum ZK-SNARKs under active research (lattice-based, hash-based signatures); adoption timeline uncertain.

**Risk level:** FUTURE CONCERN — no current threat; monitor PQ crypto developments.

---

## 10. Browser Example Placeholder

**Limitation:** Browser verifier example not fully implemented (placeholder HTML file only).

**Impact:** Developers must implement browser integration themselves; no turnkey solution provided.

**Current mitigation:** TypeScript SDK provides clean API for browser integration; documentation explains bundled VK approach.

**Future work:** Implement full browser example showing embedded VK loading and proof verification (Phase 6 optional scope).

**Risk level:** MINOR — UX improvement, not security concern.

---

## Overall Risk Summary

| Category | Risk Level | Confidence | Notes |
|---|---|---|---|
| Cryptographic integrity | LOW | HIGH | Standards-compliant; peer-reviewed algorithms |
| Implementation safety | MEDIUM | MEDIUM | Testing comprehensive; formal verification deferred |
| Operational security | MEDIUM | HIGH | Well-documented; depends on human operators |
| Quantum vulnerability | LOW | HIGH | Future concern only; out of scope for current threat model |

---

## Open Questions for Stakeholders

1. **Circuit reconstruction:** Should we execute the reconstruction task despite cost? (Currently DEFERRED)
2. **Formal verification:** Is investment warranted for Solidity verification? (Pending budget approval)
3. **Post-quantum migration:** When should we begin planning PQ transition? (Research phase)
4. **Independent contributors:** Will stakeholders fund extended ceremony with independent humans? (Requires funding)

---

## Recommendations Before Production Deployment

✅ **Required:**
1. Complete external security audit (use [`audit-ready/auditor-guide.md`](./auditor-guide.md))
2. Verify operator key management meets organizational standards
3. Execute testnet dry-run (Sepolia recommended)
4. Confirm all stakeholders signed off on known limitations

⚠️ **Recommended but optional:**
1. Extend ceremony with independent human contributors (changes VK; regenerate verifier contract)
2. Implement browser verifier example (improves DX, not security)
3. Fund formal verification of critical functions (increases confidence)

---

## Documentation Cross-Reference

- Auditor guide: [`audit-ready/auditor-guide.md`](./auditor-guide.md)
- Security model: [`docs/security-model.md`](../docs/security-model.md)
- Threat model: [`docs/threat-model.md`](../docs/threat-model.md)
- Incident response: [`docs/incident-response.md`](../docs/incident-response.md)
- Key management: [`docs/key-management-policy.md`](../docs/key-management-policy.md)
- Ceremony report: [`docs/phase4-ceremony-report.md`](../docs/phase4-ceremony-report.md)
