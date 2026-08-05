# AegisProof Deployment Checklist

**Purpose**: Ensure production readiness before any live deployment.  
**Status**: Phase 5 ready (no deployments performed yet).

---

## Pre-deployment checklist

- [ ] Production VK hash verified: `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`
- [ ] Production verifier contract IC constants cross-checked (31/31 match)
- [ ] Manifest verification passes: `node scripts/verify_manifest.mjs` (expect 28/28 PASS)
- [ ] All gates pass: `node scripts/gates/run_all.mjs` (expect 42/42 PASS)
- [ ] Dev zkey/vkey excluded from deployment artifacts
- [ ] No secrets committed to repository
- [ ] Operator wallet configured with HSM/MPC (preferred) or secure signing environment
- [ ] Testnet dry-run successful (Sepolia 5/5 PASS on-chain tests)

---

## Deployment steps

### 1. Local Hardhat dry-run
- [ ] Deploy verifier (`Groth16VerifierV2Production.sol`)
- [ ] Deploy shield with verifier address and operator
- [ ] Run test suite (local)
- [ ] Verify bytecode matches expected

### 2. Sepolia testnet
- [ ] Set `.env` with RPC and wallet key (never commit)
- [ ] Deploy verifier → capture address TX hash
- [ ] Deploy shield with captured verifier address
- [ ] Etherscan verification
- [ ] On-chain tests pass (5/5)

### 3. Mainnet (future authorization required)
- [ ] Stakeholder review completed
- [ ] Independent contribution ceremony extension recommended (changes VK)
- [ ] Deploy verifier + shield with MPC signer
- [ ] Post-deployment monitoring setup (alerts for failures, unusual patterns)

---

## Post-deployment validation

- [ ] Monitor first N proofs accepted/rejected
- [ ] Verify timestamp window enforcement active
- [ ] Check used-nullifier set behavior (replay rejection)
- [ ] Record deployed addresses in secure location
- [ ] Document operator contact information
- [ ] Configure logging/alerting system

---

## Rollback procedures (not applicable - immutable contracts)

Since contracts are **immutable**, rollback means deploying a new Shield instance with updated logic. The old verifier remains valid; coordinate deprecation through protocol versioning.
