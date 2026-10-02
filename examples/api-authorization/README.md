# API Authorization Example

Reference implementation of ZK-proof-based authorization middleware for REST/GraphQL APIs.

**Status:** Reference implementation only  

---

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client     │ Request │ AegisProof   │ Auth    │ Shield       │
│              │ ─────▶  │ Auth Middleware │      │ Contract     │
└──────────────┘         └──────────────┘         └──────────────┘
                              │
                          Verify proof ──▶ Check permissions ──▶ Allow/Deny request
```

### Components

1. **Client Library**: Generates ZK proofs of authorization credentials
2. **Middleware**: Intercepts requests, validates proofs before forwarding
3. **Shield Contract**: Stores permission mappings and nullifier tracking

---

## Setup Instructions

### Installation

```bash
npm install express @aegisproof/sdk
```

### Configuration

Create `config.js`:
```javascript
const config = {
  rpcUrl: process.env.RPC_URL,
  shieldContract: process.env.SHIELD_CONTRACT,
  verifierAddress: process.env.VERIFIER_ADDRESS,
  chainId: Number(process.env.CHAIN_ID),
};

module.exports = config;
```

### Express Middleware Implementation

```javascript
// api-auth/middleware.js
import express from "express";
import { createPublicClient, http } from "viem";
import * as sdk from "@aegisproof/sdk";
import config from "../config.js";

const authRouter = express.Router();

authRouter.use(async (req, res, next) => {
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });
  
  try {
    // Extract proof from request header
    const proofHeader = req.headers["x-aegis-proof"];
    if (!proofHeader) {
      return res.status(401).json({ error: "Missing ZK proof" });
    }
    
    const proofData = JSON.parse(proofHeader);
    
    // Verify proof structure
    const signals = Array.isArray(proofData.publicSignals) 
      ? proofData.publicSignals.map((s) => s.toString()) 
      : [];
    
    sdk.validateSignalCount(signals);
    
    // Submit verification request
    const result = await sdk.verifyOnChain(
      client,
      config.verifierAddress,
      proofData.proof,
      signals
    );
    
    if (!result.success) {
      return res.status(403).json({ 
        error: "ZK proof verification failed",
        context: result.context 
      });
    }
    
    // Proof valid - extract session info for authorization
    // Resolve sessionId/deviceId from the canonical SSoT/SDK mapping; do not hardcode historical indices.\n    const sessionId = proofData.sessionId;\n    const deviceId = proofData.deviceId;
    
    // Store verified data in request object for downstream handlers
    req.aegisAuth = {
      sessionId,
      deviceId: signals[3],
      timestamp: parseInt(signals[0]),
      proofVerified: true,
    };
    
    next();
    
  } catch (error) {
    console.error("Authorization middleware error:", error);
    res.status(500).json({ error: "Authorization service unavailable" });
  }
});

export default authRouter;
```

### Protected Route Example

```javascript
// api/routes/protected.js
import express from "express";
import authMiddleware from "../middleware.js";

const router = express.Router();

// Apply authentication middleware to entire route
router.use(authMiddleware);

// Access authenticated user data
router.get("/profile", (req, res) => {
  res.json({
    authenticated: true,
    deviceId: req.aegisAuth.deviceId,
    sessionId: req.aegisAuth.sessionId,
    message: "Access granted based on valid ZK proof",
  });
});

export default router;
```

---

## Security considerations

Recommended:
- Use HTTPS/TLS for all HTTP endpoints
- Implement request rate limiting per sessionId
- Log authorization failures for audit trail
- Rotate shield contract addresses every 6 months
- Monitor for unusual submission patterns

Avoid:
- Skip proof verification for debugging
- Trust client-supplied sessionId without contract validation
- Store raw credentials alongside processed proof results
- Ignore timestamp validation (allow old proofs indefinitely)

---

## Known Limitations

- Requires network connectivity for each authorization check
- Gas costs apply for every new proof submission
- Not suitable for ultra-low-latency APIs (<10ms response requirements)
- Operator must maintain uptime for registration/deactivation functions
\n\n> **Signal-layout note:** The v2 SSoT has 30 signals. This reference example intentionally does not interpret raw array indices; production code should use the SDK canonical mapping and verify the RPC chain ID before relying on configuration.\n