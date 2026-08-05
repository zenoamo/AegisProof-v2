# Proof-Based Login Example

**Purpose:** Zero-knowledge user authentication without password transmission  
**Status:** Reference implementation (demonstration only)  

---

## Architecture Overview

```
User Login Flow (Passwordless):

┌──────────────┐      Proof ──▶    ┌──────────────┐
│ User Browser │                     │ AegisProof   │
│ (Client App) │◀── Challenge ◀────  │ Auth Service │
└──────────────┘                     └──────────────┘
                                       │
                                       ▼
                                  ┌──────────────┐
                                  │ Shield       │
                                  │ Contract     │
                                  └──────────────┘
```

### Key Features

- **No passwords transmitted** over network
- **Cryptographic proof** of credential knowledge
- **Privacy-preserving**: server never learns actual password hash
- **Replay-resistant**: each login uses fresh session ID

## Setup Instructions

### Prerequisites

- Modern web browser with JavaScript support
- deployed AegisProof shield contract
- Web service supporting ZK login backend

### Configuration

Create `.env` file:
```env
RPC_URL=https://rpc.sepolia.org
SHIELD_CONTRACT=0xYourShieldContract
USER_WALLET_KEY=<development-key-only>  # Never use mainnet key!
```

## Execution Flow

### 1. Server Issue Challenge
```javascript
// auth-service/issue-challenge.js
const sessionId = Date.now();
const challenge = crypto.randomBytes(32).toString("hex");

// Store challenge for later validation
await db.storeChallenge({ sessionId, challenge, expires: Date.now() + 5*60*1000 });

return { sessionId }; // Send to client
```

### 2. Client Generates Proof
```javascript
// browser/login.js
import { buildPublicSignals, grothProofToCalldata } from "@aegisproof/sdk";

// User enters username/password locally
const username = "alice@example.com";
const password = process.env.USER_PASSWORD; // From secure vault, not typed!

// Derive secret key from password using PBKDF2
const salt = deriveSalt(username);
const secretKey = await pbkdf2(password, salt, 100000, 32);

// Build proof inputs
const pubInput = {
  timestamp: Math.floor(Date.now() / 1000),
  chainId: parseInt(CHAIN_ID),
  protocolVersion: "2",
  deviceId: "browser-" + localStorage.getItem("deviceId"),
  commitment: computeCommitment(secretKey, username, salt),
  nullifier: computeNullifier(secretKey, username, CHAIN_ID, sessionId),
  sessionId: sessionId.toString(),
  purposeId: "login".padEnd(32).slice(0, 32), // Fixed-width padding
};

// Generate Groth16 proof using circuit WASM
const proof = await generateGroth16Proof({
  privateInputs: { secretKey },
  publicSignals: buildPublicSignals(pubInput),
});

// Submit to contract
const result = await sdk.verifyOnChain(
  client,
  SHIELD_CONTRACT,
  proof,
  proof.publicSignals
);

if (result.success) {
  // Login successful - receive session token
  const authToken = await authenticateSuccess(sessionId, username);
  storeAuthToken(authToken);
}
```

### 3. Server Validates Result
```javascript
// auth-service/validate-login.js
async function validateLogin(sessionId, proofResult) {
  const storedChallenge = await db.getChallenge(sessionId);
  
  if (!storedChallenge || Date.now() > storedChallenge.expires) {
    throw new Error("Expired or invalid challenge");
  }
  
  // Verify proof was accepted by smart contract
  if (!proofResult.success) {
    throw new Error("Zero-knowledge verification failed");
  }
  
  // Issue standard JWT token
  return jwt.sign({ userId: storedChallenge.userId }, JWT_SECRET);
}
```

## Expected Outputs

**Successful login response:**
```json
{
  "success": true,
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "alice@example.com",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

**Failure scenarios:**
```json
{
  "success": false,
  "errorCode": "PROOF_VERIFICATION_FAILED",
  "message": "Invalid zero-knowledge proof"
}
```

## Security Considerations

✅ **Recommended:**
- Use PBKDF2/scrypt/bcrypt for password-to-key derivation (NOT raw password as secretKey)
- Implement rate limiting to prevent brute-force attempts
- Store challenges with short TTL (<5 minutes)
- Validate server-side that proof corresponds to issued challenge

❌ **Critical mistakes to avoid:**
- Using raw password as proof input (must derive via KDF first)
- Skipping challenge expiration checks
- Accepting proofs without verifying chainId matches expected network
- Storing plaintext passwords anywhere in application code

## Known Limitations

- Password derivation requires secure random salt per user
- Proof generation latency (2-5 seconds typical) affects UX
- Requires persistent wallet/storage for derived credentials
- No recovery mechanism if password lost (true passwordless behavior)

## Future Enhancements

1. **Biometric Binding**: Extend circuit to include fingerprint/facial recognition hash
2. **Multi-factor Extension**: Add backup codes alongside ZK proof
3. **Batch Recovery**: Enable social recovery protocols through multi-party computation
4. **Cross-Domain Sessions**: Share authenticated sessions across subdomains via bridged tokens
