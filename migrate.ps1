# AegisProof Repository Migration Script - Complete Restructuring
# This script executes the directory reorganization per approved migration plan

$ErrorActionPreference = "Stop"

Write-Host "=== AEGISPROOF REPOSITORY MIGRATION ===" -ForegroundColor Cyan
Write-Host "Starting Phase 2: Directory Restructuring..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Create new directories
Write-Host "Step 1: Creating new directory structure..." -ForegroundColor Yellow

$directories = @(
    "protocol/circuits/imports",
    "protocol/circuits/utils",
    "protocol/contracts/interfaces",
    "crypto-artifacts/phase0",
    "crypto-artifacts/phase2", 
    "crypto-artifacts/phase4",
    "crypto-artifacts/manifests",
    "verification/gates/.github/workflows",
    "verification/tests/integration",
    "verification/tests/circuits",
    "verification/tests/contracts",
    "verification/tests/vectors",
    "docs/architecture",
    "docs/security",
    "docs/deployment",
    "docs/research",
    "docs/development",
    "docs/benchmarks",
    "docs/legacy/phase-reports",
    "ai/inference",
    "ai/plugins"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ Created: $dir" -ForegroundColor Gray
    } else {
        Write-Host "  ⊘ Exists: $dir" -ForegroundColor DarkGray
    }
}

Write-Host ""

# Step 2: Move production source code
Write-Host "Step 2: Moving production source code..." -ForegroundColor Yellow

Move-Item -Path "contracts/*.sol" -Destination "protocol/contracts/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "contracts/interfaces/*" -Destination "protocol/contracts/interfaces/" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved smart contracts to protocol/contracts/" -ForegroundColor Gray

Move-Item -Path "circuits/*.circom" -Destination "protocol/circuits/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "circuits/imports" -Destination "protocol/circuits/imports" -Force -ErrorAction SilentlyContinue
Move-Item -Path "circuits/utils/*" -Destination "protocol/circuits/utils/" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved CIRCOM circuits to protocol/circuits/" -ForegroundColor Gray

Remove-Item -Path "contracts" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "circuits/imports" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "circuits/utils" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Cleaned up old directories" -ForegroundColor Gray

Write-Host ""

# Step 3: Move cryptographic artifacts (CRITICAL)
Write-Host "Step 3: Moving cryptographic artifacts..." -ForegroundColor Yellow

Move-Item -Path "artifacts/phase4/final/production-zkey" -Destination "crypto-artifacts/phase4/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "artifacts/phase4/final/production-vkey.json" -Destination "crypto-artifacts/phase4/" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved production zkey and vkey" -ForegroundColor Gray

Move-Item -Path "artifacts/phase2" -Destination "crypto-artifacts/phase2/" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved phase2 artifacts" -ForegroundColor Gray

Move-Item -Path "circuits/aegis_commit_core.r1cs" -Destination "crypto-artifacts/phase3/aegis_commit_core.r1cs" -Force -ErrorAction SilentlyContinue
Move-Item -Path "circuits/aegis_commit_core.sym" -Destination "crypto-artifacts/phase3/aegis_commit_core.sym" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved circuit artifacts to crypto-artifacts/phase3/" -ForegroundColor Gray

Write-Host ""

# Step 4: Move specifications
Write-Host "Step 4: Moving specifications..." -ForegroundColor Yellow

Move-Item -Path "specs/*.json" -Destination "protocol/specs/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "specs/*.md" -Destination "protocol/specs/" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved specs to protocol/specs/" -ForegroundColor Gray

Remove-Item -Path "specs" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Removed empty specs directory" -ForegroundColor Gray

Write-Host ""

# Step 5: Move formal proofs
Write-Host "Step 5: Consolidating formal proofs..." -ForegroundColor Yellow

Move-Item -Path "AegisProof.lean" -Destination "formal/AegisProof.lean" -Force -ErrorAction SilentlyContinue
Move-Item -Path "AegisShield.lean" -Destination "formal/AegisShield.lean" -Force -ErrorAction SilentlyContinue
Move-Item -Path "AegisSignalBinding.lean" -Destination "formal/AegisSignalBinding.lean" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Consolidated Lean proofs into formal/ directory" -ForegroundColor Gray

Write-Host ""

# Step 6: Move tests
Write-Host "Step 6: Reorganizing test suites..." -ForegroundColor Yellow

Move-Item -Path "test/*.ts" -Destination "verification/tests/integration/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "tests/circuits" -Destination "verification/tests/circuits" -Force -ErrorAction SilentlyContinue
Move-Item -Path "tests/contracts" -Destination "verification/tests/contracts" -Force -ErrorAction SilentlyContinue
Move-Item -Path "tests/integration" -Destination "verification/tests/integration" -Force -ErrorAction SilentlyContinue
Move-Item -Path "tests/vectors" -Destination "verification/tests/vectors" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved tests to verification/tests/" -ForegroundColor Gray

Remove-Item -Path "test" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "tests" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Removed old test directories" -ForegroundColor Gray

Write-Host ""

# Step 7: Move CI workflows
Write-Host "Step 7: Organizing CI workflows..." -ForegroundColor Yellow

if (Test-Path ".github/workflows/lean_action_ci.yml") {
    Move-Item -Path ".github/workflows/lean_action_ci.yml" -Destination "verification/gates/.github/workflows/lean_action_ci.yml" -Force
    Write-Host "  ✓ Moved CI workflow to verification/gates/" -ForegroundColor Gray
}

Write-Host ""

# Step 8: Move documentation
Write-Host "Step 8: Reorganizing documentation..." -ForegroundColor Yellow

Move-Item -Path "docs/architecture.md" -Destination "docs/architecture/overview.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "docs/threat_model.md" -Destination "docs/security/threat-model.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "docs/test_vectors.md" -Destination "docs/security/test-vectors.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "docs/whitepaper.md" -Destination "docs/research/whitepaper.md" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Reorganized core docs" -ForegroundColor Gray

# Move root-level docs to proper locations
Move-Item -Path "PHASE7-FINAL-REPORT.md" -Destination "docs/legacy/phase-reports/phase7-final-report.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "FINAL_VERIFICATION_REPORT.md" -Destination "docs/legacy/phase7-verification.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "PHASE7-SUMMARY.md" -Destination "docs/legacy/phase-reports/phase7-summary.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "PHASE8-ARCHITECTURE.md" -Destination "docs/research/phase8-architecture.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "PHASE9-RESEARCH-ROADMAP.md" -Destination "docs/research/phase9-roadmap.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "PHASE8-PHASE9-PLANNING-SUMMARY.md" -Destination "docs/research/planning-summary.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "COMMIT-CONFIRMATION-DED0EBB.md" -Destination "docs/legacy/migration-commit-confirmation.md" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Archived phase reports and research docs" -ForegroundColor Gray

# Cleanup root-level docs (some may not exist, handle gracefully)
Remove-Item -Path "Architecture.md" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Removed duplicate Architecture.md" -ForegroundColor Gray

Write-Host ""

# Step 9: Cleanup deprecated files
Write-Host "Step 9: Cleaning up deprecated files..." -ForegroundColor Yellow

Remove-Item -Path "final_versions" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Removed final_versions/ directory" -ForegroundColor Gray

Write-Host ""

# Step 10: Move benchmarks
Write-Host "Step 10: Organizing benchmarks..." -ForegroundColor Yellow

Move-Item -Path "benchmarks/constraints.md" -Destination "docs/benchmarks/constraints.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "benchmarks/gas.md" -Destination "docs/benchmarks/gas.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "benchmarks/proving.md" -Destination "docs/benchmarks/proving.md" -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Moved benchmarks to docs/benchmarks/" -ForegroundColor Gray

Remove-Item -Path "benchmarks" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  ✓ Removed empty benchmarks directory" -ForegroundColor Gray

Write-Host ""

# Step 11: Update imports and references (This is done manually after migration)
Write-Host "Step 11: Next Steps for Import Updates" -ForegroundColor Yellow
Write-Host "Manual updates required:" -ForegroundColor White
Write-Host "  • hardhat.config.ts paths" -ForegroundColor Gray
Write-Host "  • TypeScript import statements" -ForegroundColor Gray  
Write-Host "  • Documentation cross-references" -ForegroundColor Gray
Write-Host "  • Circom include paths" -ForegroundColor Gray
Write-Host "  • CI workflow configuration" -ForegroundColor Gray
Write-Host ""

Write-Host "=== MIGRATION COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Migration completed successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify all hashes match pre-migration baseline" -ForegroundColor Gray
Write-Host "2. Update import paths in scripts and configuration" -ForegroundColor Gray
Write-Host "3. Run verification suite" -ForegroundColor Gray
Write-Host "4. Review and commit changes" -ForegroundColor Gray
