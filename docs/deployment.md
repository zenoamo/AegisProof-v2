# AegisProof Deployment Guide

**Scope:** This guide documents deployment **dry-runs** for:

- Local development (Hardhat fork / node)
- Ethereum Sepolia testnet
- Ethereum mainnet (read-only documentation; no deployment performed here)

**IMPORTANT:** No actual contract deployments to public chains occur in this document. All commands assume a read-only planning context unless you explicitly run them locally against your own infrastructure.

**Production readiness:** The production verifier smart contract generated from the Phase 4 production zkey is [`contracts/Groth16VerifierV2Production.sol`](../contracts/Groth16VerifierV2Production.sol). Its embedded IC constants are verified against `artifacts/phase4/final/production-vkey.json`. The final production verification key hash is:

```text
d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec
```

Do not deploy a different verifier that does not match these IC constants.

---

## Architecture notes

- The Shield uses an **immutable deployment model**. There are no proxy patterns or upgradeable contracts in Phase 5. Security is enforced through protocol versioning (`S.PROTOCOL_VERSION`).
- Two contract types exist:
  - **verifier contracts**: Groth16 verification logic (no auth, stateless).
  - **Shield contracts**: session management + proof acceptance policy (operator auth, replay protection).

---

## Local Development

### Prerequisites

- Node.js 22+ (local environment already configured via hardhat.config.ts)
- A Hardhat-compatible local network (the `default` built-in network provided by Hardhat 3)
- An available operator address to register sessions

### Step-by-step dry-run (local Hardhat node)

1. Install dependencies and compile:

   ```bash
   npm install
   npx hardhat compile
   ```

2. Deploy the production verifier **on-chain** in the same transaction sequence as Shields will use. Replace `<OPERATOR_ADDRESS>` with an account controlled in your local testnet.

   ```bash
   node scripts/deploy_local.mjs --network default \
     --verifier contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production \
     --operator <OPERATOR_ADDRESS>
   ```

   On the local Hardhat node, the verifier address will be printed along with bytecode verification confirmation (local-only). The script also confirms the IC hash matches the production vkey.

3. (Optional) Run the SDK integration smoke tests after deployment:

   ```bash
   npx hardhat run scripts/sdk_integration_test.mjs --network default
   ```

This entire flow uses the **local** ephemeral addresses and does not touch Sepolia or mainnet.

### Network configuration details

The `hardhat.config.ts` file configures:

- `networks.default`: in-process Hardhat node (no external URL), used for all local scripts.
- `networks.sepolia`: requires `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in `.env` for real testnet usage.
- `networks.mainnet`: placeholder configuration only; no keys or RPCs should ever be committed.

---

## Ethereum Sepolia Testnet

**Note:** Sepolia provides a live EVM environment with real gas fees and persistent state. Do not share private keys. Use a dedicated wallet for testing.

### Prerequisites

- Node.js 22+
- Sepolia RPC endpoint (Alchemy, Infura, or similar)
- Sepolia ETH for gas
- Private key of a wallet with sufficient balance

### Deploy producer verifier + shield

1. Ensure `.env` contains (do NOT commit):

   ```text
   SEPOLIA_RPC_URL=https://...
   PRIVATE_KEY=<your-test-wallet-key>
   OPERATOR_ADDRESS=0x... # the address authorized to manage sessions
   ```

2. Deploy the production verifier first. Store its address for later Shield deployment.

   ```bash
   node scripts/deploy_sepolia.mjs --network sepolia \
     --verifier contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production \
     --deployer-wallet $PRIVATE_KEY
   ```

   The script will print:

   - Verifier contract address (e.g., `0xAbc123...`)
   - Transaction hash for verification
   - IC hash verification message confirming it matches the production vkey

3. Deploy the Shield with the produced verifier address:

   ```bash
   node scripts/deploy_shield_sepolia.mjs --network sepolia \
     --verifier-address <VERIFIER_CONTRACT_ADDRESS> \
     --operator $OPERATOR_ADDRESS \
     --deployer-wallet $PRIVATE_KEY
   ```

4. Verify contracts on Etherscan (optional but recommended for transparency):

   ```bash
   npx hardhat verify --network sepolia <VERIFIER_ADDRESS>
   npx hardhat verify --network sepolia <SHIELD_ADDRESS>
   ```

5. Perform a **test end-to-end check** using the canonical witness vector and the production verifier.

   ```bash
   npx hardhat run test/Groth16VerifierV2Production.ts --network sepolia
   ```

---

## Ethereum Mainnet (documentation only; no deployment)

**DO NOT execute any deployment commands in this section.** These instructions exist only to clarify what would happen if a future authorization were granted.

If and when deployed, the steps mirror the Sepolia flow:

1. Configure `networks.mainnet` in `hardhat.config.ts` with a secure RPC and an HSM-backed or MPC-managed signer.
2. Deploy `Groth16VerifierV2Production.sol` → capture the address.
3. Deploy `AegisShieldV2` (or a mainnet-specific variant) pointing to that verifier address.
4. Record and sign off the verifier address and production VK hash together with the ceremony report.
5. Publish only the hashes and addresses; never publish keys or secrets.

The **current repository state remains non-deployed on mainnet.** Any future mainnet work requires separate human authorization and stakeholder review.

---

## Constructor parameters summary

### Verifier (stateless)

- None required; the verifier embeds its own IC constants into bytecode.

### Shield

| Parameter | Type | Description | Default policy value |
|---|---|---|---|
| `_verifierAddress` | `address` | Address of the verifier contract | Must point to Groth16VerifierV2Production.sol (IC hash d012bd29…) |
| `_operator` | `address` | Account allowed to register/session lifecycle changes | Human-selected; do not hardcode |

Additional constants baked into `AegisShieldV2.sol`:

- `SUPPORTED_PROTOCOL_VERSION = 2`
- `DEPLOYMENT_DOMAIN = keccak256("AEGIS_SHIELD_V2")`
- `MAX_AGE_seconds = 86400`
- `CLOCK_SKEW_seconds = 300`

---

## Verification checklist

Before running any live commands (even on Sepolia), verify:

1. [ ] Production verifier contract source matches `contracts/Groth16VerifierV2Production.sol`.
2. [ ] IC constants count equals 31 (Groth16, nPublic=30).
3. [ ] IC x-coordinates in the Solidity constant definitions equal the production vkey's IC array.
4. [ ] No secret keys or private keys committed.
5. [ ] Deployment dry-run on local Hardhat succeeds.
6. [ ] On-chain test passes on testnet (5/5 PASS expected).
7. [ ] Manifest verification passes: `node scripts/verify_manifest.mjs`.
8. [ ] CI gates pass: `node scripts/gates/run_all.mjs`.

---

## Incident response quick reference

See [`docs/incident-response.md`](./incident-response.md) for full procedures. Briefly:

- **Severity 1 (Critical):** immediate stop and rollback plan initiated; operator revocation prepared; community notification drafted within minutes.
- **Severity 2 (Moderate):** hotfix window scheduled; on-call rotation notified; post-incident review within 48 hours.
- **Severity 3 (Low):** backlog item queued; no emergency procedures triggered.

---

## Key management policy

Refer to [`docs/key-management-policy.md`](./key-management-policy.md). Highlights:

- Operator keys must be backed by HSM or MPC where feasible; rotate on schedule or sooner upon compromise risk.
- Logging of operational actions (session registries, deactivations) is mandatory for audits.
- Emergency disable procedure documented in the operational runbook.
