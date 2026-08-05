# AegisProof External Audit Readiness Guide

**Purpose:** Step-by-step guide for independent security auditors reviewing AegisProof v2  
**Status:** Production-ready artifacts; no deployments performed  
**Audit scope:** Protocol specification, cryptographic assumptions, implementation verification  

---

## Auditor Onboarding (Step 1-5)

### Step 1: Repository Access

Clone the repository:
```bash
git clone https://github.com/aegisproof/aegis-proof.git
cd aegis-proof
git checkout <commit-hash>  # Use final commit hash from release
```

**Expected state:** Working tree clean at commit `3e9b6d6` (Phase 5 final)

### Step 2: Artifact Verification

Run manifest verification:
```bash
node scripts/verify_manifest.mjs
```

**Expected output:** `MANIFEST VERIFICATION: PASS` (28/28 checks)

Verify Phase 4 hashes manually:
- production.zkey: `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571`
- production-vkey.json: `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`

### Step 3: Protocol Specification Review

Read:
1. [`specs/aegis-protocol.v2.json`](../specs/aegis-protocol.v2.json) — SSoT (single source of truth)
2. [`docs/architecture.md`](../docs/architecture.md) — High-level system design
3. [`docs/security-model.md`](../docs/security-model.md) — Security assumptions and guarantees

### Step 4: Critical Path Testing

Follow the end-to-end flow:
1. Generate input vector (`artifacts/phase2/tests/input_v2.json`)
2. Generate witness using WASM generator
3. Produce proof using production zkey (`artifacts/phase4/final/production.zkey`)
4. Verify off-chain using production VK
5. Deploy verifier contract locally
6. Submit proof to on-chain verifier

All steps must pass successfully.

### Step 5: Report Submission Template

Use this structure for audit findings:

```markdown
## Finding Title

**Severity:** Critical / Moderate / Low

**Location:** [file path line numbers]

**Description:** Detailed explanation

**Evidence:** Reproducible steps or test case

**Recommendation:** Suggested remediation (if applicable)

**References:** Related protocol sections
```

---

## Security Review Checklist

Complete each item below during audit:

### Cryptographic Integrity
- [ ] IC constants match production VK (all 31 points)
- [ ] All IC points lie on BN128 curve
- [ ] Groth16 proof structure valid (pi_a/pi_b/pi_c shapes correct)
- [ ] Poseidon commitment function correctly implemented over 6 elements
- [ ] Poseidon nullifier function correctly implemented over 8 elements
- [ ] Domain separator `"AEGIS_NULLIFIER_V2"` derived correctly from UTF-8 label

### Protocol Semantics
- [ ] Public signal order matches SSoT (indices 0-29 = wires 1-30)
- [ ] Timestamp excluded from commitment/nullifier computation
- [ ] ChainId included in nullifier domain calculation
- [ ] Session ID included in nullifier computation (Option A binding)
- [ ] Commitment includes device ID but excludes timestamp
- [ ] Nullifier includes all binding signals (timestamp excluded)

### Implementation Safety
- [ ] No hardcoded secrets in codebase
- [ ] No use of weak random number generators
- [ ] Gas costs within reasonable bounds
- [ ] Revert reasons informative for debuggability
- [ ] Event logging complete for operator actions

### Replay Resistance
- [ ] Used-nullifier set prevents replay attacks
- [ ] Timestamp window enforced contract-side
- [ ] ChainID binding prevents cross-chain replay
- [ ] Session binding limits scope of reused proofs

### Operational Security
- [ ] Operator address configurable at deploy time
- [ ] Emergency disable procedure documented
- [ ] Key rotation policy specified
- [ ] Multi-sig support recommended for operator wallet

---

## Known Limitations Document

See [`audit-ready/known-limitations.md`](./known-limitations.md) for complete list.

Summary:
- Circuit source lost; artifacts are canonical ground truth
- Trusted setup executed in single environment (orchestrated contributions)
- Independent human contribution recommended before mainnet-grade value
- Timestamp unbound in circuit; freshness enforced contract-side
- Immutable contracts (no upgrades); versioning via protocol identifiers

---

## Communication Protocol

During audit:
1. **Critical findings:** Contact immediately via Slack/email
2. **Moderate findings:** Document in Jira ticket within 24 hours
3. **Low findings:** Queue for backlog review

**Emergency contact:** [REDACTED FOR SECURITY]

---

## Deliverables Timeline

| Milestone | Target Date | Status |
|---|---|---|
| Initial audit kickoff | T+0 days | Pending authorization |
| Cryptographic review | T+5 days | Pending |
| Code review | T+7 days | Pending |
| Protocol review | T+7 days | Pending |
| Final report | T+10 days | Pending |

**Note:** Actual timeline depends on auditor availability and finding complexity.
