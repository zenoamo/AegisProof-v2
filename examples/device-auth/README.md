# Device Authentication Example

Reference implementation for ZK-proof-based hardware device identity validation. Not production-ready.

---

## Architecture

```
Device Identity Proof Flow:

┌──────────────┐    Proof ──▶  ┌──────────────┐    Session ──▶  ┌──────────────┐
│ Physical     │               │ AegisProof   │                 │ Shield       │
│ Device       │◀── Response ─│ SDK Client   │◀── Submit Proof ─│ Contract     │
│ (Prover)     │               │ (Witness)    │                 │ (Verifier)   │
└──────────────┘               └──────────────┘                 └──────────────┘
```

## Setup

1. **Deploy contracts to testnet** (Sepolia recommended):

   ```bash
   npx hardhat run scripts/deploy_sepolia.mjs --network sepolia
   ```

2. **Configure environment variables**:

   ```env
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   VERIFIER_ADDRESS=0x... # from deployment
   DEVICE_SERIAL="DEV-ABC-123" # Your device serial number
   ```

3. **Run device registration**:

   ```bash
   node device-auth/register-device.js
   ```

## Execution flow

### Step 1: Generate device proof

- Input: device serial number and embedded secret key
- Process: compute commitment = Poseidon([serial, secret, timestamp])
- Output: Groth16 proof and public signals

### Step 2: Submit for verification

- Call `verifyAndAccept()` on the shield contract
- Contract validates chain ID matches the current network
- Check timestamp is within the acceptable window
- Reject if the nullifier is already in the used-nullifiers set

### Step 3: Register session

- Operator confirms device legitimacy
- Create session mapping: deviceId → sessionId
- Return a session token for subsequent requests

## Security considerations

Do:

- Store device secrets in a secure enclave (TPM/HSM)
- Rotate device keys annually
- Monitor for duplicate submissions across chains

Do not:

- Hardcode device credentials in firmware
- Reuse the same device identifier across multiple installations
- Skip timestamp validation

## Known limitations

- Requires physical access to the device for initial setup
- Device must have persistent storage for secret keys
- On-chain registration incurs gas cost (~80k gas per session)
