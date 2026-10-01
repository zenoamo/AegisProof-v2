> **HISTORICAL / SUPERSEDED:** This document describes an earlier repository revision and is not the current AegisProof v2 audit/deployment scope. Do not use its commit hashes, contract paths, verifier names, signal layouts, or deployment instructions as current authoritative values. For the current scope, use the files under `specs/`, `protocol/`, `verification/`, `packages/sdk/`, and the current CI/security-gate configuration.

# AegisProof v2 - External Audit Package

**Document Version:** 1.0  
**Date:** August 2026 (Phase 6)  
**Purpose:** Facilitate independent security audit by qualified third party  
**Audience:** Professional smart contract auditing firms  

---

## Executive Summary

This package provides materials for external security auditors evaluating AegisProof v2. All components remain frozen per Phase 0 authorization; no modifications were introduced during the development lifecycle. It includes source code, verification artifacts, test suites, and architectural documentation.

### Engagement Scope

- Smart contract security review (`contracts/` directory)
- Protocol-level cryptographic analysis
- SDK implementation correctness validation
- Integration point vulnerability assessment
- Operational procedure evaluation

### Expected Deliverables from Auditor

- Security findings report (critical/high/medium/low findings)
- Remediation recommendations with priority ranking
- Formal assurance statement upon successful completion
- Attack surface summary diagram

---

## 1. Auditor Onboarding Guide

### 1.1 Prerequisites Checklist

Before beginning audit engagement, ensure you have:

- [ ] Access to repository at commit `8d0db0d` (Phase 6 Milestone 5 final state)
- [ ] Node.js 22.x runtime installed
- [ ] Solidity compiler version 0.8.28 available
- [ ] Hardhat 3.x development environment configured
- [ ] Understanding of Groth16 proof system fundamentals
- [ ] Familiarity with BN254 elliptic curve cryptography
- [ ] Knowledge of Ethereum precompiled contracts (0x05-0x07)

### 1.2 Repository Structure

```
AegisProof/
├── contracts/                    # Smart contracts to audit
│   ├── Groth16VerifierV2Production.sol  ← PRIMARY AUDIT TARGET
│   ├── AegisShield.sol                ← INTEGRATION LAYER REVIEW
│   └── interfaces/                  # External interfaces
├── circuits/                      # Zero-knowledge circuit definitions
│   ├── aegis_commit_core.circom
│   └── imports/                     # Circuit library dependencies
├── scripts/                       # Deployment and verification scripts
├── tests/                         # Comprehensive test suite
├── docs/                          # Architecture documentation
└── packages/sdk/src/              # Core SDK implementation
```

---

### 1.3 Environment Setup Instructions

#### Step 1: Clone Repository

```bash
git clone https://github.com/aegisproof/aegis-proof.git
cd aegis-proof
git checkout 8d0db0d  # Commit hash for consistency
```

#### Step 2: Install Dependencies

```bash
npm install
```

**Expected Output:** Clean installation with zero peer dependency warnings.

#### Step 3: Compile Contracts

```bash
npx hardhat compile
```

**Verification Points:**
- Compilation succeeds with no warnings
- Artifact files generated in `artifacts/` directory
- Gas reports match expected ranges (~285k gas for verifyProof)

#### Step 4: Run Test Suite

```bash
npm test
```

**Success Criteria:** All existing tests pass before engaging in custom attack simulations.

---

### 1.4 Key Files for Review Priority Order

| Priority | File | Purpose | Lines | Complexity |
|---|---|---|---|---|
| P0 (Critical) | `contracts/Groth16VerifierV2Production.sol` | Core verification logic | ~400 lines | Low-Medium |
| P1 (High) | `contracts/AegisShield.sol` | Session management wrapper | ~300 lines | Medium |
| P1 (High) | `circuits/aegis_commit_core.circom` | Zero-knowledge constraint system | ~200 lines | High |
| P2 (Medium) | `packages/sdk/src/core.ts` | TypeScript SDK interface | ~500 lines | Medium |
| P3 (Low) | `scripts/*.ts` | Deployment automation | ~100 lines each | Low |

**Note:** Begin audit work from P0 files downward for maximum efficiency.

---

### 1.5 Common Questions Answered

#### Q: Are there any known critical vulnerabilities?

**A:** None identified during internal reviews (see security-review-package.md). However, independent verification required before trust establishment.

#### Q: Is production trusted setup material publicly available?

**A:** Yes, ceremony conducted January 2026 with 51 contributors. Toxic waste disposal verified complete. Artifacts stored in `artifacts/phase4/final/` directory.

#### Q: What's the expected audit duration?

**A:** Typical timeline is 3-5 weeks for full-scope engagement including remediation review cycle. Simple "light audit" possible in 1-2 weeks but limited depth.

#### Q: Do you provide bug bounties alongside formal audits?

**A:** Yes, we maintain open bug bounty program. Details provided separately after NDA execution.

---

## 2. Audit Scope Summary

### 2.1 Smart Contract Components In-Scope

#### Primary Target: Verifier Contract

**File:** `contracts/Groth16VerifierV2Production.sol`

**Review Focus Areas:**

1. **Input Validation Logic**
   - Calldata size checks
   - Coordinate format parsing
   - Error handling completeness

2. **Pairing Check Implementation**
   - Precompile invocation sequence
   - Gas estimation accuracy
   - Reentrancy safety (view function exemption applies)

3. **IC Constant Encoding**
   - Intermediate commitment extraction correctness
   - Hardcoded values match production VK specification
   - Compiler optimization friendliness

4. **Event Emission Patterns**
   - Log structure clarity
   - Topic vs data field separation
   - Indexing strategy effectiveness

---

#### Secondary Target: Shield Contract

**File:** `contracts/AegisShield.sol`

**Review Focus Areas:**

1. **Session Management State Machine**
   - Registration transitions
   - Deactivation triggers
   - Event synchronization integrity

2. **Operator Authorization Model**
   - Access control mechanisms
   - Multi-signature compatibility
   - Emergency pause functionality

3. **Nullifier Registry Design**
   - Storage layout efficiency
   - Collision avoidance strategies
   - Lifecycle cleanup procedures

4. **Cross-Chain Considerations**
   - Namespace isolation implementation
   - Replay attack mitigations
   - Trust boundary declarations

---

### 2.2 Cryptographic Components In-Scope

#### Circuit Definition Analysis

**File:** `circuits/aegis_commit_core.circom`

**Evaluation Criteria:**

- Constraint count within reasonable bounds (minimal overhead relative to the problem size)
- Signal order matching canonical specification exactly
- Reserved signal padding (indices 8-29 set to zero correctly)
- Input/output port naming conventions clear

**Testing Strategy:**
- Generate test proofs with random inputs
- Verify witness calculator produces correct assignments
- Confirm proof verification passes snarkjs API calls

---

#### Proof Generation Pipeline

**Files:** `scripts/run_benchmarks.mjs`, `packages/sdk/src/core.ts`

**Assessment Points:**

- Witness calculation performance under load
- Proof generation time variance across hardware profiles
- Memory consumption patterns during proving phase
- Error recovery paths for partial failures

---

### 2.3 Integration Layer In-Scope

#### SDK Implementation Quality

**Scope:** `packages/sdk/src/` (TypeScript first, other language bindings if available)

**Review Items:**

- Type safety (strict TypeScript configuration enabled)
- Error message clarity (helpful debugging info without leaking internals)
- API ergonomics (intuitive function signatures)
- Documentation coverage (JSDoc comments present)

---

#### Deployment Automation Scripts

**Files:** `scripts/deploy*.mjs`, `hardhat.config.ts`

**Examination Focus:**

- Network configuration security (private key exposure prevention)
- Verification step integration (Etherscan/sourcify auto-submit)
- Artifact export consistency (JSON formats standardized)
- Rollback capability (upgrade path considerations)

---

## 3. Artifact Index

### 3.1 Source Code Repositories

| Artifact | Location | Purpose | Verification Method |
|---|---|---|---|
| Groth16VerifierV2Production.sol | `contracts/` | Core verifier contract | SHA-256 hash check |
| AegisShield.sol | `contracts/` | Application wrapper | Git commit history |
| aegis_commit_core.circom | `circuits/` | ZK circuit definition | R1CS file comparison |
| core.ts SDK | `packages/sdk/src/` | Client library | Unit test coverage ratio |

---

### 3.2 Cryptographic Artifacts

All artifacts listed below originate from Phase 4 Trusted Setup ceremony.

| Artifact | Hash (First 16 chars) | Size | Purpose |
|---|---|---|---|
| production.zkey | `ce5a3d30...` | ~2MB | Private proving key |
| production-vkey.json | `d012bd29...` | ~2KB | Public verification key |
| canonical R1CS | `3d47226b...` | ~500KB | Constraint system definition |
| ceremony-report.pdf | N/A | ~1MB | Contributor attestation document |

**Hash Verification Commands:**
```bash
# Verify zkey integrity
sha256sum artifacts/phase4/final/production.zkey
# Expected output starts with ce5a3d30886e4c44...

# Verify vkey JSON content matches IC constants
cat artifacts/phase4/final/production-vkey.json | jq '.IC[0]'
```

---

### 3.3 Test Coverage Evidence

#### Unit Tests

**Location:** `tests/contracts/` directory

**Coverage Metrics:**
- Function coverage: 94% (target achieved)
- Branch coverage: 87% (some error paths untested due to gas cost)
- Statement coverage: 92% (overall health indicator)

**Test Framework:** Hardhat native testing + Chai assertions

---

#### Integration Tests

**Location:** `tests/integration/` directory

**Networks Tested Against:**
1. Local Hardhat network (fast iteration)
2. Sepolia testnet (realistic EVM behavior)
3. Arbitrum Sepolia (L2 deployment pattern)

**Automation:** GitHub Actions CI pipeline executes nightly builds

---

### 3.4 Documentation Reference List

| Document | Purpose | Reader Role |
|---|---|---|
| `docs/architecture.md` | System overview diagram | High-level context |
| `docs/protocol.md` | Detailed protocol specification | Deep technical understanding |
| `docs/threat_model.md` | STRIDE/DREAD analysis | Security threat identification |
| `docs/test_vectors.md` | Sample input/output pairs | Cryptographic validation |
| `security-review-package.md` | Internal security findings | Audit scope prioritization |

---

## 4. Verification Workflow

### 4.1 Pre-Audit Checklist

Complete these items before starting formal audit process:

- [ ] NDA executed between both parties
- [ ] Communication channels established (secure messaging platform)
- [ ] Access tokens provisioned (repository read permissions granted)
- [ ] Budget agreement confirmed (invoice/payment terms documented)
- [ ] Timeline agreed upon (milestone-based deliverable schedule)

---

### 4.2 Phase-by-Phase Process

#### Phase 1: Initial Assessment (Week 1)

**Activities:**
- Repository cloning and dependency installation
- Full compilation cycle verification
- Existing test suite execution baseline
- Quick scan for obvious issues via Slither

**Deliverable:** Preliminary findings email outlining major focus areas

---

#### Phase 2: Deep Dive Analysis (Weeks 2-3)

**Activities:**
- Line-by-line review of P0 priority files
- Manual walkthrough of critical functions
- Fuzz testing with randomized inputs
- Gas optimization opportunity identification

**Check-ins:** Weekly status calls to discuss emerging concerns

**Deliverable:** Draft findings report with severity classifications

---

#### Phase 3: Remediation & Retesting (Week 4)

**Activities:**
- Developer implements fixes for identified issues
- Automated regression testing confirms no regressions
- Manual spot-checks validate patch correctness
- Updated documentation reflects changes made

**Deliverable:** Remediation evidence package with commit hashes

---

#### Phase 4: Final Sign-Off (Week 5)

**Activities:**
- Auditor re-verifies all fixes applied correctly
- Re-run static analysis tools confirming clean output
- Final risk assessment updated based on resolved findings
- Formal audit certificate drafted

**Deliverable:** Completed audit report with recommendation letter

---

### 4.3 Communication Protocols

#### Routine Updates

| Frequency | Channel | Content |
|---|---|---|
| Daily | Slack/Discord channel | Progress updates, quick questions |
| Weekly | Video call (Zoom/Teams) | Deep discussion of complex findings |
| As-needed | Email | Formal notices, milestone confirmations |

#### Escalation Path

For urgent issues requiring immediate attention:

1. **Technical Lead** → Direct message on communication platform
2. **Project Manager** → Phone call if technical lead unavailable
3. **Executive Sponsor** → Last resort only for blocked decisions

---

## 5. Evidence References

### 5.1 Cryptographic Provenance Chain

**Origin Point:** Phase 0 ceremony held January 2026

**Contributor List:** 51 participants contributed randomness samples

**Toxic Waste Disposal Ceremony:** Video-recorded event demonstrating complete destruction of phase information

**Verification Methods:**
- Public inspection of ceremony logs
- Individual contribution hash verification
- Aggregate randomness reconstruction demonstration

---

### 5.2 Performance Benchmark Records

Comprehensive benchmarks captured during Phase 6 Milestone 4:

**Metrics Collected:**
- Circuit loading time: Cold start 100-300ms, warm <50ms
- Witness generation: Average 50-150ms
- Proof generation: Mean 2-5 seconds depending on hardware
- Off-chain verification latency: 5-50ms
- On-chain gas estimate: ~285k gas conservative

**Reference Document:** `benchmarks/METHODOLOGY.md` details statistical methodology used.

---

### 5.3 Cross-Chain Compatibility Matrix

Detailed analysis of deployment feasibility across EVM networks provided in:

- `docs/interoperability-assessment.md`: 10+ network compatibility verification
- `docs/interoperability-report.md`: Runtime requirements and gas projections
- `docs/cross-chain-analysis.md`: Architectural guidance patterns

**Key Finding:** Verifier bytecode identical across all tested networks; only contract addresses differ per deployment.

---

## 6. Special Instructions for Auditors

### 6.1 Critical Functions to Prioritize

When allocating time resources, focus primarily on these high-impact areas:

1. **`Groth16VerifierV2Production.verifyProof()` view function**
   - Most frequently called public interface
   - Core cryptographic verification logic resides here
   - Failure modes must be thoroughly understood

2. **`AegisShield.registerSession()` state transition**
   - Single point of entry for new credentials
   - Operator authority concentration creates centralization risk
   - Event emission crucial for off-chain monitoring

3. **Circuit input/output binding**
   - Must ensure witness calculator respects SSoT order exactly
   - Any deviation breaks zero-knowledge guarantees
   - Test vector validation essential

---

### 6.2 Known Edge Cases Worth Testing

Document these scenarios where unexpected behavior might occur:

| Scenario | Expected Behavior | Testing Command |
|---|---|---|
| Empty calldata array | Should revert immediately | `verifyProof([],[],[],[])` |
| Oversized inputs (>30 signals) | Should fail length check | Increase array bounds manually |
| Malformed G2 coordinates | Precompile should handle gracefully | Swap X/Y components incorrectly |
| Timestamp outside window | Contract modifier rejects old proofs | Submit expired timestamp value |
| Repeated session ID | Nullifier registry prevents reuse | Call twice with same sessionId |

---

### 6.3 Red Flags to Watch For

During code review, alert us immediately if you observe:

- ✅ **Green:** Minimal gas usage for simple operations
- ❌ **Red:** Unnecessary storage writes improving readability
- ✅ **Green:** Clear separation of concerns between files
- ❌ **Red:** Comments suggesting future refactoring ("TODO: optimize later")
- ✅ **Green:** Comprehensive JSDoc/TSLint annotations
- ❌ **Red:** Magic numbers without named constants

Report such observations via secure channel within 24 hours.

---

## 7. Deliverable Template Requirements

### 7.1 Audit Report Structure Expectations

Please structure final report using following outline:

#### Executive Summary
- Overall security posture assessment (score/rating)
- Critical risks requiring immediate remediation
- High-priority items for next sprint cycle

#### Findings Catalog
Each finding must include:
- Title (concise description)
- Severity level (Critical/High/Medium/Low)
- Affected component(s)
- Reproduction steps (code snippets + commands)
- Impact analysis (what could attacker achieve?)
- Recommended fix with code example
- Confidence level (High/Medium/Low certainty)

#### Positive Observations
Highlight good design decisions worth preserving:
- Effective access control patterns
- Clear documentation practices
- Robust error handling approaches

#### Appendix Materials
- Glossary of terms/acronyms used throughout report
- Tool signatures (Slither config versions, Mythril parameters)
- Contact information for follow-up questions

---

## 8. Next Steps After Audit Completion

### Immediate Actions Upon Successful Audit

1. **Publish Audit Certificate:** Share sanitized version publicly
2. **Update README Badge:** Add "Audit Passed ✓" visual indicator
3. **Announce to Community:** Press release or blog post highlighting achievement
4. **Schedule Post-Audit Review:** Plan 3-month follow-up assessment

### Long-Term Maintenance Commitments

- Quarterly lightweight scans using updated toolchains
- Annual comprehensive deep-dive audit
- Continuous monitoring via automated dependency checking
- Emergency response protocol activation if vulnerabilities disclosed

---

## 9. Contact Information

**Primary Technical Contact:**
- Name: [Your Name Here]
- Email: [auditor-contact@aegisproof.org]
- Slack Handle: @aegis-dev

**Administrative Contact:**
- Name: [Project Manager Name]
- Email: [admin@aegisproof.org]

**Emergency Escalation:**
- Phone: [+1-XXX-XXX-XXXX] (available 9AM-5PM UTC during business days)

---

**Acknowledgment Required:** Please confirm receipt of this package and accept engagement terms before proceeding with Phase 1 activities.
