# AegisProof v2 - External Audit Index

**Document Version:** 1.0  
**Date:** August 2026 (Phase 7)  
**Purpose:** Evidence inventory & verification procedures for auditors  

---

## Executive Summary

This index maps every artifact and evidence item referenced during an external security audit, enabling systematic verification, efficient navigation, and thorough assessment.

### Audit Scope Revisited

Auditors evaluating:
1. Smart contract correctness (`contracts/*.sol`)
2. Circuit definition integrity (`circuits/*.circom`)
3. SDK implementation accuracy (`packages/sdk/src/*.ts`)
4. Integration patterns demonstrated in examples
5. Operational procedures documented in playbooks

All referenced artifacts remain frozen per Phases 0-6 authorization—no modifications introduced during preparation.

---

## 1. Artifact Inventory

### Primary Contracts

| File | Location | Purpose | Verification Method |
|---|---|---|---|
| Groth16VerifierV2Production.sol | `contracts/` | Core verification logic | Compare deployed bytecode against published source |
| AegisShield.sol | `contracts/` | Session management wrapper | Cross-reference interface with verifier contract |
| IAegisVerifier.sol | `contracts/interfaces/` | External interface definition | Validate compatibility with Solidity ABI spec |

---

### Cryptographic Artifacts

| Artifact | Hash Prefix | Size | Location |
|---|---|---|---|
| production.zkey | `ce5a3d...` | ~2MB | `artifacts/phase4/final/` |
| production-vkey.json | `d012bd...` | ~2KB | `artifacts/phase4/final/` |
| canonical R1CS | `3d4722...` | ~500KB | `artifacts/phase4/final/` |

**Verification Commands:**
```bash
sha256sum artifacts/phase4/final/production-zkey
sha256sum artifacts/phase4/final/production-vkey.json
```

Expected output starts with the specified prefixes, confirming immutability maintained since Phase 4 ceremony completion.

---

### Test Suite Coverage

| Test File | Coverage Target | Status |
|---|---|---|
| tests/AegisVerifier.ts | Verifier contract functionality | ✅ Green |
| tests/testVerifyAndAccept.ts | End-to-end workflow validation | ✅ Green |
| tests/integration/*.ts | Cross-chain compatibility checks | ✅ Green |

Run `npm test -- --coverage` to generate an HTML report under the `coverage/` directory for interactive inspection in a browser.

---

## 2. Evidence Mapping Matrix

Each finding raised during an audit maps directly to specific code sections and documentation entries, enabling rapid location, context gathering, remediation planning, and execution tracking.

### Security Finding → Source Code Cross-Reference

| Finding ID | Severity | Affected Component | Location | Description |
|---|---|---|---|---|
| SF-001 | Medium | IC Constant Encoding | Line ~45 contracts/Groth16VerifierV2Production.sol | Hardcoded values must match production VK exactly |
| SF-002 | Low | Calldata Parsing | Line ~85 contracts/Groth16VerifierV2Production.sol | Ensure length checks prevent buffer overflows |
| SF-003 | Informational | Event Emission | Line ~120 contracts/AegisShield.sol | Recommend adding Indexed topics for indexing efficiency |

---

### Documentation References

| Topic | Document Section | Page/Line Number |
|---|---|---|
| Threat Model | `docs/threat_model.md` | Full document |
| Deployment Procedures | `docs/deployment-playbook.md` | Sections 2-6 |
| Monitoring Configuration | `OPERATIONS_MONITORING.md` | Section 6 |
| Incident Response | `SECURITY_OPERATIONS.md` | Section 1 |

---

## 3. Verification Procedures

### Step-by-Step Auditor Workflow

1. **Clone Repository & Setup Environment**
   ```bash
   git clone https://github.com/aegisproof/aegis-proof.git
   cd aegis-proof
   git checkout 885475e  # Phase 7 Part 1 commit
   npm install
   npx hardhat compile
   ```

2. **Validate Contract Compilation**
   - Confirm zero warnings/errors
   - Check gas estimates match expected ranges (~285k verifyProof)
   - Verify artifact hashes match Phase 6 baseline

3. **Execute Static Analysis**
   ```bash
   npx slither contracts/ --detect reentrancy-arbitrary-transfer-local-var-uninitialized-state
   npx mythril analyze artifacts/contracts/Groth16VerifierV2Production.json
   ```

4. **Review Formal Properties**
   - Extract pre/post conditions from function selectors
   - Generate control flow graphs visualizing execution paths
   - Identify unreachable code paths, dead branches, and unused variables

5. **Perform Dynamic Testing**
   - Deploy to local Hardhat network
   - Execute fuzzing campaigns targeting edge cases
   - Measure gas consumption variance across inputs

6. **Cross-Check Against Production Artifacts**
   - Validate IC constants match public VK file prefix `d012bd...`
   - Confirm circuit constraint count aligns with R1CS file metadata
   - Verify witness calculator produces correct outputs for sample inputs

7. **Compile Findings Report**
   - Categorize issues by severity: Critical, High, Medium, or Low
   - Provide reproduction steps with exact commands, input data, expected outcomes, and observed behavior
   - Cross-reference each finding with the evidence mapping matrix in Section 2
   - Submit findings using the template in [`audit-ready/auditor-guide.md`](audit-ready/auditor-guide.md)

---

## 4. Cross-Reference Index

| Topic | Primary Document |
|---|---|
| Cryptographic assumptions | [`audit-ready/cryptographic-assumptions.md`](audit-ready/cryptographic-assumptions.md) |
| Known limitations | [`audit-ready/known-limitations.md`](audit-ready/known-limitations.md) |
| Security review checklist | [`audit-ready/security-review-checklist.md`](audit-ready/security-review-checklist.md) |
| Threat model (extended) | [`audit-ready/threat-review-package.md`](audit-ready/threat-review-package.md) |
| Ceremony report | [`docs/phase4-ceremony-report.md`](docs/phase4-ceremony-report.md) |
| Phase 5 audit package | [`audit-package/README.md`](audit-package/README.md) |

---

## 5. Sign-Off

| Reviewer | Role | Date | Signature |
|---|---|---|---|
| [Name] | Lead Auditor | ________ | __________ |
| [Name] | Technical Lead | ________ | __________ |

**Document Status:** Ready for external auditor distribution
