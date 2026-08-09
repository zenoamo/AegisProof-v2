# AegisProof Production Deployment Plan — Ethereum Mainnet

**Status:** Readiness documentation only (no deployments performed)  
**Authorized scope:** Dry-run planning and validation procedures  
**Production VK hash:** `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`  

---

## Executive Summary

This document outlines the deployment plan for AegisProof v2 on Ethereum mainnet. No deployment has been performed; this is a **readiness package** for stakeholder review and independent auditor verification.

**Critical constraint:** All deployments require explicit human authorization. This document describes procedures only.

---

## Pre-Deployment Checklist

### Cryptographic Artifact Verification

Before any deployment commands are executed, verify:

1. ✅ Production zkey hash matches:
   ```text
   ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571
   ```

2. ✅ Production VK hash matches:
   ```text
   d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
   ```

3. ✅ IC constants count = 31 (Groth16 with vk_alpha_1)

4. ✅ All IC points lie on BN128 curve (verified during Phase 4 ceremony)

5. ✅ Manifest verification passes: `node scripts/verify_manifest.mjs` → 28/28 PASS

If ANY of these checks fail, STOP and investigate before proceeding.

---

## Contract Deployment Order

### Step 1: Deploy Verifier Contract

**Contract:** `Groth16VerifierV2Production.sol`

**Constructor parameters:** None (IC constants baked into bytecode during contract generation)

**Deployment command (dry-run):**
```bash
npx hardhat run scripts/deploy_verifier_mainnet.mjs \
  --network mainnet \
  --verifier contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production
```

**Expected output:**
- Verifier contract address (e.g., `0xAbc123...`)
- Transaction hash
- Bytecode verification confirmation
- IC hash validation message

**Post-deployment verification:**
```solidity
// Verify via Etherscan or direct call
contractVerifier.verifierAddress() == <deployed_address>
```

**Security note:** Verifier contracts are stateless and immutable. Once deployed, they cannot be upgraded.

---

### Step 2: Deploy Shield Contract

**Contract:** `AegisShieldV2.sol`

**Constructor parameters:**
| Parameter | Type | Value | Description |
|---|---|---|---|
| `_verifierAddress` | `address` | <from step 1> | Address of deployed verifier |
| `_operator` | `address` | `<operator_wallet>` | Account authorized for session management |

**Deployment command (dry-run):**
```bash
npx hardhat run scripts/deploy_shield_mainnet.mjs \
  --network mainnet \
  --verifier-address <VERIFIER_CONTRACT_ADDRESS> \
  --operator <OPERATOR_WALLET_ADDRESS>
```

**Constants baked into Shield:**
- `SUPPORTED_PROTOCOL_VERSION = 2`
- `DEPLOYMENT_DOMAIN = keccak256("AEGIS_SHIELD_V2")`
- `MAX_AGE_seconds = 86400` (24 hours)
- `CLOCK_SKEW_seconds = 300` (5 minutes)

**Post-deployment verification:**
```solidity
// Call view functions
shield.protocolVersion() == 2
shield.operator() == <operator_wallet>
shield.supportsInterface(0x... ) // If implementing ERC165
```

---

## Operator Wallet Requirements

### Security Requirements

The operator wallet (authorized to register/deactivate sessions) MUST meet these requirements:

1. **Hardware-backed signing:** HSM or MPC device preferred
2. **Multi-signature approval:** Minimum 2-of-3 signers recommended for critical operations
3. **Rotation schedule:** Rotate keys every 90 days or sooner upon compromise risk
4. **Logging:** Log all operator actions (who, when, what, why)
5. **Backup:** Secure offline backup of private key material

### Recommended Configuration

**Primary operator:** HSM-backed single signer  
**Secondary operator:** Multi-sig wallet (3-of-5 governance)  
**Emergency contact:** Time-locked emergency disable procedure via multi-sig

---

## Gas Estimation

### Estimated Gas Costs (Mainnet)

| Operation | Estimated Gas | Notes |
|---|---|---|
| Verifier deployment | ~2,500,000 | Stateless contract, no constructor params |
| Shield deployment | ~3,000,000 | Includes initial storage writes |
| registerSession() | ~80,000 | Writes session mapping |
| deactivateSession() | ~50,000 | Reads existing session |
| setPurposeAllowed() | ~40,000 | Updates purpose boolean |
| verifyAndAccept() | ~150,000 | Depends on proof complexity |

**WARNING:** Actual gas costs will vary based on network congestion. Always perform a testnet dry-run first.

---

## Verification Procedures

### On-Chain Verification Steps

After deployment, execute these validation checks:

1. **Verifier contract check:**
   ```bash
   curl -X POST https://mainnet.infura.io/v3/<YOUR_KEY> \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"<VERIFIER_ADDRESS>","data":"0x..."},"latest"],"id":1}'
   ```

2. **Shield configuration check:**
   - Confirm `protocolVersion()` returns 2
   - Verify `operator()` matches expected address
   - Check `supportedProtocols()` array includes version 2

3. **Nullifier replay protection test:**
   - Submit same nullifier twice
   - Second attempt must revert with "already used" error

4. **Timestamp window enforcement test:**
   - Submit proof with timestamp > now + SKEW → should fail
   - Submit proof with timestamp < now - MAX_AGE - SKEW → should fail

---

## Monitoring & Alerting

### Recommended Metrics

Set up monitoring for:

1. **Verification failure rate:** Alert if >5% of proofs rejected
2. **Nullifier collision rate:** Alert on any duplicates (indicates potential issue)
3. **Gas price spikes:** Alert when gas > 100 gwei
4. **Operator activity logs:** Log every `registerSession`, `deactivateSession`, `setPurposeAllowed`
5. **Unexpected reverts:** Capture all revert reasons for analysis

### Suggested Alert Channels

- **Severity 1 (Critical):** SMS + PagerDuty + Slack
- **Severity 2 (Moderate):** Email + Slack
- **Severity 3 (Low):** Daily digest email

---

## Rollback Procedures

Since contracts are **immutable**, rollback means deploying a new instance:

### Emergency Deactivation Procedure

If critical vulnerability discovered:

1. **Stop acceptance** immediately via `setPurposeAllowed(purposeId, false)` for all active purposes
2. **Notify stakeholders** via pre-defined communication channels
3. **Deploy new shield** with updated logic (requires explicit authorization)
4. **Migrate users** to new shield address (documentation required)
5. **Document incident** in post-mortem report

**Note:** Verifier contract cannot be disabled; it remains valid indefinitely. Only Shield accepts/rejects proofs.

---

## Stakeholder Sign-Off Required

Before executing ANY deployment commands:

| Role | Signature | Date | Notes |
|---|---|---|---|
| Technical Lead | _________ | _________ | ____________ |
| Security Reviewer | _________ | _________ | ____________ |
| Operations Lead | _________ | _________ | ____________ |
| Business Sponsor | _________ | _________ | ____________ |

---

## Post-Deployment Tasks

Once deployment completes successfully:

1. ✅ Record contract addresses in secure location (secret manager, not Git)
2. ✅ Publish verified contract links on official documentation
3. ✅ Update CI/CD pipelines with new addresses (if applicable)
4. ✅ Configure monitoring and alerting
5. ✅ Document operator contact information
6. ✅ Schedule follow-up review (30 days post-deployment)

---

## References

- Full protocol spec: [`protocol/specs`](../protocol/specs)
- Security model: [`architecture/github-security-boundary.md`](./architecture/github-security-boundary.md)
- Incident response: [`incident-response.md`](../incident-response.md)
- Key management policy: [`key-management-policy.md`](../key-management-policy.md)

---

## Important Warnings

⚠️ **DO NOT DEPLOY TO MAINNET WITHOUT FULL STAKEHOLDER REVIEW**

⚠️ **ALL PRIVATE KEYS MUST BE STORED SECURELY (NEVER IN GIT)**

⚠️ **VERIFY CONTRACT BYTECODE AGAINST LOCAL COMPILATION BEFORE DEPLOYING**

⚠️ **TEST ON SEPOLIA FIRST; DO NOT SKIP TESTNET VALIDATION**

**This document does NOT authorize deployment.** Explicit human authorization required before any deployment commands are executed.
