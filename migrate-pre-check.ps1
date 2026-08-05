# Migration Execution Script - PowerShell

# Record pre-migration hashes
Write-Host "Recording pre-migration hashes..." -ForegroundColor Green

$artifacts = @(
    "artifacts/phase4/final/production-zkey",
    "artifacts/phase4/final/production-vkey.json",
    "circuits/aegis_commit_core.r1cs",
    "circuits/aegis_commit_core.sym",
    "artifacts/phase2/r1cs/aegis_commit_core_v2.r1cs"
)

foreach ($artifact in $artifacts) {
    if (Test-Path $artifact) {
        $hash = (Get-FileHash $artifact -Algorithm SHA256).Hash.ToLower()
        Write-Output "$hash  $artifact" >> migration-hashes-before.txt
        Write-Host "✅ Recorded hash for $artifact" -ForegroundColor Gray
    }
}
