# AI Agent Authentication Example

Reference implementation of ZK-proof-based authentication for AI agents without exposing credentials.

**Status:** Reference/example only; not a production deployment package.

> **Important:** This example does not provide a Sepolia deployment command or fabricated contract addresses. Use only independently verified addresses from an authorized deployment manifest.

## Architecture

```
AI Agent → AegisProof SDK → Shield Contract
  private       proof           verifier + policy
  inputs       calldata         + replay registry
```

## Setup

### Prerequisites

- Node.js 22+
- Repository dependencies installed
- A verified deployment obtained through the project's authorized deployment process

The current repository has a local Hardhat deployment path:

```bash
npx hardhat run scripts/deploy.ts
```

This deploys the **development** verifier and is for local testing only. It is not a production deployment path.

For live networks, read addresses from the independently verified `deployments/manifest.json` entry. Do not invent or reuse local addresses.

## Credential handling

Never use a default or fallback credential.

```javascript
const secretKey = process.env.AGENT_SECRET_KEY;
if (!secretKey) {
  throw new Error("AGENT_SECRET_KEY is required");
}

// Keep the credential in memory only as long as necessary.
// Do not write it to logs, source control, or an unencrypted file.
```

## Proof and public signals

The canonical public-signal layout contains exactly **30 signals** and is defined by `specs/aegis-protocol.v2.json`.

Do not hardcode historical indices such as `signals[6]`. Build and validate signals through the SDK/SSoT:

```typescript
import { buildPublicSignals, validateSignalValues } from "@aegisproof/sdk";

const signals = buildPublicSignals(inputMap);
validateSignalValues(signals);
```

The frozen v2 nullifier is Poseidon(8) over:

- `AEGIS_NULLIFIER_V2` domain separator
- `secretKey`
- `deviceId`
- `purposeId`
- `sessionId`
- `commitment`
- `protocolVersion`
- `chainId`

The Shield additionally enforces the chain ID against `block.chainid`, validates session/purpose state, and consumes the nullifier through the canonical chain-wide registry.

## On-chain verification

Use independently verified contract addresses from the deployment manifest. Before using configured SDK chain metadata, verify that the RPC client is actually connected to the expected chain.

The Shield's `verifyAndAccept()` path is operator-authorized and includes session, purpose, timestamp-window, and replay checks.

## Security considerations

- Store credentials in an appropriate secret manager or secure enclave where available.
- Never commit private keys or agent secrets.
- Do not use the development verifier/zkey for production.
- Do not hand-maintain a second 30-signal layout.
- Treat `timestamp` as untrusted metadata; the contract applies the freshness window.
- Validate the target chain and contract addresses before submitting proofs.
- Treat this repository example as educational/reference code, not as a production authentication framework.

## Known limitations

This example intentionally does not implement a complete production agent credential system, hardware integration, or live deployment automation. Any production integration requires separate threat modeling, key-management review, deployment authorization, and end-to-end testing.

## References

- SDK: `packages/sdk/src/core.ts`
- Production verifier source: `protocol/contracts/Groth16VerifierV2Production.sol`
- Deployment manifest: `deployments/manifest.json`
- Deployment guide: `docs/deployment.md`
