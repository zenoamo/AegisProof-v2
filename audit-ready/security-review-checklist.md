# Security Review Checklist for AegisProof v2

**Purpose:** Comprehensive checklist for security reviewers during external audits  
**Version:** v2 (frozen)  
**Scope:** All cryptographic, protocol, and implementation-level security considerations  

---

## Executive Summary

This checklist covers all security-critical components of AegisProof v2. Each item should be verified independently during the security review. Total items: 65 across 7 categories.

**Status:** Internal team review completed. External audit pending.

---

## Category 1: Cryptographic Primitives (10 items)

### BN128 Curve Configuration

- [ ] **curve-BN128-params**: G1, G2, GT parameters match EIP-196/EIP-197 specifications
- [ ] **curve-pairing-check**: Pairing verification uses correct formula e(A,B) = e'(A',B')
- [ ] **curve-on-curve-points**: All public points lie on correct elliptic curve (not twisted curve)
- [ ] **curve-infinity-handling**: Point at infinity handled correctly in all operations
- [ ] **curve-subgroup-validation**: Points validated against prime-order subgroup (no small-order attacks)

### Groth16 Implementation

- [ ] **proof-format-valid**: Proof structure (pi_a, pi_b, pi_c) matches specification (BN128 field elements)
- [ ] **verification-key-integrity**: VK contains exactly 31 IC points (vk_alpha_1 + 30 public signals)
- [ ] **linear-combination-count**: IC array size equals nPublic + 1 (30 + vk_alpha_1 = 31)
- [ ] **pairing-check-order**: Two pairing checks executed in correct order (pA,pC then pB,pAlpha)
- [ ] **groth16-soundness-assumptions**: qAPR/QSP assumptions documented and acceptable

### Poseidon Hash Function

- [ ] **poseidon-round-numbers**: Correct number of rounds for security level (n=14 rounds for 128-bit)
- [ ] **poseidon-s-box-correct**: Inverse S-box implemented as x^7 over GF(p)
- [ ] **poseidon-domain-separator**: Domain label "AEGIS_NULLIFIER_V2" derives consistent field element
- [ ] **poseidon-input-lengths**: Commitment takes exactly 6 inputs; nullifier takes exactly 8 inputs
- [ ] **poseidon-output-range**: Output fits within BN128 scalar field (mod p)

---

## Category 2: Protocol Semantics (12 items)

### Signal Layout & Ordering

- [ ] **ssot-signals-30**: Exactly 30 public signals defined in SSoT JSON file
- [ ] **signal-order-wires**: Wires 1-30 in .sym file map to signals[0-29] in proof
- [ ] **signal-contiguous-indices**: Signals use contiguous indices 0 through 29 (no gaps)
- [ ] **sym-vs-r1cs-npublic**: r1cs.nPubInputs equals 30 (matches SSoT)
- [ ] **witness-measured-public**: Witness generation outputs exactly 30 public values

### Private Inputs

- [ ] **private-wires-exist**: Wires 31 and 32 exist for private inputs (secretKey, deviceId)
- [ ] **private-not-leaked**: Private wire values do not appear in public signals array
- [ ] **input-flip-layout**: Circuit uses input-flip pattern (commitment/nullifier computed as outputs)

### Binding Guarantees

- [ ] **timestamp-excluded-commitment**: Timestamp signal NOT included in commitment computation
- [ ] **timestamp-excluded-nullifier**: Timestamp signal NOT included in nullifier computation
- [ ] **chainid-bound-in-nullifier**: ChainID signal included in nullifier domain calculation
- [ ] **session-id-bound**: Session ID included in nullifier computation (Option A binding)
- [ ] **deviceld-bound**: Device ID appears in commitment computation (uniqueness guarantee)
- [ ] **poseidon-6-elements**: Commitment = Poseidon([domain, timestamp, chainId, sessionId, purposeId, deviceId])
- [ ] **poseidon-8-elements**: Nullifier = Poseidon([domain, chainId, sessionId, commitment, purposeId, deviceId, timestamp?, extra?])

*Note: Verify exact 8-element composition matches SSoT definition*

---

## Category 3: Replay Resistance (10 items)

### Nullifier-Based Protection

- [ ] **nullifier-uniqueness**: Same secretKey/deviceId pair produces unique nullifier per session
- [ ] **nullifier-verifies-only-once**: Contract stores used nullifiers and rejects duplicates
- [ ] **nullifier-chain-binding**: Nullifier includes chainID preventing cross-chain replay
- [ ] **nullifier-session-binding**: Nullifier includes sessionId limiting scope to single session
- [ ] **nullifier-timestamp-free**: Timestamp excluded from nullifier (allows flexibility)

### Timestamp Window Enforcement

- [ ] **max-age-enforced**: Contract enforces `now <= timestamp + MAX_AGE` (86400 seconds)
- [ ] **clock-skew-tolerance**: Contract allows ±300 second clock skew (CLOCK_SKEW constant)
- [ ] **timestamp-unbounded-circuit**: Circuit does NOT constrain timestamp value (must check contract-side)
- [ ] **timestamp-type-correct**: Timestamp stored as uint256 (supports Unix epoch format)
- [ ] **future-proof-timestamps**: No overflow risk for timestamps up to year 2286 (uint256 limit)

### Cross-Chain Protection

- [ ] **chainid-signal-mandatory**: circuit constraint requires chainId to be computed (cannot omit)
- [ ] **block-chainid-equals-signal[1]**: Contract verifies `block.chainid == pubSignals[1]`
- [ ] **cross-chain-replay-impossible**: Different chainIDs produce different nullifiers even with identical inputs
- [ ] **bridge-safe-assumption**: Bridge protocols can safely validate chain-specific proofs

---

## Category 4: Smart Contract Security (10 items)

### Verifier Contract (`Groth16VerifierV2Production.sol`)

- [ ] **stateless-contract**: Verifier has no storage (pure verification function)
- [ ] **immutable-bytecode**: IC constants baked into bytecode during generation (not configurable)
- [ ] **view-function-only**: verifyProof is read-only (does not modify state)
- [ ] **gas-bounds-reasonable**: Estimated gas ≤ 200,000 per verification call
- [ ] **revert-messages-clear**: Error messages distinguish proof validity vs signature errors

### Shield Contract (`AegisShieldV2.sol`)

- [ ] **constructor-parameters-valid**: Verifier address and operator address cannot be zero
- [ ] **protocol-version-hardcoded**: SUPPORTED_PROTOCOL_VERSION = 2 (immutable after deploy)
- [ ] **used-nullifiers-mapping**: Mapping prevents duplicate nullifier acceptance
- [ ] **session-tracking-active**: Sessions tracked with validFrom/validUntil timestamps
- [ ] **operator-access-control**: Only operator can call registerSession() / deactivateSession()
- [ ] **purpose-allowed-flag**: SetPurposeAllowed toggles boolean flag controlling acceptance policy
- [ ] **emergency-disable-pathway**: setPurposeAllowed(purposeId, false) disables specific purpose immediately
- [ ] **deactivate-session-thorough**: Deactivation removes session from both session mapping and used-nullifier set
- [ ] **timestamp-window-checked**: verifyAndAccept validates timestamp window before processing
- [ ] **no-reentrancy-guards**: State changes occur before external calls (prevents reentrancy)

---

## Category 5: Operational Security (10 items)

### Key Management

- [ ] **operator-key-hsm-recommended**: Documentation explicitly recommends HSM/MPC-backed keys
- [ ] **key-rotation-policy**: Documented rotation schedule (every 90 days or sooner)
- [ ] **no-hardcoded-secrets**: Repository contains NO embedded private keys or seed phrases
- [ ] **multi-sig-recommended**: Documentation recommends multi-signature wallets for operators
- [ ] **backup-procedure-documented**: Key backup procedures described in key-management-policy.md

### Incident Response

- [ ] **severity-taxonomy-defined**: Severity levels (1/Critical, 2/Moderate, 3/Low) clearly defined
- [ ] **communication-template-available**: Emergency advisory template provided
- [ ] **emergency-disable-procedure**: Step-by-step disable procedure documented
- [ ] **post-mortem-required**: Post-incident review mandate established
- [ ] **contact-information-placeholder**: Template includes contact fields for stakeholder completion

### Monitoring & Alerting

- [ ] **failure-rate-alerting**: Alert if verification rejection rate exceeds threshold (e.g., >5%)
- [ ] **duplicate-nullifier-detection**: Log every duplicate nullifier submission attempt
- [ ] **anomaly-patterns**: Pattern detection for unusual submission frequencies
- [ ] **gas-price-monitoring**: Alert when gas prices exceed budget threshold (e.g., 100 gwei)
- [ ] **operator-action-logging**: Every operator action logged with actor identity and timestamp

---

## Category 6: Development Process (7 items)

### Code Quality

- [ ] **solidity-linting-passes**: Solhint/Solhint rules applied consistently
- [ ] **gas-optimizations-reasonable**: No obvious gas optimization opportunities left unaddressed
- [ ] **event-logging-complete**: Critical actions emit events (SessionRegistered, SessionDeactivated, PurposeToggled)
- [ ] **comments-document-logic**: Complex logic explained in code comments
- [ ] **naming-conventions-consistent**: Variable/function names follow Solidity style guide

### Testing

- [ ] **fast-mode-tests-run**: FAST mode executes 30 checks without trusted setup dependency
- [ ] **full-mode-tests-run**: FULL mode executes 41 checks including dev setup regeneration
- [ ] **negative-tests-present**: Tests for tampered inputs, wrong chain IDs, expired timestamps
- [ ] **integration-tests-cover-flow**: End-to-end flow tested (input → witness → prove → verify)
- [ ] **gas-limit-tests-added**: Tests verify gas costs stay within expected bounds

### CI/CD Gates

- [ ] **manifest-verification-ci**: `verify_manifest.mjs` runs on every PR
- [ ] **gates-ci-enabled**: All 5 gates run on every push
- [ ] **codegen-determinism-checked**: Signal generation produces deterministic output
- [ ] **artifact-hash-pinned**: Phase 0 hashes recorded immutably in manifest
- [ ] **phase5-readiness-job**: SDK build and docs consistency checked automatically

---

## Category 7: Documentation (6 items)

### Completeness

- [ ] **architecture-doc-updated**: Architecture overview includes deployment topology diagrams
- [ ] **getting-started-working-example**: Tutorial produces first working verification locally
- [ ] **deployment-docs-complete**: Local/sepolia/mainnet dry-run instructions all present
- [ ] **api-documentation-generated**: SDK API reference available (typedoc or similar)
- [ ] **faq-addresses-common-questions**: FAQ section covers 10+ frequent questions

### Accuracy

- [ ] **hash-values-current**: All documentation SHA-256 hashes match actual artifacts
- [ ] **command-examples-tested**: All example commands verified working (or marked as placeholder)
- [ ] **security-model-consistent**: Security claims match actual implementation details
- [ ] **threat-model-complete**: Threat model covers all identified attack vectors

### Accessibility

- [ ] **searchable-documentation**: Search functionality available (if hosted)
- [ ] **cross-references-work**: All internal links resolve correctly
- [ ] **external-links-valid**: Links to standards/specifications are current
- [ ] **multilingual-support-planned**: Internationalization roadmap documented (optional)

---

## Sign-Off Section

| Reviewer | Role | Date | Overall Assessment | Signature |
|---|---|---|---|---|
| [Name] | Lead Auditor | ________ | □ Pass □ Conditional □ Fail | __________ |
| [Name] | Cryptographic Reviewer | ________ | □ Pass □ Conditional □ Fail | __________ |
| [Name] | Smart Contract Reviewer | ________ | □ Pass □ Conditional □ Fail | __________ |
| [Name] | Operations Reviewer | ________ | □ Pass □ Conditional □ Fail | __________ |

**Condition codes:**
- ✅ Pass: All items verified satisfactory
- ⚠️ Conditional: Minor findings requiring remediation before production approval
- ❌ Fail: Critical findings blocking any deployment consideration

---

## Findings Tracking Template

```markdown
## Finding #[NUMBER]: [Title]

**Severity:** Critical / Moderate / Low  
**Category:** [Corresponds to category above]  
**Location:** [file path:line numbers]  
**Description:** Detailed explanation of issue  
**Evidence:** Reproducible test case or observation  
**Impact:** What could go wrong if unaddressed?  
**Recommendation:** Suggested remediation approach  
**Status:** Open / In Progress / Resolved / Accepted-as-risk  
```

---

## Review Completion Checklist

- [ ] All 65 checklist items reviewed
- [ ] All critical findings resolved or accepted-as-risk
- [ ] All conditional findings have owners and deadlines
- [ ] Sign-off forms completed by all reviewers
- [ ] Final audit report compiled and distributed
- [ ] Remediation plan created for any outstanding issues

---

## References

- This checklist integrates with:
  - [`audit-ready/auditor-guide.md`](./auditor-guide.md) — Auditor onboarding procedures
  - [`audit-ready/cryptographic-assumptions.md`](./cryptographic-assumptions.md) — Underlying assumptions
  - [`audit-ready/known-limitations.md`](./known-limitations.md) — Acknowledged limitations
  - [`docs/security-model.md`](../docs/security-model.md) — High-level security architecture
  - [`docs/threat-model.md`](../docs/threat-model.md) — Threat analysis document
