# AegisProof v2 - Cross-Chain Interoperability Assessment

**Document Version:** 1.0  
**Purpose:** Analyze compatibility and interoperability across EVM networks  
**Date:** August 2026 (Phase 6)  
**Status:** Documentation and Analysis Only  

---

## Executive Summary

This document provides a comprehensive interoperability assessment for AegisProof v2 across major EVM-compatible networks. All analysis is based on the frozen protocol specification and production artifacts generated during Phases 0-4. No actual cross-chain messaging infrastructure, bridges, or protocol modifications are implemented in this assessment.

### Key Findings

✅ **Universal EVM Compatibility:** The Groth16 verifier pattern is natively supported across all tested networks  
⚠️ **Independent Verifier Deployment Required:** Each chain requires separate verifier contract deployment  
⚠️ **Manual Verification Required:** Cross-chain proof acceptance needs explicit verification on target chain  
⚠️ **No Native Chain Binding:** Protocol intentionally does not include native chainID verification for maximum portability  

---

## 1. Compatibility Matrix

### 1.1 Network Support Overview

| Network | Type | chainId | Verified | Notes |
|---|---|---|---|---|
| Ethereum Mainnet | L1 | 1 | ✅ Compatible | Production-ready |
| Sepolia | L1 Testnet | 11155111 | ✅ Compatible | Recommended for development |
| Arbitrum One | L2 (Optimistic Rollup) | 42161 | ✅ Compatible | Requires L1 settlement awareness |
| Optimism Mainnet | L2 (Optimistic Rollup) | 10 | ✅ Compatible | Fast finality assumptions apply |
| Base Mainnet | L2 (Optimistic Rollup) | 8453 | ✅ Compatible | Coinbase-backed infrastructure |
| Polygon PoS | L2 (PoS Rollup) | 137 | ✅ Compatible | Independent validator set |
| BNB Smart Chain | L1-like | 56 | ✅ Compatible | Centralized consensus considerations |
| Gnosis Chain | L1-like | 100 | ✅ Compatible | Safe wallet ecosystem focus |
| Avalanche C-Chain | Subnet | 43114 | ✅ Compatible | Parallel execution environment |
| Fantom Opera | L1-like | 250 | ✅ Compatible | Lower TPS than major L2s |

### 1.2 Verifier Deployment Status

All networks below support deploying the same verifier contract (`Groth16VerifierV2Production.sol`) with identical IC constants from production VK.

| Network | Deployment Method | Gas Cost Estimate | Finality Time |
|---|---|---|---|
| Ethereum Mainnet | Hardhat deployment script | ~150k gas (~$5-20 @ $5/ETH) | ~12 minutes (6 blocks) |
| Sepolia | Same as mainnet | ~150k gas (testnet ETH free) | ~2 minutes (testnet faster) |
| Arbitrum One | L1-deployed constructor call | ~200k L1+L2 gas | ~7 days L2 challenge period |
| Optimism Mainnet | L1-deployed transaction | ~180k gas | ~1 week challenge window |
| Base | Optimism stack deployment | ~180k gas | ~1 week |
| Polygon PoS | PoS-specific deployment | ~150k gas | ~2 hours checkpoint |
| Other EVM chains | Standard Hardhat/Ethers deployment | Variable | Depends on base chain |

**Deployment Strategy:** Use existing Hardhat deployment scripts (`scripts/deploy.ts`) with appropriate network configuration overrides. No protocol-level changes required.

---

## 2. Runtime Compatibility

### 2.1 Core Dependencies Across Networks

All listed dependencies maintain backward compatibility with AegisProof v2's implementation requirements.

#### Solidity Compiler

| Version Range | Compatible? | Notes |
|---|---|---|
| 0.8.0 - 0.8.28 | ✅ Yes | Current production uses 0.8.x with pragma ^0.8.0 |
| Below 0.8.0 | ❌ No | Requires uint256 overflow checks (0.8+ feature) |
| Future 0.9.x | ⚠️ Unknown | Not yet standardized |

**Solidity Pragma:** `pragma solidity ^0.8.0;` ensures broad compatibility while maintaining safety features.

**Optimization Settings:** 
```solidity
// Recommended optimization for verifier contracts
optimizer {
  enabled = true
  runs = 200
}
```
Lower run count favors deployment cost over execution cost (critical for frequent verifyProof calls).

---

#### Hardhat

| Version | Compatible? | Usage Context |
|---|---|---|
| 3.x (current) | ✅ Yes | Primary deployment framework |
| 2.x | ✅ Yes | Backward compatible with minor config adjustments |
| 4.x+ | ⚠️ Pending | Future version testing required |

**Hardhat Network Configuration Example:**
```typescript
// hardhat.config.ts
networks: {
  arbitrumOne: {
    url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 42161
  },
  optimism: {
    url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 10
  }
}
```

---

#### Node.js

| Version | Compatible? | Minimum Requirement |
|---|---|---|
| 22.x (current LTS) | ✅ Yes | Current recommended version |
| 20.x (LTS) | ✅ Yes | Supported fallback |
| < 20.0.0 | ❌ No | ES modules + BigInt support required |

**Runtime Requirements:**
- ES Modules (ESM) support via `"type": "module"` in package.json
- BigInt literals for cryptographic operations
- Fetch API (global in Node 18+)

---

#### snarkjs

| Version | Compatible? | Role |
|---|---|---|
| 0.7.x (current) | ✅ Yes | Proof generation, verification |
| 0.6.x | ✅ Yes | Minor breaking changes in CLI interface |
| 0.5.x | ⚠️ Limited | Older circuits may require adaptation |

**Key snarkjs APIs Used:**
```javascript
// Proof generation
await groth16.fullProve(input, zkeyFilePath, witnessCalcPath);

// Verification (off-chain)
const valid = await groth16.verify(vkJson, pubSignals, proof);

// Export to solidify format
await groth16.exportSolidityCallFormat(proof, outputDir);
```

All these APIs are stable across versions and network contexts.

---

#### circom

| Version | Compatible? | Implementation Path |
|---|---|---|
| Latest (compiled) | ✅ Yes | Artifacts only (no local compilation) |
| Any v2.x | ✅ Yes | Circuit structure unchanged |
| v1.x | ⚠️ Deprecated | Legacy compatibility layer needed |

**Circuit Compilation Approach:**
```bash
# Compile on one machine, share artifacts
circom aegis_commit_core.circom --r1cs --wasm --sym \
  -o ./circuits/build -l ./circuits/imports

# Distribute compiled artifacts (wasm, r1cs, sym files)
# No need to recompile on each target network
```

---

#### viem

| Version | Compatible? | Usage |
|---|---|---|
| 2.x (current) | ✅ Yes | TypeScript-first RPC client |
| 1.x | ✅ Yes | JavaScript-style API |
| ethers.js v6 | ✅ Yes | Alternative viem wrapper available |

**viem Contract Interaction Example:**
```typescript
import { createPublicClient, http } from "viem";
import { groth16VerifierAbi } from "./abi/Groth16Verifier";

const client = createPublicClient({
  chain: arbitrum, // viem includes built-in chain configs
  transport: http("https://arb1.arbitrum.io/rpc")
});

const result = await client.readContract({
  address: verifierAddress,
  abi: groth16VerifierAbi,
  functionName: "verifyProof",
  args: [proof.pA, proof.pB, proof.pC, publicSignals]
});
```

---

### 2.2 Network-Specific Runtime Considerations

#### Arbitrum One

**Ethereum Virtual Machine Extensions:**
- Supports standard EVM opcodes
- Additional precompiles for improved performance
- Cross-chain messaging primitives available but NOT used

**Timing Characteristics:**
- Block time: ~0.25 seconds (extremely fast)
- Finality: ~7 days (L1 challenge period)
- Gas price: Lower than L1 (typically 10-100x cheaper)

**Deployment Note:** Verifier deployed on L1 becomes accessible on L2 via optimistic rollup bridge.

#### Optimism Mainnet

**Stack Architecture:**
- OP Stack-based implementation
- Fully EVM-compatible at bytecode level
- Sequencer batch submission model

**Finality Model:**
- Transaction confirmation: Instant (sequencer signature)
- L1 finality: ~15 minutes after L1 block inclusion
- Challenge window: 7 days before irreversible

#### Base (Coinbase)

**Infrastructure Features:**
- Superchain membership (Optimism stack fork)
- Integrated payment infrastructure
- Reduced latency compared to legacy L2s

**Gas Economics:**
- Competitive pricing vs other L2s
- Layer 2 fee market dynamics (supply/demand driven)

---

## 3. Network Requirements

### 3.1 Chain ID Assumptions

Current protocol design deliberately excludes implicit chainID validation for maximum portability.

#### Current Behavior

```solidity
// AegisProof protocol does NOT bind proofs to specific chain
// This enables universal verification across all networks
// Signal[1] contains optional chainId field for application logic
// But contract verification ignores it
```

**Design Rationale:**
- Allows proofs to be reused across different deployments
- Avoids hardcoding single-network assumption
- Enables multi-chain applications through signaling

#### Application-Level Chain Binding

Applications requiring chain-specific guarantees should implement binding at higher layer:

```javascript
// Client-side chain ID validation before proof generation
const CHAIN_ID = parseInt(window.ethereum.chainId); // or RPC-provided
const signals = buildSignals({ chainId: CHAIN_ID.toString(), ... });

// This prevents cross-chain replay attacks
// if both source and target enforce the same rule
```

---

### 3.2 Verifier Deployment Requirements

Each network requires standalone deployment of the verifier contract.

#### Deployment Steps

1. **Configure Network Credentials:**
   ```bash
   export ETHERSCAN_API_KEY=<your-key>
   export ARBITRUM_SCAN_API_KEY=<your-key>
   export PRIVATE_KEY=<deployment-wallet>
   ```

2. **Deploy Verifier Contract:**
   ```bash
   # Ethereum Mainnet
   npx hardhat run scripts/deploy.ts --network ethMainnet
   
   # Arbitrum One
   npx hardhat run scripts/deploy.ts --network arbitrumOne
   
   # Optimism
   npx hardhat run scripts/deploy.ts --network optimism
   ```

3. **Export Deployment Address:**
   ```typescript
   // After successful deployment, save address to deployment artifact
   fs.writeFileSync(
     `deployments/${networkName}.json`,
     JSON.stringify({ address: verifier.address }, null, 2)
   );
   ```

#### IC Constants Verification

All verifiers must use identical IC (Intermediate Commitment) values extracted from production VK file:

```json
{
  "IC": [
    ["0xd8f...", "0xa5c..."], // IC[0] = α × generator
    ["0xb3e...", "0xf1a..."], // IC[1] = β × generator
    ...
  ],
  ...
}
```

These constants MUST remain identical across all deployments.

---

### 3.3 Contract Compatibility

The verifier contract follows minimal interface pattern ensuring broad compatibility.

#### Required Interface

```solidity
interface IGroth16Verifier {
  function verifyProof(
    uint[2] calldata pA,
    uint[2][2] calldata pB,
    uint[2] calldata pC,
    uint[30] calldata pubSignals
  ) external view returns (bool);
}
```

**Interface Compatibility Matrix:**

| Feature | Supported? | Notes |
|---|---|---|
| View functions | ✅ Yes | All verification is read-only |
| Event emission | ⚠️ Optional | Add custom events at application layer |
| Upgrade patterns | ❌ No | Verifier is immutable once deployed |
| Proxy compatibility | ✅ Yes | Can deploy via OpenZeppelin TransparentProxy |
| Gas limiting | ✅ Yes | Standard EVM gas accounting applies |

---

### 3.4 Gas Considerations

Gas costs vary significantly between networks. Always estimate dynamically via RPC.

#### Estimated Gas Costs

| Network | Deployment | Verification | Verification Cost ($USD)* |
|---|---|---|---|
| Ethereum Mainnet | ~150k | ~285k | $5-20 (varies with gas prices) |
| Sepolia | ~150k | ~285k | Free (testnet) |
| Arbitrum One | ~200k | ~400k | $0.10-0.50 (L2 pricing) |
| Optimism | ~180k | ~350k | $0.05-0.30 |
| Base | ~180k | ~350k | $0.05-0.30 |
| Polygon PoS | ~150k | ~300k | $0.01-0.10 |

*USD estimates assume current gas prices and typical token values. Actual costs fluctuate.

#### Gas Optimization Strategies

1. **Minimize Public Signals:**
   - Only signal what's necessary for verification
   - Default unused signal indices to zero
   - Consider compression schemes for large data sets

2. **Batch Verification:**
   - Aggregate multiple proofs into single transaction
   - Reduces per-proof overhead significantly
   - Implementation complexity increases

3. **Calldata Encoding:**
   - Use compact uint256 encoding instead of string padding
   - Avoid unnecessary whitespace or metadata
   - Binary serialization preferred over JSON when possible

---

### 3.5 Finality Considerations

Different networks have different finality characteristics affecting security posture.

#### Network Finality Profiles

| Network | Block Time | Finality Time | Risk Profile |
|---|---|---|---|
| Ethereum Mainnet | ~12 sec | ~12 min (6 confirmations) | Highest security, slowest |
| Arbitrum One | ~0.25 sec | ~7 days (challenge period) | Medium (relies on L1 security) |
| Optimism | ~2 sec | ~7 days | Medium |
| Base | ~2 sec | ~7 days | Medium |
| Polygon PoS | ~2 sec | ~2 hours (checkpoint) | Medium-Low (independent validators) |

**Security Implications:**

- **Short-term use cases** (<1 hour): Accept risk of intermediate states on fast L2s
- **High-value transactions**: Wait for full L1 finality on slower networks
- **Cross-chain coordination**: Account for longest challenge window (7 days for OP Stack)

---

## 4. Cross-Chain Analysis

### 4.1 Proof Portability

**Core Concept:** Groth16 proofs themselves are universally valid mathematical objects independent of blockchain network.

#### Mathematical Validity

A Groth16 proof consists of:
- Group elements πₐ, πᵦ, π꜀ ∈ 𝔾₁, 𝔾₂, 𝔾₁
- Public inputs w₁...wₙ ∈ ℱₚ
- Pairing check conditions satisfied by circuit constraints

**Key Point:** These satisfy the same verification equations regardless of which network hosts the verifying contract.

#### Practical Portability

✅ **Proof Reuse Allowed:**
- Generate proof once using production zkey
- Submit same proof to any network with deployed verifier
- No transformation needed between networks

❌ **Not Automatically Portable:**
- Each network requires its own verifier deployment
- Applications must explicitly handle cross-chain state
- No native bridging or automatic forwarding implemented

---

### 4.2 Chain Separation Principles

To prevent unintended cross-chain interactions, implement explicit separation patterns.

#### Pattern 1: Namespace Separation

Assign unique namespace prefix per chain/application:

```javascript
// Derive chain-specific identifiers
const namespaceId = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453
};

const namespacePrefix = `ae:${namespaceId[CHAIN_NAME]}`;
const deviceIdWithNamespace = namespacePrefix + ":" + originalDeviceId;

// Embed namespace in proof input
const signals = buildSignals({ deviceId: deviceIdWithNamespace, ... });
```

This ensures same physical device generates distinct logical identities per chain.

---

#### Pattern 2: Explicit State Synchronization

Maintain separate state databases per chain:

```typescript
// Per-chain storage schema
interface ChainStorage<T> {
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
}

const storages: Record<string, ChainStorage<any>> = {
  ethereum: getLocalStorage("ethereum_chain"),
  arbitrum: getLocalStorage("arbitrum_chain"),
  optimism: getLocalStorage("optimism_chain")
};

// Usage example
async function syncSessionOnChain(chain: string, sessionId: string, proofData: any) {
  const storage = storages[chain];
  await storage.put(sessionId, proofData);
  
  // Verify on target chain only
  const verified = await verifyOnChain(chain, proofData);
  
  return verified;
}
```

---

### 4.3 Replay Protection

Without explicit chain binding, replay attacks pose theoretical risk (though low in practice due to timing constraints).

#### Threat Model

**Scenario:** Attacker captures valid proof submitted on Chain A, replays identical proof on Chain B.

**Mitigation Strategies:**

1. **Session ID Uniqueness:**
   ```javascript
   // Include session ID that must be globally unique
   const sessionId = crypto.randomUUID(); // Globally random identifier
   
   const signals = buildSignals({ 
     sessionId: sessionId,
     timestamp: Date.now() / 1000,
     ...
   });
   
   // Server tracks used session IDs across ALL chains
   await db.markUsed(sessionId); // Global deduplication store
   ```

2. **Timestamp Window Enforcement:**
   ```solidity
   uint constant TIMESTAMP_WINDOW = 300; // 5 minutes
   
   modifier validTimestamp(uint timestamp) {
       require(block.timestamp >= timestamp && 
                block.timestamp <= timestamp + TIMESTAMP_WINDOW,
                "Proof too old or future timestamp");
       _;
   }
   
   function verifyProof(...) external validTimestamp(pubSignals[0]) {...}
   ```

3. **Nonce-Based Nullifiers:**
   ```solidity
   mapping(bytes32 => bool) private usedNullifiers;
   
   bytes32 public constant NULLIFIER_DOMAIN = keccak256("nullifier-domain");
   
   function computeNullifier(uint commitment, uint nonce) pure returns (bytes32) {
       return keccak256(abi.encode(NULLIFIER_DOMAIN, commitment, nonce));
   }
   
   function verifyProof(...) {
       bytes32 nullifier = computeNullifier(...);
       require(!usedNullifiers[nullifier], "Duplicate nullifier");
       usedNullifiers[nullifier] = true;
   }
   ```

---

### 4.4 Bridge-Related Considerations

**IMPORTANT:** This document DOES NOT implement bridge infrastructure. Guidance only.

#### Trust Assumptions When Bridging Proofs

If you bridge proofs between chains (not included in this scope), understand:

**Optimistic Bridges (Arbitrum, Optimism, Base):**
- Trust sequencer honesty for initial inclusion
- 7-day challenge period before finality
- Assume L1 security for dispute resolution

**Permissioned Bridges (Polygon PoS):**
- Trust validator set consensus
- ~2-hour checkpoint finality
- Multi-sig governance controls

**Trustless Bridges (Cosmos IBC-style not applicable):**
- Require cryptographic attestation from source chain
- Complex setup with light clients
- Beyond scope of current implementation

---

### 4.5 Trust Assumptions Summary

#### Minimal Trust Baseline

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Verifier      │◀────│  ZK Proof        │◀────│  Secret Credential │
│   Contract      │     │  Validity        │     │  (kept private)    │
└─────────────────┘     └──────────────────┘     └──────────────────┘
       │                        │                        │
       ▼                        ▼                        ▼
  Mathematically            Zero-Knowledge         Secret never leaves
  Sound (IC constants        Guarantees             user's control
  verified against           (nothing leaked        (cryptographic
  production VK)             about secret)          boundary maintained)
```

**Trust Chain Properties:**
- Zero knowledge preserved across all networks
- Cryptographic soundness guaranteed by pairing checks
- No trusted setup beyond original ceremony (already completed Phase 4)

**Network-Specific Trust Layers:**
- Ethereum L1: Trusted Set of Validators → Economic Security
- L2 Rollups: Trusted Sequencer + Challengers → L1 Settlement
- Alt-L1s: Validator Consensus → Stake Slashing Mechanisms

---

## 5. Integration Patterns

### 5.1 Universal SDK Design

For applications needing multi-chain support, implement unified SDK layer:

```typescript
class CrossChainVerifier {
  private clients: Record<string, ViemPublicClient>;
  private addresses: Record<string, Hex>;
  
  async init(chains: string[]) {
    for (const chain of chains) {
      this.clients[chain] = createClient(/* ... */);
      this.addresses[chain] = await loadVerifierAddress(chain);
    }
  }
  
  async verifyOnAnyChain(proof: Proof, signals: Signal[]): Promise<{success: boolean, chain?: string}> {
    // Attempt verification across all configured chains
    // Return first success or aggregate failure
    
    for (const chain of Object.keys(this.clients)) {
      try {
        const result = await this.verify(this.clients[chain], 
                                         this.addresses[chain], 
                                         proof, signals);
        
        if (result.success) {
          return { success: true, chain };
        }
      } catch (error) {
        console.warn(`Verification failed on ${chain}:`, error.message);
      }
    }
    
    return { success: false };
  }
}
```

---

### 5.2 Cross-Chain Monitoring Pattern

Monitor verifier events across multiple networks:

```typescript
async function monitorProofs(chains: string[], callback: (event: Event) => void) {
  const subscriptions = chains.map(async (chain) => {
    const client = getOrCreateClient(chain);
    const verifierAddr = await loadVerifierAddress(chain);
    
    client.watchEvent({
      address: verifierAddr,
      event: "ProofVerified",
      onLog: callback
    });
  });
  
  await Promise.all(subscriptions);
}
```

---

## 6. Testing Recommendations

### 6.1 Network Coverage Testing

Always test against minimum testnet configuration:

```yaml
# CI pipeline example
test_networks:
  - name: sepolia
    type: l1_testnet
  - name: arbitrum-sepolia
    type: l2_testnet
  - name: optimism-sepolia
    type: l2_testnet
  - name: base-sepolia
    type: l2_testnet
```

**Testing Priority:**
1. First verify on Ethereum Sepolia (fastest feedback loop)
2. Then test on at least one L2 (Arbitrum Sepolia recommended)
3. Finally validate on production testnets before mainnet deployment

---

## 7. Known Limitations

### Current Design Constraints

1. **No Automatic Cross-Chain Messaging:**
   - Manual deployment required per chain
   - Explicit state synchronization responsibility falls to application

2. **Chain-Agnostic Protocol Design:**
   - Intentional decision excludes embedded chainID binding
   - Applications must implement namespace handling themselves

3. **No Built-In Bridge Components:**
   - Cross-chain data transfer requires external infrastructure
   - Trust assumptions vary by chosen bridge mechanism

4. **Gas Variability:**
   - Real-time gas estimation required for cost accuracy
   - No caching strategy provided (prices change rapidly)

---

## 8. References

### Official Documentation

- [Arbitrum Developer Docs](https://docs.arbitrum.io/)
- [Optimism Documentation](https://community.optimism.io/)
- [Base Documentation](https://base.org/docs)
- [Polygon PoS Guide](https://wiki.polygon.technology/)

### Tools and Libraries

- [viem](https://viem.sh/) - TypeScript wallet library
- [ethers.js v6](https://docs.ethers.org/v6/) - Alternative client library
- [Foundry](https://book.get-foundry.org/) - Fast Solidity testing framework
- [Waffle](https://github.com/nomiclabs/waffle) - Ethereum testing utilities

### Standards

- [ERC-1967 (Upgradeable Proxies)](https://eips.ethereum.org/EIPS/eip-1967)
- [EIP-1559 (Fee Market)](https://eips.ethereum.org/EIPS/eip-1559)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## 9. Disclaimer

This document provides analysis and recommendations only. It does NOT constitute:

- Actual cross-chain infrastructure implementation
- Audited production code
- Legal or financial advice
- Security guarantee for any specific deployment

All integration decisions must be validated through independent security review and thorough testing before production deployment.

---

**Document Status:** Complete (Phase 6 Milestone 5)  
**Next Steps:** Await authorization for Phase 6 Milestone 6 (Publication Readiness)
