# AegisProof Deployment Guide

**Scope:** This guide documents the repository's current deployment tooling and authorization-gated deployment procedures for:

- Local Hardhat development (executable via `scripts/deploy.ts`)
- Ethereum Sepolia testnet (procedure only; no executable Sepolia deployment script is currently committed)
- Ethereum mainnet (read-only procedure; **no deployment performed**)

**Status:** Production artifacts are **pinned**; **mainnet deployment is NOT ACTIVE / NOT VERIFIED**. The local script is a development fixture and deploys the dev verifier. Sepolia/Mainnet deployment remains authorization-gated until executable tooling and manifest entries are added.

**Production readiness:** The production verifier smart contract generated from the Phase 4 production zkey is [`protocol/contracts/Groth16VerifierV2Production.sol`](../protocol/contracts/Groth16VerifierV2Production.sol). Its embedded IC constants are verified against `artifacts/phase4/final/production-vkey.json`. The final production verification key hash is:

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

2. Run the repository's local deployment script:

   ```bash
   npx hardhat run scripts/deploy.ts
   ```

   This script intentionally deploys the **dev** `Groth16VerifierV2` plus the canonical local registry and `AegisShieldV2`. It is a local fixture only; it is **not** a production deployment path. The script fails closed if the deterministic Hardhat canonical registry address drifts.

   The local flow uses one `AegisNullifierRegistry` for the chain and authorizes the deployed Shield in that registry.

3. Use `deployments/manifest.json` as the canonical deployment metadata source. The current manifest marks chain 31337 as a non-deployable local fixture and intentionally leaves production/testnet addresses unset.

4. (Optional) Run the SDK integration smoke tests after deployment:

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

**Status: authorization-gated; no executable Sepolia deployment path is currently committed.** Do not treat documentation alone as evidence that a Sepolia deployment exists.

Before any Sepolia deployment is authorized, the repository must first register a chain entry in `deployments/manifest.json` containing the canonical registry address, production verifier address, Shield address, and required bytecode hashes. `AegisCanonicalRegistry` must also be updated for the supported chain so the Shield constructor fails closed on registry drift.

The future deployment procedure is:

1. Use an authorized deployment wallet through a reviewed deployment script.
2. Deploy `Groth16VerifierV2Production.sol` and record its address and bytecode hash.
3. Deploy `AegisNullifierRegistry` and `AegisShieldV2` using the chain's pinned canonical registry.
4. Authorize the Shield in the registry.
5. Run the production verifier/on-chain regression suite against the deployed addresses.
6. Update and validate `deployments/manifest.json` only after independently verifying the deployed addresses and hashes.

Do not copy local 31337 addresses into a Sepolia manifest entry.

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
| `_nullifierRegistry` | `address` | Shared chain-wide replay registry | One registry per chain; reuse across all Shield deployments |

Additional constants baked into `AegisShieldV2.sol`:

- `SUPPORTED_PROTOCOL_VERSION = 2`
- `DEPLOYMENT_DOMAIN = keccak256("AEGIS_SHIELD_V2")` (protocol identifier; not deployment-unique)
- Cross-deployment replay protection is enforced by the shared `AegisNullifierRegistry`.
- `MAX_AGE_seconds = 86400`
- `CLOCK_SKEW_seconds = 300`

---

## Verification checklist

Before running any live commands (even on Sepolia), verify:

1. [ ] Production verifier contract source matches `protocol/contracts/Groth16VerifierV2Production.sol`.
2. [ ] IC constants count equals 31 (Groth16, nPublic=30).
3. [ ] IC x-coordinates in the Solidity constant definitions equal the production vkey's IC array.
4. [ ] No secret keys or private keys committed.
5. [ ] Deployment dry-run on local Hardhat succeeds.
6. [ ] On-chain test passes on testnet (5/5 PASS expected).
7. [ ] Deployment manifest validation passes: `npm run validate:deployment-manifest`.
8. [ ] Artifact provenance verification passes: `npm run verify:provenance -- --live` (when live artifact storage is configured).
9. [ ] CI security gates pass.

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
