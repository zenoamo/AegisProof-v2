# AegisProof Getting Started

**Prerequisites:** Node.js 22+, npm/pnpm/yarn.  
**Goal:** Set up a local development environment and run the repository's canonical verification flow.

> **Deployment boundary:** The repository currently has an executable **local Hardhat fixture only**. Sepolia and Mainnet deployment are authorization-gated and have no committed executable deployment path. Do not copy local addresses into a live-network configuration.

## Installation

```bash
git clone https://github.com/zenoamo/AegisProof-v2.git
cd AegisProof-v2
npm install
npx hardhat compile
```

## Local verification workflow

### 1. Prepare and verify canonical artifacts

Use the repository's existing verification scripts:

```bash
node scripts/phase2_verify.mjs --fast
node scripts/phase2_verify.mjs --full
node scripts/phase4_verify_production.mjs
```

The production flow uses the pinned production artifacts. Never promote the development zkey/VK into a production deployment.

### 2. Deploy the local fixture

Start the local Hardhat network, then run:

```bash
npx hardhat run scripts/deploy.ts
```

The script deploys the development `Groth16VerifierV2`, the canonical local `AegisNullifierRegistry`, and `AegisShieldV2`. It also checks the deterministic Hardhat registry address and authorizes the Shield in the shared registry.

This is a **development fixture only**. The production verifier is not deployed by this script.

### 3. Verify the on-chain path

Use the repository's integration/security tests after the local deployment. The canonical 30-signal order is defined by `specs/aegis-protocol.v2.json` and the generated `AegisSignals.sol`; do not hand-write signal indices in application code.

The SDK validates the 30-signal shape and BN254 field bounds before ABI conversion.

## Sepolia

**Status: authorization-gated; no executable Sepolia deployment path is currently committed.**

Before any live testnet deployment is authorized, the chain entry must be added to `deployments/manifest.json`, the canonical registry address must be independently verified and pinned in `AegisCanonicalRegistry`, and the production verifier/Shield addresses and required bytecode hashes must be recorded.

Validate the manifest with:

```bash
npm run validate:deployment-manifest
```

Do not invent or reuse local 31337 addresses.

## TypeScript SDK

Use the SDK's canonical signal builder and validation helpers rather than maintaining a second signal layout:

```typescript
import {
  buildPublicSignals,
  validateSignalValues,
} from "@aegisproof/sdk";

const signals = buildPublicSignals(inputMap);
validateSignalValues(signals);
```

For an RPC-backed verifier client, call the SDK's chain-binding assertion before relying on configured chain metadata.

## Security reminders

- Do not commit private keys, seed phrases, or real credentials.
- Do not use the development verifier/zkey for production.
- Treat `timestamp` as untrusted metadata; freshness is enforced by the Shield contract.
- Preserve the canonical 30-signal order from the SSoT.
- Before any live deployment, independently verify the deployment manifest, verifier artifacts, canonical registry, and on-chain bytecode.
