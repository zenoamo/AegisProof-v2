# AegisProof Deployment Checklist

**Purpose:** Confirm production readiness before any live deployment.  
**Status:** Phase 5 ready (no deployments performed).

---

## Pre-deployment checklist

- [ ] Production VK hash verified: `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`
- [ ] Production verifier contract IC constants cross-checked (31/31 match)
- [ ] Deployment manifest validation passes: `npm run validate:deployment-manifest`
- [ ] All gates pass: `node scripts/gates/run_all.mjs` (expect 42/42 PASS)
- [ ] Dev zkey/vkey excluded from deployment artifacts
- [ ] No secrets committed to repository
- [ ] Operator wallet configured with HSM/MPC (preferred) or secure signing environment
- [ ] Testnet dry-run successful (Sepolia 5/5 PASS on-chain tests)

---

## Deployment steps

### 1. Local Hardhat dry-run
- [ ] Run `npx hardhat run scripts/deploy.ts`
- [ ] Confirm this is the **dev verifier** local fixture, not a production deployment
- [ ] Confirm canonical registry address matches `deployments/manifest.json`
- [ ] Run the local regression suite
- [ ] Verify deployed bytecode is present and constructor state matches expected addresses

### 2. Sepolia testnet (authorization-gated)
- [ ] Authorized deployment tooling exists and has passed review
- [ ] Add the Sepolia chain entry to `deployments/manifest.json`
- [ ] Pin the canonical registry in `AegisCanonicalRegistry`
- [ ] Deploy production verifier and capture address + bytecode hash
- [ ] Deploy canonical registry + Shield and capture addresses + hashes
- [ ] Authorize the Shield in the registry
- [ ] Etherscan verification
- [ ] On-chain tests pass
- [ ] Re-run manifest validation after recording independently verified addresses

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

Since contracts are **immutable**, rollback means deploying a new Shield instance with updated logic. The existing verifier remains valid; coordinate deprecation through protocol versioning.
