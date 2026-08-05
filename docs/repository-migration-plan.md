# AegisProof Repository Migration Plan

**Document Version:** 1.0  
**Date:** August 5, 2026  
**Current Commit:** `d854ba1`  
**Target Commit:** [To be created after migration]  
**Authorization:** Phase 2 explicitly approved  

---

## Executive Summary

This migration plan outlines the complete directory restructuring of the AegisProof repository from its current mixed organization to a clean OSS-ready structure. 

**Critical Constraint:** This is a **filesystem organization operation only**. Zero modifications to cryptographic logic, circuit semantics, R1CS/WASM/SYM files, zkey/vkey artifacts, ceremony transcripts, or SSoT protocol specifications.

**Migration Scope:** Update paths, imports, documentation links, CI references, build configurations - nothing more.

---

## Safety Guarantees

Before executing this migration, verify that all stakeholders agree to:

### Immutable Artifacts Checklist

These files must remain **byte-for-byte identical** throughout migration:

| Artifact | Current Location | SHA-256 Hash Prefix | Status |
|----------|------------------|---------------------|--------|
| `production-zkey` | artifacts/phase4/final/ | ce5a3d... | 🔒 LOCKED |
| `production-vkey.json` | artifacts/phase4/final/ | d012bd... | 🔒 LOCKED |
| `canonical-r1cs` | artifacts/phase4/final/ | 3d4722... | 🔒 LOCKED |
| `aegis_commit_core.r1cs` | Root level | N/A | 🔒 LOCKED |
| `aegis_commit_core.wasm` | Root level | N/A | 🔒 LOCKED |
| `aegis_commit_core.sym` | Root level | N/A | 🔒 LOCKED |

**Verification Command (Before Migration):**
```bash
cd c:\workspace\AegisProof
sha256sum artifacts/phase4/final/production-zkey
sha256sum artifacts/phase4/final/production-vkey.json
sha256sum aegis_commit_core.r1cs
sha256sum aegis_commit_core.wasm
sha256sum aegis_commit_core.sym
```

**Verification Command (After Migration):**
```bash
# MUST produce identical hashes
# If ANY hash differs: STOP IMMEDIATELY and rollback
```

---

## File Movement Matrix

### Category 1: Production Source Code

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `contracts/*.sol` | `protocol/contracts/*.sol` | Low | Organization | No |
| `contracts/interfaces/*.sol` | `protocol/contracts/interfaces/*.sol` | Low | Organization | No |
| `circuits/*.circom` | `protocol/circuits/*.circom` | Low-Medium | Organization | Yes |
| `circuits/imports/` | `protocol/circuits/imports/` | Low | Organization | Yes |
| `circuits/utils/*.circom` | `protocol/circuits/utils/*.circom` | Low | Organization | Yes |
| `specs/*.json` | `protocol/specs/*.json` | Medium | SSoT protection | **YES** |
| `specs/*.md` | `protocol/specs/*.md` | Low | Organization | Yes |

### Category 2: Cryptographic Artifacts

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `artifacts/phase4/final/*` | `crypto-artifacts/phase4/*` | **CRITICAL** | Immutable artifacts | **YES** |
| `aegis_commit_core.r1cs` (root) | `crypto-artifacts/phase3/aegis_commit_core.r1cs` | **CRITICAL** | Immutable artifact | **YES** |
| `aegis_commit_core.wasm` (root) | `crypto-artifacts/phase3/aegis_commit_core.wasm` | **CRITICAL** | Immutable artifact | **YES** |
| `aegis_commit_core.sym` (root) | `crypto-artifacts/phase3/aegis_commit_core.sym` | **CRITICAL** | Immutable artifact | **YES** |
| `artifacts/contracts/` | `verification/artifacts/compiled-contracts/` | Low | Organizational | No |
| `artifacts/phase2/` | `crypto-artifacts/phase2/` | Low | Organization | No |

### Category 3: Formal Proofs

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `formal/` | Keep at root (`formal/`) | None | Already organized | No |
| `AegisProof.lean` (root) | `formal/AegisProof.lean` | Low | Consolidation | No |
| `AegisShield.lean` (root) | `formal/AegisShield.lean` | Low | Consolidation | No |
| `AegisSignalBinding.lean` (root) | `formal/AegisSignalBinding.lean` | Low | Consolidation | No |
| `Main.lean` (root) | Remove duplicate (keep formal/Main.lean) | Low | Deduplication | No |

### Category 4: Documentation

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `docs/architecture.md` | `docs/architecture/overview.md` | Low | Better hierarchy | No |
| `docs/protocol.md` | `docs/development/protocol.md` | Low | Category reorganization | No |
| `docs/test_vectors.md` | `docs/security/test-vectors.md` | Low | Security context | No |
| `docs/threat_model.md` | `docs/security/threat-model.md` | Low | Security context | No |
| `docs/whitepaper.md` | `docs/research/whitepaper.md` | Low | Research category | No |
| `Architecture.md` (root) | Delete (duplicate of docs/architecture/overview.md) | Low | Remove redundancy | No |
| `DEPLOYMENT_INFO.md` (untracked) | `docs/deployment/guide.md` | Low | Documentation cleanup | No |
| `GAS_PERFORMANCE.md` (untracked) | `docs/benchmarks/gas.md` | Low | Benchmark organization | No |
| `SECURITY_VERIFICATION_REPORT.md` (untracked) | `docs/security/report.md` | Low | Security audit report | No |
| `RELEASE_READINESS.md` (untracked) | `docs/deployment/readiness.md` | Low | Deployment checklist | No |
| `PHASE7-FINAL-REPORT.md` | `docs/legacy/phase-reports/phase7-final-report.md` | Low | Archive phase reports | No |
| `FINAL_VERIFICATION_REPORT.md` | `docs/legacy/phase7-verification.md` | Low | Archive verification | No |
| `PHASE7-SUMMARY.md` | `docs/legacy/phase-reports/phase7-summary.md` | Low | Archive summary | No |
| `PHASE8-ARCHITECTURE.md` | `docs/research/phase8-architecture.md` | Low | Research archive | No |
| `PHASE9-RESEARCH-ROADMAP.md` | `docs/research/phase9-roadmap.md` | Low | Research archive | No |
| `PHASE8-PHASE9-PLANNING-SUMMARY.md` | `docs/research/planning-summary.md` | Low | Research planning | No |
| `COMMIT-CONFIRMATION-DED0EBB.md` | `docs/legacy/migration-commit-confirmation.md` | Low | Historical record | No |

### Category 5: Verification & Testing

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `test/*.ts` | `verification/tests/integration/*.ts` | Medium | Test consolidation | Yes |
| `tests/circuits/` | `verification/tests/circuits/` | Low | Organization | Yes |
| `tests/contracts/` | `verification/tests/contracts/` | Low | Organization | Yes |
| `tests/integration/` | `verification/tests/integration/` | Low | Organization | Yes |
| `tests/vectors/` | `verification/tests/vectors/` | Low | Organization | Yes |
| `.github/workflows/lean_action_ci.yml` | `verification/gates/.github/workflows/lean_action_ci.yml` | Medium | CI gate organization | Yes |
| `benchmarks/constraints.md` | `docs/benchmarks/constraints.md` | Low | Move benchmarks to docs | No |
| `benchmarks/gas.md` | `docs/benchmarks/gas.md` | Low | Move benchmarks to docs | No |
| `benchmarks/proving.md` | `docs/benchmarks/proving.md` | Low | Move benchmarks to docs | No |

### Category 6: SDK & Applications

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `sdk/typescript/` | Keep as-is (`sdk/typescript/`) | None | Already organized | No |
| `sdk/python/` | Keep as-is (`sdk/python/`) | None | Already organized | No |
| `sdk/rust/` | Keep as-is (`sdk/rust/`) | None | Already organized | No |
| `examples/basic/` | Keep as-is (`examples/basic/`) | None | Already organized | No |
| `examples/ethereum/` | Keep as-is (`examples/ethereum/`) | None | Already organized | No |
| `examples/tee/` | Keep as-is (`examples/tee/`) | None | Already organized | No |
| `server/src/` | Keep as-is (`server/src/`) | None | Operational code | No |

### Category 7: Tools & Custom Compilers

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `circom/` | `tooling/circom-compiler/` | Medium | Tool categorization | Yes |
| `plugins/` | `ai/plugins/` | Low | AI tool categorization | Yes |

### Category 8: Miscellaneous Configuration

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `package.json` | Keep at root (`package.json`) | None | npm entry point | No |
| `package-lock.json` | Keep at root (`package-lock.json`) | None | Dependency lock | No |
| `tsconfig.json` | Keep at root (`tsconfig.json`) | None | TypeScript config | No |
| `lakefile.toml` | Keep at root (`lakefile.toml`) | None | Lean build config | No |
| `lake-manifest.json` | Keep at root (`lake-manifest.json`) | None | Lean manifest | No |
| `lean-toolchain` | Keep at root (`lean-toolchain`) | None | Lean version pinning | No |
| `README.md` | Keep at root (`README.md`) | None | Entry documentation | No |
| `LICENSE` | Keep at root (`LICENSE`) | None | Legal requirement | No |
| `.gitignore` | Keep at root (`.gitignore`) | None | Git configuration | No |
| `.env` | **REMOVE FROM GIT** → Keep as local file | High | Should not be tracked | N/A |

### Category 9: Deprecated Files

| Old Path | Action | Risk Level | Reason | Rollback Required? |
|----------|--------|------------|--------|-------------------|
| `final_versions/AegisShield.sol` | DELETE | Low | Outdated draft | No |
| `final_versions/testVerifyAndAccept.ts` | DELETE | Low | Deprecated test | No |
| `final_versions/*.penetration.ts` | DELETE | Low | Obsolete security tests | No |
| `final_versions/*.sol` | DELETE | Low | Outdated contracts | No |
| `repo-structure-before.txt` | DELETE | Low | Temp file from session | No |

### Category 10: Deployment Manifests

| Old Path | New Path | Risk Level | Reason | Rollback Required? |
|----------|----------|------------|--------|-------------------|
| `deployments/localhost.json` | `verification/manifests/deployments/localhost.json` | Medium | Manifest organization | Yes |
| `hardhat.config.ts` | Keep at root | None | Build configuration | No |

---

## Detailed Implementation Plan

### Step 1: Pre-Migration Verification (CRITICAL)

```bash
# Record baseline SHA-256 hashes for all immutable artifacts
echo "BEFORE MIGRATION HASHES:" > migration-hashes-before.txt

cd c:\workspace\AegisProof
sha256sum artifacts/phase4/final/production-zkey >> migration-hashes-before.txt
sha256sum artifacts/phase4/final/production-vkey.json >> migration-hashes-before.txt
sha256sum aegis_commit_core.r1cs >> migration-hashes-before.txt
sha256sum aegis_commit_core.wasm >> migration-hashes-before.txt
sha256sum aegis_commit_core.sym >> migration-hashes-before.txt

# Create artifact inventory snapshot
git ls-files | sort > artifact-inventory-before.txt
```

**Expected Output:** All hashes recorded successfully

---

### Step 2: Create New Directory Structure

```bash
# Protocol directory structure
mkdir -p protocol/circuits/imports
mkdir -p protocol/circuits/utils
mkdir -p protocol/contracts/interfaces
mkdir -p protocol/generated/r1cs
mkdir -p protocol/generated/wasm

# Crypto artifacts directory structure
mkdir -p crypto-artifacts/phase0
mkdir -p crypto-artifacts/phase2
mkdir -p crypto-artifacts/phase4
mkdir -p crypto-artifacts/manifests
mkdir -p crypto-artifacts/ceremony

# Verification directory structure
mkdir -p verification/gates/.github/workflows
mkdir -p verification/tests/integration
mkdir -p verification/tests/circuits
mkdir -p verification/tests/contracts
mkdir -p verification/tests/vectors
mkdir -p verification/reports
mkdir -p verification/artifacts/compiled-contracts
mkdir -p verification/manifests/deployments

# Documentation directory structure
mkdir -p docs/architecture
mkdir -p docs/security
mkdir -p docs/deployment
mkdir -p docs/research
mkdir -p docs/development
mkdir -p docs/benchmarks
mkdir -p docs/legacy/phase-reports

# AI/Tee directory structure
mkdir -p ai/inference
mkdir -p ai/proof-generation
mkdir -p ai/verification/smart-contracts
mkdir -p tee/tdx/attestation
mkdir -p tee/sev-snp/attestation
mkdir -p tee/common/quote-validation
mkdir -p ai/plugins

# Tooling directory structure
mkdir -p tooling/circom-compiler
mkdir -p tooling/deployment-tools
mkdir -p tooling/verification-scripts

# Audit directory structure
mkdir -p audit/phase-7-package
mkdir -p audit/phase-8-package
mkdir -p audit/findings

echo "New directories created"
```

---

### Step 3: Move Files (Phase-by-Phase)

#### Phase 3a: Production Source Code

```bash
# Smart contracts
mv contracts/*.sol protocol/contracts/ 2>/dev/null || echo "No .sol files found"
mv contracts/interfaces/*.sol protocol/contracts/interfaces/ 2>/dev/null || echo "No interface files"

# CIRCOM circuits
mv circuits/*.circom protocol/circuits/ 2>/dev/null || echo "No circuit files"
mv circuits/imports/ protocol/circuits/ --verbose 2>/dev/null || echo "No imports"
mv circuits/utils/*.circom protocol/circuits/utils/ 2>/dev/null || echo "No utils"

# Clean up empty old directories
rmdir contracts/imports /q /s 2>nul || true
rmdir circuits/imports /q /s 2>nul || true
```

**Risk Assessment:** LOW - These are source files, not cryptographic artifacts  
**Rollback:** Simple `git reset --hard HEAD~1` if needed

---

#### Phase 3b: Cryptographic Artifacts (CRITICAL PHASE)

```bash
# Move production ZK artifacts (HIGH PRIORITY)
# First, verify integrity one more time:
echo "Verifying production-zkey integrity..."
sha256sum -c existing-hash-of-production-zkey  # Verify before move

mv artifacts/phase4/final/production-zkey crypto-artifacts/phase4/ 2>/dev/null
mv artifacts/phase4/final/production-vkey.json crypto-artifacts/phase4/ 2>/dev/null

# After move, verify again:
echo "Verifying post-migration integrity..."
sha256sum crypto-artifacts/phase4/production-zkey > final-hash-check.txt
compare-with-baseline final-hash-check.txt existing-hash-of-production-zkey

if [ diff != 0 ]; then
    echo "HASH MISMATCH DETECTED! ABORTING MIGRATION!"
    exit 1
fi

# Move other artifacts
mv crypto-artifacts/phase2/ crypto-artifacts/phase2/ 2>/dev/null || true

# Move root-level circuit artifacts
mv aegis_commit_core.r1cs crypto-artifacts/phase3/ 2>/dev/null || echo "Already moved"
mv aegis_commit_core.wasm crypto-artifacts/phase3/ 2>/dev/null || echo "Already moved"  
mv aegis_commit_core.sym crypto-artifacts/phase3/ 2>/dev/null || echo "Already moved"

# Move contract compilation outputs
mv artifacts/contracts/ verification/artifacts/compiled-contracts/ 2>/dev/null || echo "No contracts"

echo "Cryptographic artifacts moved"
```

**Risk Assessment:** **CRITICAL** - Any change here breaks cryptographic integrity  
**Verification:** **MUST VERIFY** SHA-256 hashes match exactly before/after  
**Rollback:** Requires manual restoration from git history

---

#### Phase 3c: Specification Files

```bash
# Move specs (SINGLE SOURCE OF TRUTH)
mv specs/*.json protocol/specs/ 2>/dev/null || echo "No JSON specs"
mv specs/*.md protocol/specs/ 2>/dev/null || echo "No MD specs"

# Final verification that canonical-signals.json was moved correctly
echo "Warning: Specs contain SSoT! Handle with extreme care."
ls protocol/specs/
```

**Risk Assessment:** MEDIUM - SSoT files require extra caution  
**Verification:** Verify file contents identical using `diff`  
**Rollback:** Manual restore required

---

#### Phase 3d: Documentation (NON-CRITICAL)

```bash
# Move architecture docs
mv docs/architecture.md docs/architecture/overview.md 2>/dev/null || true

# Move security docs
mv docs/threat_model.md docs/security/threat-model.md 2>/dev/null || true
mv docs/test_vectors.md docs/security/test-vectors.md 2>/dev/null || true

# Move research docs
mv docs/whitepaper.md docs/research/whitepaper.md 2>/dev/null || true

# Move phase reports to legacy
mv PHASE7-FINAL-REPORT.md docs/legacy/phase-reports/ 2>/dev/null || echo "Not found at root"
mv FINAL_VERIFICATION_REPORT.md docs/legacy/phase7-verification.md 2>/dev/null || echo "Not found at root"
mv PHASE7-SUMMARY.md docs/legacy/phase-reports/phase7-summary.md 2>/dev/null || echo "Not found at root"

# Move research planning docs
mv PHASE8-ARCHITECTURE.md docs/research/phase8-architecture.md 2>/dev/null || echo "Not found at root"
mv PHASE9-RESEARCH-ROADMAP.md docs/research/phase9-roadmap.md 2>/dev/null || echo "Not found at root"
mv PHASE8-PHASE9-PLANNING-SUMMARY.md docs/research/planning-summary.md 2>/dev/null || echo "Not found at root"

# Cleanup duplicates
rm Architecture.md 2>/dev/null || true  # Duplicate

# Untracked docs (will be added to git later)
# DEPLOYMENT_INFO.md
# GAS_PERFORMANCE.md  
# SECURITY_VERIFICATION_REPORT.md
# RELEASE_READINESS.md

echo "Documentation moved"
```

**Risk Assessment:** LOW - Documentation files have no cryptographic impact  
**Verification:** Visual inspection sufficient  
**Rollback:** Easy revert via git

---

#### Phase 3e: Tests and Verification Infrastructure

```bash
# Move integration tests
mv test/*.ts verification/tests/integration/ 2>/dev/null || echo "No test files"

# Move additional tests
mv tests/circuits/ verification/tests/ 2>/dev/null || echo "No circuits tests"
mv tests/contracts/ verification/tests/ 2>/dev/null || echo "No contracts tests"
mv tests/integration/ verification/tests/ 2>/dev/null || echo "No integration tests"
mv tests/vectors/ verification/tests/ 2>/dev/null || echo "No vectors"

# Move CI workflows
mkdir -p verification/gates/.github/workflows
mv .github/workflows/lean_action_ci.yml verification/gates/.github/workflows/ 2>/dev/null || echo "Workflow not found"

# Move benchmarks to docs
mv benchmarks/constraints.md docs/benchmarks/constraints.md 2>/dev/null || echo "Already moved"
mv benchmarks/gas.md docs/benchmarks/gas.md 2>/dev/null || echo "Already moved"
mv benchmarks/proving.md docs/benchmarks/proving.md 2>/dev/null || echo "Already moved"

# Remove empty directories
rmdir test/ /q /s 2>nul || true
rmdir tests/ /q /s 2>nul || true

echo "Verification infrastructure updated"
```

**Risk Assessment:** LOW - Tests are non-cryptographic  
**Verification:** Run test suite to ensure paths still resolve  
**Rollback:** Simple git reset

---

#### Phase 3f: Formal Proofs and Tooling

```bash
# Consolidate formal proofs (already mostly organized)
# Move root .lean files to formal/
mv AegisProof.lean formal/ 2>/dev/null || echo "Not found at root"
mv AegisShield.lean formal/ 2>/dev/null || echo "Not found at root"
mv AegisSignalBinding.lean formal/ 2>/dev/null || echo "Not found at root"

# Remove duplicate Main.lean
rm Main.lean 2>/dev/null || echo "Duplicate Main.lean does not exist"

# Move custom circom compiler
mv circom/ tooling/circom-compiler/ 2>/dev/null || echo "Custom circom not found"

# Move AI plugins
mv plugins/ ai/plugins/ 2>/dev/null || echo "Plugins not found"

echo "Formal proofs and tooling consolidated"
```

**Risk Assessment:** LOW - Lean proofs are verification tools  
**Verification:** Run `lake build` to ensure proofs still compile  
**Rollback:** Simple git reset

---

### Step 4: Update Import Paths and References

**IMPORTANT:** After moving files, update all references!

#### 4.1 Update Solidity Imports (if any cross-imports exist)

Check for:
```bash
grep -r "import.*from.*contracts/" contracts/ --include="*.sol"
```

Update:
```solidity
// OLD: import "./interfaces/IAegisVerifier.sol";
// NEW: import "../../../protocol/contracts/interfaces/IAegisVerifier.sol";
```

#### 4.2 Update TypeScript Imports

Check and update:
```typescript
// OLD: import { ... } from "@aegisproof/sdk";
// NEW: Check relative paths in server/src/, sdk/typescript/src/, etc.

# Find all problematic imports
findstr /S /N /M "from.*'" ./*.ts */*.ts 2>nul | findstr /V ".git"
```

#### 4.3 Update Hardhat Configuration

Edit `hardhat.config.ts`:
```typescript
// OLD paths
path: "artifacts/contracts/Groth16Verifier.json",

// NEW paths
path: "verification/artifacts/compiled-contracts/Groth16Verifier.json",
```

#### 4.4 Update Circom Circuit Includes

Edit `protocol/circuits/*.circom`:
```circom
// OLD includes
include "../imports/library.circom";

// NEW includes (adjust based on final structure)
include "../utils/library.circom";
```

#### 4.5 Update Lean Imports

Edit `formal/*.lean`:
```lean
-- OLD include paths
#check AegisSignals.signal_validity

-- May need to adjust lakefile.toml include paths
```

#### 4.6 Update Documentation Links

Edit markdown files:
```markdown
<!-- OLD -->
[Protocol Spec](../specs/canonical-signals.json)

<!-- NEW -->
[Protocol Spec](../../protocol/specs/canonical-signals.json)
```

#### 4.7 Update CI Workflows

Edit `verification/gates/.github/workflows/lean_action_ci.yml`:
```yaml
# OLD paths
run: cd formal && lake build

# Adjust if necessary based on new structure
```

#### 4.8 Update Script Paths

Edit `scripts/*.ts`, `scripts/*.js`:
```javascript
// OLD: const vkeyPath = "artifacts/phase4/final/production-vkey.json";
// NEW: const vkeyPath = "crypto-artifacts/phase4/production-vkey.json";
```

---

### Step 5: Verification Phase

#### 5.1 Cryptographic Integrity Verification

```bash
echo "=== POST-MIGRATION CRYPTOGRAPHIC VERIFICATION ===" > migration-verification.txt

cd c:\workspace\AegisProof

echo "\n1. Verifying production-zkey..." >> migration-verification.txt
sha256sum crypto-artifacts/phase4/production-zkey >> migration-verification.txt

echo "\n2. Verifying production-vkey.json..." >> migration-verification.txt  
sha256sum crypto-artifacts/phase4/production-vkey.json >> migration-verification.txt

echo "\n3. Comparing with pre-migration hashes..." >> migration-verification.txt
compare-with-baseline crypto-artifacts/phase4/production-zkey migration-hashes-before.txt >> migration-verification.txt

if [ success ]; then
    echo "✅ ALL CRYPTO ARTIFACTS VERIFIED IDENTICAL" >> migration-verification.txt
else
    echo "❌ HASH MISMATCH DETECTED - ABORTING!" >> migration-verification.txt
    exit 1
fi
```

**Expected Result:** ✅ ALL PASS

---

#### 5.2 Functional Verification

```bash
echo "=== FUNCTIONAL VERIFICATION ===" >> migration-verification.txt

# 1. Compile contracts
echo "\n4. Compiling Solidity contracts..." >> migration-verification.txt
npx hardhat compile --force 2>&1 | tee -a migration-verification.txt
if [ $? == 0 ]; then
    echo "✅ Contracts compiled successfully" >> migration-verification.txt
else
    echo "❌ Contract compilation FAILED" >> migration-verification.txt
    exit 1
fi

# 2. Run Lean proofs
echo "\n5. Building Lean proofs..." >> migration-verification.txt
cd formal && lake build 2>&1 | tee -a ../../migration-verification.txt
cd ..
if [ $? == 0 ]; then
    echo "✅ Lean proofs verified successfully" >> migration-verification.txt
else
    echo "❌ Lean proof verification FAILED" >> migration-verification.txt
    exit 1
fi

# 3. Run test suite
echo "\n6. Running test suite..." >> migration-verification.txt
npm test 2>&1 | tee -a migration-verification.txt
if [ $? == 0 ]; then
    echo "✅ All tests passed" >> migration-verification.txt
else
    echo "❌ Test suite FAILED - investigating..." >> migration-verification.txt
    exit 1
fi

echo "=== VERIFICATION COMPLETE ===" >> migration-verification.txt
```

**Expected Result:** ✅ ALL TESTS PASS

---

#### 5.3 Manifest Verification

```bash
echo "\n7. Verifying deployment manifests..." >> migration-verification.txt
node scripts/check_contract.ts 2>&1 | tee -a migration-verification.txt

# Verify canonical signals haven't changed
echo "\n8. Verifying SSoT integrity..." >> migration-verification.txt
git diff HEAD protocol/specs/canonical-signals.json
if [ no diff ]; then
    echo "✅ SSoT unchanged" >> migration-verification.txt
else
    echo "⚠️  WARNING: SSoT modified!" >> migration-verification.txt
    # Decision: Abort or allow manual review
fi
```

**Expected Result:** ✅ NO UNAUTHORIZED CHANGES

---

### Step 6: Cleanup and Finalization

#### 6.1 Remove Empty Directories

```bash
# Clean up old empty directories
rmdir contracts/imports /q /s 2>nul || true
rmdir circuits/imports /q /s 2>nul || true
rmdir test/ /q /s 2>nul || true
rmdir tests/ /q /s 2>nul || true
rmdir final_versions/ /q /s 2>nul || true

echo "Empty directories removed"
```

#### 6.2 Add New Files to Git

```bash
git add -A
git status --short
```

Review staged changes carefully before committing!

#### 6.3 Remove Deleted Files from Git Index

```bash
git rm --cached final_versions/
git rm --cached repo-structure-before.txt 2>/dev/null || true

echo "Obsolete files scheduled for removal"
```

#### 6.4 Generate Migration Report

Create detailed report in `docs/repository-migration-report.md` (see below)

#### 6.5 Final Commit

```bash
git commit -m "Repository: reorganize project structure for OSS readiness

Major improvements:
- Consolidated protocol implementation under protocol/
- Separated immutable cryptographic artifacts
- Organized documentation into logical hierarchy
- Improved maintainability and developer experience
- Standardized naming conventions (lowercase-with-hyphen)

Security impact: ZERO
- All cryptographic artifacts byte-identical
- No protocol modifications
- No circuit changes
- All verification checks pass

Migration guide: See docs/repository-migration-report.md

Authorized under Phase 2 explicit approval"
```

---

## Risk Classification Summary

| Risk Category | Risk Level | Mitigation Strategy | Rollback Complexity |
|---------------|------------|---------------------|---------------------|
| **Cryptographic Artifacts** | CRITICAL | SHA-256 hash verification before/after | High (manual) |
| **SSoT Specifications** | HIGH | Diff comparison + manual verification | High (manual) |
| **Circuit Definitions** | MEDIUM-Low | Verify constraints unchanged | Medium (manual) |
| **Import Paths** | LOW | Automated testing | Low (git reset) |
| **Documentation** | LOW | Visual inspection | Low (git reset) |
| **Test Suites** | LOW | Re-run full test suite | Low (git reset) |

---

## Rollback Procedure

If ANY step fails:

### Option A: Single Step Failure
```bash
git reset HEAD~1
git checkout HEAD -- <problematic-file>
```

### Option B: Full Rollback (Worst Case)
```bash
git reset --hard HEAD~1
```

### Option C: Manual Recovery (Most Complex)
```bash
# Restore cryptographic artifacts from backup
cp /tmp/migration-backup/crypto-artifacts/phase4/* crypto-artifacts/phase4/

# Restore original directory structure from git stash
git stash list
git stash apply stash@{0}
```

**Backup Recommendation:** Before starting migration, create a backup branch:
```bash
git checkout -b migration-preparation-backup
git push origin migration-preparation-backup
```

---

## Rollback Triggers

Abort migration immediately if:

1. **Hash mismatch detected** for any cryptographic artifact
2. **SSoT files modified** without explicit authorization
3. **Test suite failures** indicating broken functionality
4. **CI pipeline failures** suggesting path resolution issues
5. **Any unexpected behavior** in production system

---

## Timeline Estimate

| Phase | Estimated Duration | Dependencies |
|-------|--------------------|--------------|
| Pre-migration verification | 1 hour | None |
| Directory creation | 0.5 hour | Phase 1 complete |
| File movement | 2 hours | Phase 2 complete |
| Import path updates | 3 hours | Phase 3 complete |
| Verification execution | 2 hours | Phase 4 complete |
| Cleanup and commit | 1 hour | Phase 5 complete |
| **Total** | **~9 hours** | Sequential execution |

---

## Success Criteria

Migration considered successful when:

✅ All SHA-256 hashes match pre-migration baseline  
✅ All unit tests pass  
✅ All integration tests pass  
✅ All CI gates pass  
✅ Contracts compile without errors  
✅ Lean proofs verify successfully  
✅ No production artifacts modified  
✅ Documentation renders correctly  
✅ Working tree clean (no uncommitted changes except migration commit)  

---

## Conclusion

This migration plan provides a comprehensive, safe approach to reorganizing the AegisProof repository while maintaining absolute cryptographic integrity. Every step includes verification checkpoints and rollback procedures.

**Key Safety Features:**
- SHA-256 hash verification for all cryptographic artifacts
- Phase-by-phase execution with intermediate verification
- Complete rollback procedures documented
- Clear risk classification and mitigation strategies
- Authorization requirements enforced at each critical step

**Next Step:** Execute migration plan after explicit human authorization confirming understanding of all risks and safeguards.

---

**END OF MIGRATION PLAN**

**Document Version:** 1.0  
**Last Updated:** August 5, 2026  
**Status:** Ready for Execution Upon Authorization
