# AI Agent Authentication Example

Reference implementation of ZK-proof-based authentication for AI agents without exposing credentials.

**Status:** Reference implementation only (not for production)  
**Proofs used:** Production verification key (`d012bd29ff6e4c44...`)  

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   AI Agent      │────────▶│ AegisProof SDK   │────────▶│ Shield Contract  │
│   (Prover)      │         │ (Proof Generator)│         │ (Verifier)       │
└─────────────────┘         └──────────────────┘         └──────────────────┘
        │                           │                            │
        │  1. Generate proof        │ 2. Submit to contract      │ 3. Verify on-chain
        │     (secretKey + inputs)  │    verifyAndAccept()       │    returns result
        ▼                           ▼                            ▼
   [Private]                [Public]                     [Stateless]
   Never exposed           Sent via RPC                Accepts/rejects
```

### Components

1. **AI Agent**: Generates a ZK proof of credential knowledge without revealing the secret
2. **SDK wrapper**: Proof generation, calldata conversion, contract interaction
3. **Shield contract**: Validates the proof and registers an authenticated session

---

## Setup

### Prerequisites

- Node.js 22+ installed
- Access to Ethereum network (Sepolia testnet recommended)
- Deployed Groth16VerifierV2Production.sol contract address
- Compatible shield contract deployed

### Configuration Steps

1. **Clone repository and install dependencies:**
   ```bash
   git clone https://github.com/aegisproof/aegis-proof.git
   cd aegis-proof
   npm install
   ```

2. **Deploy contracts (testnet only):**
   ```bash
   node scripts/deploy_sepolia.mjs --network sepolia \
     --verifier contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production
   ```

3. **Create `.env` file (NEVER commit):**
   ```env
   # Sepolia testnet configuration
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   PRIVATE_KEY=<your-test-wallet-key>
   OPERATOR_ADDRESS=<operator-wallet-address>
   
   # Deployed contract addresses (after deployment)
   VERIFIER_ADDRESS=0xYourVerifierContractAddress
   SHIELD_ADDRESS=0xYourShieldContractAddress
   ```

4. **Register agent device:**
   - Obtain unique device identifier from your AI service provider
   - This becomes `deviceId` signal[3] in proofs

---

## Execution Flow

### Step 1: Prepare Agent Credentials

```javascript
// ai-agent-auth/prepare-credentials.js
import fs from "fs";

// Generate unique device identifier for this AI agent instance
const deviceId = `agent-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// Secret credential never exposed to network
// Stored securely in agent's local vault
const secretKey = process.env.AGENT_SECRET_KEY || "dev-secret-for-demo-only";

// Create identity record
const identity = {
  deviceId,
  secretKey, // Keep private!
  createdAt: new Date().toISOString(),
};

fs.writeFileSync("agent-identity.json", JSON.stringify(identity, null, 2));
console.log("Agent identity created:", identity.deviceId);
```

### Step 2: Generate ZK Proof

```javascript
// ai-agent-auth/generate-proof.js
import { buildPublicSignals, validateSignalCount } from "@aegisproof/sdk";

const identity = JSON.parse(fs.readFileSync("agent-identity.json"));
const timestamp = Math.floor(Date.now() / 1000);
const chainId = 11155111; // Sepolia
const sessionId = Date.now();
const purposeId = 1; // Agent authentication

// Build public signals object
const pubInput = {
  timestamp: timestamp.toString(),
  chainId: chainId.toString(),
  protocolVersion: "2",
  deviceId: identity.deviceId,
  commitment: computeCommitment(identity.secretKey, identity.deviceId, timestamp), // Poseidon(6)
  nullifier: computeNullifier(identity.secretKey, identity.deviceId, chainId, sessionId), // Poseidon(8)
  sessionId: sessionId.toString(),
  purposeId: purposeId.toString(),
  // Fill remaining indices 8-29 with defaults
};

for (let i = 8; i < 30; i++) {
  pubInput[`reserved_${i}`] = "0";
}

// Convert to array following SSoT order
const signals = buildPublicSignals(pubInput);
validateSignalCount(signals);

// Call witness calculator (using compiled WASM)
// Note: In production, load actual circuit generator
const proof = await generateGroth16Proof({
  privateInputs: { secretKey: identity.secretKey },
  publicSignals: signals,
});

fs.writeFileSync("agent-proof.json", JSON.stringify({
  proof,
  publicSignals: signals,
}, null, 2));

console.log("Proof generated successfully");
```

### Step 3: Submit to Smart Contract

```javascript
// ai-agent-auth/submit-proof.js
import { createPublicClient, http } from "viem";
import * as sdk from "@aegisproof/sdk";

const proofData = JSON.parse(fs.readFileSync("agent-proof.json"));
const client = createPublicClient({
  transport: http(process.env.SEPOLIA_RPC_URL),
});

// Load proof structure
const proof = typeof proofData.proof !== "undefined" ? proofData.proof : proofData;
const signals = Array.isArray(proofData.publicSignals) 
  ? proofData.publicSignals.map((s) => s.toString()) 
  : [];

// Estimate gas cost
const gasEstimate = await sdk.estimateVerifyGas(
  client,
  process.env.SHIELD_ADDRESS,
  proof,
  signals
);

console.log("Estimated gas:", gasEstimate.toString(), "wei");

// Submit verification request (read-only view call)
const result = await sdk.verifyOnChain(
  client,
  process.env.VERIFIER_ADDRESS,
  proof,
  signals
);

if (!result.success) {
  console.error("Verification failed:", result.context?.error);
  process.exit(1);
}

console.log("✓ Proof verified on-chain");

// If successful, register session (requires operator authorization)
// This step would be performed by operator wallet, not AI agent directly
console.log("✅ AI Agent authentication complete");
console.log("Session ID:", signals[6]); // Signal index 6 = sessionId
```

---

## Expected Inputs and Outputs

### Input Data

| Field | Type | Description | Required |
|---|---|---|---|
| `secretKey` | string | Agent's long-term secret credential | Yes |
| `deviceId` | string | Unique device identifier (UUID format) | Yes |
| `timestamp` | number | Unix timestamp (seconds) | Yes |
| `chainId` | number | Blockchain chain identifier | Yes |
| `sessionId` | number | Session-specific identifier | Yes |
| `purposeId` | number | Purpose/application identifier | Yes |

### Output Results

**Successful verification:**
```json
{
  "success": true,
  "gasEstimate": "150000",
  "verificationHash": "0x...",
  "signals": ["1722850000", "11155111", "2", ...], // 30 values
  "message": "Proof verified successfully"
}
```

**Failed verification reasons:**
```json
{
  "success": false,
  "errorCode": "INVALID_SIGNAL_COUNT",
  "context": { "expected": 30, "actual": 29 },
  "message": "Expected 30 public signals, but got 29"
}
```

---

## Security considerations

### Recommended practices

1. **Secret Key Storage:**
   - Use hardware-backed secure enclave when available
   - Never store secrets in plaintext files
   - Rotate credentials every 90 days minimum
   - Use separate keys per device instance

2. **Timestamp Management:**
   - Ensure device clock synchronized via NTP
   - Allow ±5 minute clock skew tolerance (configured in contract)
   - Reject proofs with timestamps >24 hours old

3. **Session Binding:**
   - Include unique sessionId in each proof
   - Track issued sessions server-side
   - Implement session expiration policy

4. **Network Security:**
   - Always transmit via HTTPS/TLS
   - Validate contract addresses before submission
   - Monitor for replay attacks across chains

5. **Error Handling:**
   - Never expose error context to user-facing interfaces
   - Log detailed errors server-side for debugging
   - Provide generic messages to end users ("Authentication failed")

### Anti-patterns

- **Hardcoding secrets in source code** → Use environment variables or secure vault
- **Reusing same sessionId multiple times** → Each proof should use fresh sessionId
- **Ignoring chainId validation** → Attacker could replay proof on different network
- **Skipping timestamp window checks** → Old proofs become stale/expired
- **Embedding private keys in config files** → Secrets must remain cryptographically protected

---

## Known limitations

### Implementation constraints

1. **Reference Code Only:**
   - Example does NOT implement actual circuit proving (requires WASM integration)
   - Uses placeholder `generateGroth16Proof()` function
   - Actual implementation requires loading `aegis_commit_core_v2_js/witness_calculator.js`

2. **No Hardware Integration:**
   - Does not interface with secure enclaves (TPM, HSM, Apple Secure Enclave)
   - Developers must implement their own secure storage layer

3. **Single-Agent Assumption:**
   - Designed for one device per credential
   - Multi-device scenarios require additional session management logic

4. **Proof Generation Performance:**
   - Local proof generation can take 2-5 seconds depending on hardware
   - Not suitable for real-time authentication workflows (<100ms latency requirements)

5. **Operator Dependency:**
   - Final authentication approval requires operator wallet signature
   - Cannot operate fully autonomously without operator infrastructure

6. **Gas Cost Variability:**
   - On-chain verification costs fluctuate with Ethereum mainnet gas prices
   - Testnet usage incurs minimal cost; mainnet could exceed $1-5 per verification during congestion

---

## Testing Guide

### Unit Tests

Run example-specific tests:
```bash
npm test -- ai-agent-auth.test.js
```

Expected output:
```
✓ Proof generation validates signal count
✓ G2 coordinate swap produces correct Solidity format
✓ Verifier rejects tampered inputs
✓ Operator registration creates session mapping
```

### Integration Tests

Test end-to-end flow on testnet:
```bash
node ai-agent-auth/e2e-test-sepolia.js
```

Expected flow:
1. Deploy verifier + shield to Sepolia
2. Generate test proof with known-good input
3. Submit to contract
4. Verify acceptance and session creation
5. Attempt replay attack (should fail)

---

## Future work

Possible extensions (not implemented):

1. **Batch Verification:**
   - Aggregate multiple agent authentications in single transaction
   - Reduce per-agent gas cost by factor of N

2. **Hardware Wallet Support:**
   - Integrate with Ledger/Trezor for secure credential storage
   - Sign challenges using device keys instead of hardcoded secrets

3. **Biometric Binding:**
   - Extend circuit to bind proof to biometric hash
   - Add facial recognition/fingerprint verification layer

4. **Revocation List:**
   - Implement CRL-style expired credential tracking
   - Support efficient zero-knowledge revocation proofs

5. **Cross-Chain Bridge:**
   - Enable agent authentication across multiple blockchains
   - Use bridged sessions with atomic transfers

---

## References

- AegisProof SDK: [`packages/sdk/src/core.ts`](../packages/sdk/src/core.ts)
- Production verifier: `contracts/Groth16VerifierV2Production.sol`
- Deployment guide: [`docs/deployment-mainnet.md`](../../docs/deployment-mainnet.md)
- Security model: [`docs/security-model.md`](../../docs/security-model.md)

---

## Disclaimer

This example is for educational purposes only.

- Not tested for production workloads
- No formal security audit on the example code
- Implementers are responsible for their own security measures
- Do not use default credentials shown in comments
- Conduct an independent security review before mainnet deployment
