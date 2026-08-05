# Device Authentication Example

**Purpose:** ZK-proof verification for hardware device identity validation  
**Status:** Reference implementation (not production-ready)  

---

## Architecture Overview

```
Device Identity Proof Flow:

┌──────────────┐    Proof ──▶  ┌──────────────┐    Session ──▶  ┌──────────────┐
│ Physical     │               │ AegisProof   │                 │ Shield       │
│ Device       │◀── Response ─│ SDK Client   │◀── Submit Proof ─│ Contract     │
│ (Prover)     │               │ (Witness)    │                 │ (Verifier)   │
└──────────────┘               └──────────────┘                 └──────────────┘
```

## Setup Instructions

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

## Execution Flow

### Step 1: Generate Device Proof
- Input: Device serial number + embedded secret key
- Process: Compute commitment = Poseidon([serial, secret, timestamp])
- Output: Groth16 proof + public signals

### Step 2: Submit for Verification
- Call `verifyAndAccept()` on shield contract
- Contract validates chainID matches current network
- Check timestamp within acceptable window
- Reject if nullifier already in used-nullifiers set

### Step 3: Register Session
- Operator confirms device legitimacy
- Create session mapping: deviceId → sessionId
- Return session token for future requests

## Security Considerations

✅ **Do:**
- Store device secrets in secure enclave (TPM/HSM)
- Rotate device keys annually
- Monitor for duplicate submissions across chains

❌ **Don't:**
- Hardcode device credentials in firmware
- Reuse same device identifier across multiple installations
- Skip timestamp validation checks

## Known Limitations

- Requires physical access to device for initial setup
- Device must have persistent storage for secret keys
- Gas costs apply for on-chain registration (~80k gas per session)
