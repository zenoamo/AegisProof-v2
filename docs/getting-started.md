# AegisProof Getting Started

**Prerequisites:** Node.js 22+, npm/pnpm/yarn.  
**Goal:** Set up a local development environment and run your first verification end to end.

---

## Installation

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/aegisproof/aegis-proof.git
   cd aegis-proof
   npm install
   ```

2. Compile contracts:

   ```bash
   npx hardhat compile
   ```

---

## Local verification workflow (offline-capable)

### Step 1: Prepare input data

Use the canonical test vector located at [`artifacts/phase2/tests/input_v2.json`](../artifacts/phase2/tests/input_v2.json):

```json
{
  "secretKey": "123456789",
  "deviceId": "device-001",
  "timestamp": 1754300000,
  "chainId": 31337,
  "sessionId": 777,
  "purposeId": 42,
  "commitment": "...",
  "nullifier": "..."
}
```

These values are **public test vectors**; never commit real private keys to production systems.

### Step 2: Generate witness and prove

Using the `phase2_verify.mjs` script (FAST mode for sanity checks; FULL for complete cycle including proving):

```bash
# Witness generation + sanity checks only (no setup required)
node scripts/phase2_verify.mjs --fast

# Full flow: generates baseline proof using dev zkey (for testing only)
node scripts/phase2_verify.mjs --full
```

To produce proofs with the **production zkey**, use the dedicated script:

```bash
node scripts/phase4_verify_production.mjs
```

### Step 3: Verify off-chain (snarkjs)

```bash
import snarkjs from "snarkjs";

const vkey = JSON.parse(fs.readFileSync("artifacts/phase4/final/production-vkey.json"));
const { proof, publicSignals } = JSON.parse(fs.readFileSync("artifacts/phase4/reports/production_proof_baseline.json"));

const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
console.assert(ok, "verification failed");
```

### Step 4: On-chain verification (local Hardhat node)

The on-chain verifier accepts the same proof:

```typescript
import { viem } from "hardhat";

const [client] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

const proofCalldata = /* convert proof to calldata format */;
const signals = /* convert public signals to uint[30][] */;

const verifierContract = /* deploy Groth16VerifierV2Production.sol locally */;
const result = await verifierContract.read.verifyProof(proofCalldata.pA, proofCalldata.pB, proofCalldata.pC, signals);
console.assert(result === true, "contract verify failed");
```

---

## Sepolia dry-run

Set `.env` with a testnet RPC and a test wallet key (do NOT commit):

```bash
SEPOLIA_RPC_URL=https://...
PRIVATE_KEY=<test-wallet-key>
```

Deploy verifier + shield:

```bash
node scripts/deploy_sepolia.mjs --network sepolia \
  --verifier contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production
npx hardhat run test/Groth16VerifierV2Production.ts --network sepolia
```

---

## Using the TypeScript SDK

Install SDK (scaffold in this repo):

```bash
npm install @aegisproof/sdk
```

Basic usage:

```typescript
import { grothProofToCalldata, buildPublicSignals, VerificationError } from "@aegisproof/sdk";

// Load proof
const bundle = JSON.parse(fs.readFileSync("path/to/proof.json"));
const proof = bundle.proof;
const signals = buildPublicSignals(bundle.inputMap); // map named signals -> array

// Off-chain verification helper
const client = createPublicClient({ chain: mainnet, transport: http() });
const ok = await offChainVerify(client, verifierAddress, proof, signals);
console.assert(ok, "off-chain check failed");

// Estimate gas for on-chain call
const gas = await estimateVerifyGas(client, verifierAddress, proof, signals);
console.log("estimated gas:", gas.toString());
```

---

## Common pitfalls

- **Do not promote dev zkey/VK to production**. The production VK hash is `d012bd29…`; ensure all contracts use IC constants matching this.
- **Do not commit secrets**. Use `.env` for keys; add it to `.gitignore`.
- **Timestamp policy**: the circuit does not constrain timestamp; freshness checked contract-side within window.
- **IC binding**: tampering of public signals breaks Groth16 verification; never swap post-prove inputs.
