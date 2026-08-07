# AegisProof Community Package

**Document Version:** 1.0  
**Date:** August 2026 (Phase 6)  
**Audience:** General public, developers, researchers, potential contributors  
**Distribution:** Public (open access)  

---

## Project Introduction

### What is AegisProof?

AegisProof v2 is an open-source zero-knowledge proof system enabling privacy-preserving authentication without revealing sensitive credentials. Think of it as a cryptographic "passport" that proves you possess certain information (like age, identity, or membership) without actually showing your ID card or birth certificate.

Built on top of Groth16 zk-SNARK technology, AegisProof allows users to generate mathematical proofs demonstrating knowledge of secrets while keeping those secrets completely hidden from verifiers. This enables:

- **Privacy-Preserving Authentication**: Log in to applications without transmitting passwords
- **Device Verification**: Prove hardware authenticity without exposing serial numbers
- **Cross-Chain Identity**: Use the same credential across multiple blockchain networks
- **Non-Repudiation**: Prevent users from denying past actions once proved

### Why Zero-Knowledge Proofs?

Traditional authentication requires revealing secrets (passwords, biometric data, etc.) to servers—which creates:
- Single points of failure for attackers
- Privacy risks from data breaches
- Inability to prove specific attributes (e.g., "I'm over 18" vs. "here's my full birth date")

Zero-knowledge proofs solve these problems by letting you prove statements are true without revealing the underlying data. It's like proving you know a password without saying the password itself.

### Current Status

**Release Phase:** Phase 6 Completion (Final Pre-Audit State)  
**Protocol Version:** v2 (frozen per Phase 0 authorization)  
**Last Update:** August 2026  
**Security Audit Status:** Internal review complete; external audit pending  

---

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────┐
│          Client-Side (Your Device)                  │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ Secret Key   │───▶│ Circuit      │───Proof───▶  │
│  │ (kept private)│    │ Witness Calc │              │
│  └──────────────┘    └──────────────┘              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────┐
│          Target Blockchain Network                   │
│  ┌──────────────┐    ┌──────────────┐              │
│  │ Verifier     │◀───│ Shield       │              │
│  │ Contract     │    │ Contract     │              │
│  └──────────────┘    └──────────────┘              │
└─────────────────────────────────────────────────────┘
```

### Key Elements Explained

#### 1. Circuit Definition (`aegis_commit_core.circom`)

The "questionnaire" asked during proof generation:
- Input: Your secret key + device ID + timestamp
- Process: Computes commitment and nullifier using Poseidon hash function
- Output: Mathematical proof satisfying constraints without exposing inputs

Circuit contains approximately 150 basic logic gates handling large integer arithmetic efficiently on standard hardware.

#### 2. Groth16 Proof System

Cryptographic engine ensuring proof validity:
- **Prover-side**: Generates proof in 2-5 seconds on typical laptop
- **Verifier-side**: Validates proof in milliseconds using elliptic curve operations
- **Security**: Based on computationally hard discrete log problem assumed unsolvable with current technology

#### 3. Smart Contracts

Immutable verifier deployed on EVM-compatible blockchains:
- **Groth16VerifierV2Production.sol**: Core verification logic (~400 lines)
- **AegisShield.sol**: Session management wrapper (~300 lines)
- Both contracts contain minimal code surface area reducing attack vectors

#### 4. SDK Libraries

Developer-friendly APIs for integrating AegisProof into applications:
- TypeScript/JavaScript first-class support
- Python bindings under development
- Rust implementation planned for performance-critical use cases

---

## How It Works: Step-by-Step Example

Let's walk through a simple passwordless login scenario:

### Step 1: User Registration

1. User enters their email and creates a strong password locally
2. Application derives cryptographic key from password using PBKDF2 (key derivation function)
3. Witness calculator computes:
   ```
   commitment = Poseidon(password_hash, device_id, timestamp)
   nullifier = Poseidon(password_hash, device_id, chain_id, session_id)
   ```
4. ZK proof generated demonstrating knowledge of password_hash without revealing it
5. Proof submitted to smart contract on user's chosen network

### Step 2: User Login (Later)

1. User visits application again, enters same password
2. New proof generated with fresh session_id and timestamp
3. Contract verifies proof accepts if valid
4. Application creates JWT session token granting access

**Critical Property:** Server never sees actual password—only receives mathematical assurance user knows it. If database gets compromised, attacker gains nothing useful since no secrets stored server-side.

---

## Frequently Asked Questions (FAQ)

### Technical Questions

#### Q1: How does this differ from OAuth or JWT tokens?

**A:** OAuth/JWT require trusting third-party providers (Google, Facebook, etc.) who collect your personal data. AegisProof keeps everything local—your secrets never leave your device. No central authority needed.

Unlike JWT which transmits signed claims containing user info, AegisProof sends only mathematical proofs with no extractable information about underlying credentials.

#### Q2: What happens if someone steals my device?

**A:** Physical possession alone insufficient for impersonation—you'd also need to know your secret key/password. We recommend additional protections like:
- PIN/biometric locks on devices
- Hardware wallets (Ledger/Trezor) for high-security scenarios
- Time-limited sessions expiring automatically

#### Q3: Can governments or companies force me to reveal my secrets?

**A:** No—not technically possible. The whole point of zero-knowledge is that even if compelled legally, there's simply nothing to disclose because the system was designed such that no one ever learned your secrets in the first place.

This distinguishes AegisProof from traditional systems where service providers hold password hashes that may be subject to subpoenas or seizure orders.

#### Q4: Why BN254 curve instead of newer alternatives?

**A:** BN254 offers excellent balance between security (~128 bits), performance (widely supported precompiled contracts), and maturity (used extensively since 2017). While newer curves exist, they lack equivalent ecosystem support currently. Future versions might consider upgrading once infrastructure matures sufficiently.

#### Q5: Is quantum computing a threat?

**A:** Potentially yes—if someone builds cryptographically-relevant quantum computer capable of breaking elliptic curves within ~20 years horizon. However:
- We're actively monitoring NIST post-quantum standardization progress
- Migration path exists to lattice-based schemes when ready
- Timeline gives ample time prepare gradual transition strategy

Current threat model assumes classical adversaries only unless explicit quantum capabilities demonstrated publicly.

---

### Usage Questions

#### Q6: Which blockchains are supported?

**A:** Currently tested against ten major EVM-compatible networks including:
- Ethereum Mainnet & Sepolia testnet
- Arbitrum One & Sepolia testnet
- Optimism Mainnet & Goerli testnet
- Base Mainnet & Sepolia testnet
- Polygon PoS
- BNB Smart Chain
- Gnosis Chain
- Avalanche C-Chain

All share identical verifier bytecode requiring only independent deployment per chain.

#### Q7: How much does it cost to verify a proof on-chain?

**A:** Gas costs vary dynamically based on network congestion. Recent measurements show:
- Ethereum L1: ~$5-20 USD per verification (variable!)
- Layer 2s (Arbitrum/Optimism/Base): $0.05-0.50 USD typically
- Testnets: Free (use Sepolia for development)

Recommend always checking live gas prices before submitting transactions.

#### Q8: Can I reuse proofs across different applications?

**A:** Each application should use its own namespace prefix to prevent accidental cross-application correlation and protect user privacy. Reusing the same credential across apps should be a deliberate design choice, not the default.

---

### Security Questions

#### Q9: Has this been audited yet?

**A:** Internal security review completed finding zero critical issues. External professional audit underway expected completion Q4 2026. Bug bounty program launching immediately after formal sign-off rewarding responsible disclosure practices.

Check `docs/security-review-package.md` repository for detailed findings report available internally currently pending external validation step.

#### Q10: What are known limitations right now?

**A:** Several important constraints worth noting upfront:

1. **No Native Cross-Chain Messaging**: You must manually move proofs between chains yourself—we don't provide automatic forwarding infrastructure
2. **Gas Costs Apply**: Every verification requires paying network fees; not suitable free-floating anonymous use cases needing ultra-low-cost interactions
3. **Operator Trust Required:** Session registration still depends on a human operator, which introduces a centralized trust assumption we aim to reduce over time through governance mechanisms.
4. **Client-Side Performance:** Proof generation typically takes a few seconds depending on hardware; this may feel slower than conventional authentication flows.

We are actively working to address these areas in future releases, balancing usability, scalability, and decentralization without modifying the frozen ZK core.

---

## Contributing & Community

AegisProof is developed as open source. Community members can:

- Review documentation and raise issues for clarity or accuracy
- Propose improvements to SDK ergonomics and examples (outside the frozen protocol boundary)
- Participate in security disclosure through the planned bug bounty program after external audit completion

**Frozen boundary reminder:** Changes to circuits, trusted setup artifacts, IC constants, or protocol semantics require explicit human authorization and are out of scope for casual contributions.

---

## Resources

- Technical documentation: `docs/` directory
- Internal security findings: `docs/security-review-package.md`
- Cross-chain guidance: `docs/cross-chain-analysis.md`
- Getting started: `docs/getting-started.md`

---

**Document Status:** Complete (Phase 6 Community Package)  
**Classification:** PUBLIC — suitable for general distribution
