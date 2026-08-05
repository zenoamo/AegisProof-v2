# AegisProof FAQ

**Frequently Asked Questions about protocol v2, deployments, and operations.**

---

## Q: What is the difference between dev and production keys?

**A:** 
- **Dev keys**: Single-contribution setup using random entropy in this environment. Used for testing only; never promoted to production. Hash prefixes: `c80f004e...` (zkey), `6193351a...` (vkey).
- **Production keys**: Multi-contribution chain + Bitcoin genesis hash beacon, finalized under explicit human authorization. Production hash: `ce5a3d30...` (zkey), `d012bd29...` (vkey).

Never use dev verifier contracts with production proofs or vice versa.

---

## Q: Why wasn't the circuit source recovered?

**A:** The v2 `.circom` source was lost before Phase 2. The compiled artifacts (r1cs/sym/wasm) are canonical ground truth. Reconstruction is a deferred task defined in [`docs/v2-circom-reconstruction-task.md`](./v2-circom-reconstruction-task.md); no execution has been performed.

---

## Q: Is timestamp binding enforced in the circuit?

**A:** No. Timestamps are deliberately unconstrained ("untrusted metadata"). Freshness is enforced contract-side via the timestamp window: `now ∈ [ts - MAX_AGE - SKEW, ts + SKEW]`. This design allows flexibility while maintaining security through off-chain validation.

---

## Q: Can I upgrade my deployed Shield contract?

**A:** No. Phase 5 uses an **immutable deployment model**. There are no proxy patterns or upgradeable contracts. New features require deploying a new Shield instance with updated logic and migrating users to a newer protocol version.

---

## Q: What happens if my public signals are tampered post-prove?

**A:** Groth16 IC binding ensures that any tampering of public signals breaks verification. The linear combination check fails immediately; the proof cannot be accepted by the verifier contract.

---

## Q: Do I need to regenerate the trusted setup?

**A:** Not yet. The Phase 4 ceremony produced valid artifacts. However, independent human contributions extending the chain are **recommended** before mainnet-grade deployments holding significant value. This would produce a new VK and require regenerating the verifier contract.

---

## Q: How do I verify the production verifier contract matches the VK?

**A:** Run `node scripts/phase4_verify_production.mjs`. It checks that all 31 IC constants embedded in the Solidity contract match the production vkey exactly. Expected output includes: `PASS contract IC constants == production vkey IC (31/31)`.

---

## Q: What if someone gains access to my operator key?

**A:** Follow Severity 1 incident response procedures immediately:
1. Notify stakeholders and suspend session registration if needed.
2. Rotate operator key and update contract via emergency procedure.
3. Document all actions taken and post-mortem within 24 hours.
See [`incident-response.md`](./incident-response.md) and [`key-management-policy.md`](./key-management-policy.md).

---

## Q: Can I use this for production deployments today?

**A:** You may deploy to testnets (Sepolia recommended first). Mainnet deployment requires additional stakeholder review and authorization. No public chain deployments have been performed from this repository.

---

## Q: Where can I find the full list of 30 signal names?

**A:** In the SSoT JSON at [`specs/aegis-protocol.v2.json`](../specs/aegis-protocol.v2.json). Signal indices 0–29 correspond to wire numbers 1–30 in the circuit's .sym file. The SDK uses these names for typed mappings.
