# Dummy ZK Circuit Pipeline

**Phase**: 8.2  
**Status**: Evaluation Framework  
**Last Updated**: 2026-08-05

---

## Overview

The Dummy ZK Circuit Pipeline provides a lightweight ZK proof generation and verification pipeline for testing the TEE + ZK integration without using production AegisProof circuits.

---

## Purpose

This dummy pipeline is designed to:
- Validate ZK proof generation workflow
- Test ZK verification integration
- Demonstrate signal management
- Enable end-to-end testing without production artifacts

**Important**: This is completely separate from production AegisProof circuits and uses minimal computational resources.

---

## Circuit Specification

### Circuit Logic

A minimal hash circuit that validates:

```
hash(private_input) == public_hash
```

### Circuit Inputs

#### Private Inputs
- `private_input`: A secret value (256-bit integer)

#### Public Inputs
- `public_hash`: The expected hash of the private input

### Circuit Outputs

- `result`: Boolean indicating if hash matches

---

## Circuit Implementation (Circom)

```circom
pragma circom 2.0.0;

template DummyHash() {
    signal input private_input;
    signal input public_hash;
    signal output result;
    
    // Simple hash simulation using Poseidon
    signal hash;
    hash <== Poseidon(5)([private_input, 0, 0, 0, 0]);
    
    // Compare hash with public_hash
    result <== hash == public_hash;
}

component main {public [public_hash]} = DummyHash();
```

---

## Directory Structure

```
verification/zk-dummy/
├── README.md                    # This file
├── circuits/
│   ├── dummy_hash.circom        # Circom circuit
│   ├── dummy_hash.r1cs          # Compiled R1CS
│   ├── dummy_hash.sym           # Symbol file
│   └── dummy_hash.wasm         # WASM for witness generation
├── scripts/
│   ├── compile.sh               # Circuit compilation script
│   ├── generate_witness.sh     # Witness generation script
│   ├── generate_proof.sh       # Proof generation script
│   └── verify_proof.sh         # Proof verification script
├── proofs/
│   ├── test_proofs.json        # Test proof data
│   └── verification_keys.json  # Verification keys
└── tests/
    ├── test_circuit.ts         # Circuit tests
    ├── test_witness.ts         # Witness generation tests
    ├── test_proof.ts           # Proof generation tests
    └── test_verification.ts    # Verification tests
```

---

## Compilation Steps

### 1. Compile Circuit

```bash
# Navigate to circuits directory
cd verification/zk-dummy/circuits

# Compile Circom circuit
circom dummy_hash.circom --r1cs --wasm --sym -o ./

# Expected outputs:
# - dummy_hash.r1cs
# - dummy_hash.wasm
# - dummy_hash.sym
```

### 2. Generate Powers of Tau

```bash
# Download or generate powers of tau
# For testing, use a small powers of tau file
snarkjs powersoftau new bn128 14 pot14_0000.ptau -e

# Contribute entropy (for testing, skip)
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau -n "Test Contributor" -e

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
```

### 3. Generate Verification Key

```bash
# Generate zkey
snarkjs groth16 setup dummy_hash.r1cs pot14_final.ptau dummy_hash_0000.zkey

# Contribute entropy (for testing, skip)
snarkjs zkey contribute dummy_hash_0000.zkey dummy_hash_0001.zkey -n "Test Contributor" -e

# Finalize zkey
snarkjs zkey export verificationkey dummy_hash_0001.zkey verification_key.json

# Expected outputs:
# - dummy_hash_0001.zkey (proving key)
# - verification_key.json (verification key)
```

---

## Proof Generation

### 1. Generate Witness

```bash
# Calculate witness
node -e "
const buildPoseidon = require('circomlibjs').buildPoseidon;
const F = require('circomlibjs').F;
const poseidon = buildPoseidon();

const privateInput = 12345;
const publicHash = poseidon([privateInput, 0, 0, 0, 0]).toString();

console.log('Private Input:', privateInput);
console.log('Public Hash:', publicHash);
"

# Generate witness using WASM
snarkjs wtns calculate dummy_hash.wasm input.json witness.wtns
```

### 2. Generate Proof

```bash
# Generate proof
snarkjs groth16 prove dummy_hash_0001.zkey witness.wtns proof.json public.json

# Expected outputs:
# - proof.json (Groth16 proof)
# - public.json (public signals)
```

---

## Proof Verification

### 1. Verify Proof

```bash
# Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json

# Expected output:
# [OK] Proof verification successful
```

### 2. Verification Code

```typescript
import snarkjs from 'snarkjs';

async function verifyDummyProof(
  verificationKey: any,
  publicSignals: any[],
  proof: any
): Promise<boolean> {
  const vkey = await snarkjs.zKey.loadJson(verificationKey);
  const result = await snarkjs.groth16.verify(
    vkey,
    publicSignals,
    proof
  );
  
  return result === true;
}

// Usage
const vkey = JSON.parse(readFileSync('verification_key.json', 'utf8'));
const publicSignals = JSON.parse(readFileSync('public.json', 'utf8'));
const proof = JSON.parse(readFileSync('proof.json', 'utf8'));

const isValid = await verifyDummyProof(vkey, publicSignals, proof);
console.log('Proof valid:', isValid);
```

---

## Test Cases

### Test Case 1: Valid Proof
**Input**: Valid private input and matching public hash
**Expected**: Proof generation succeeds, verification returns true

### Test Case 2: Invalid Proof
**Input**: Valid private input but mismatched public hash
**Expected**: Proof generation fails or verification returns false

### Test Case 3: Witness Generation
**Input**: Various private input values
**Expected**: Witness generation succeeds for all valid inputs

### Test Case 4: Verification Key Consistency
**Input**: Multiple verification attempts with same key
**Expected**: Consistent verification results

---

## Integration with TEE Mock

### Combined Test Flow

```typescript
import { MockTDXQuoteGenerator } from '../../tee/mock/tdx/mock-quote-generator';
import { verifyDummyProof } from './test_verification';

async function testTEEPlusZK() {
  // 1. Generate TEE attestation
  const tdxGenerator = new MockTDXQuoteGenerator();
  const tdxQuote = tdxGenerator.generateValidQuote();
  
  // 2. Generate ZK proof
  const zkProof = await generateDummyProof(12345);
  
  // 3. Verify both
  const tdxValid = await verifyTDXQuote(tdxQuote);
  const zkValid = await verifyDummyProof(zkProof.vkey, zkProof.publicSignals, zkProof.proof);
  
  // 4. Combined verification
  if (tdxValid && zkValid) {
    console.log('TEE + ZK verification successful');
  } else {
    console.log('Verification failed');
  }
}
```

---

## Performance Benchmarks

### Expected Performance

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Circuit Compilation | 10-30s | One-time operation |
| Witness Generation | 1-5s | Depends on input size |
| Proof Generation | 5-15s | Groth16 proving |
| Proof Verification | 100-500ms | Fast verification |

### Benchmark Script

```typescript
import { performance } from 'perf_hooks';

async function benchmarkProofGeneration() {
  const start = performance.now();
  
  // Generate witness
  await generateWitness();
  const witnessTime = performance.now() - start;
  
  // Generate proof
  const proofStart = performance.now();
  await generateProof();
  const proofTime = performance.now() - proofStart;
  
  // Verify proof
  const verifyStart = performance.now();
  await verifyProof();
  const verifyTime = performance.now() - verifyStart;
  
  console.log('Witness Generation:', witnessTime, 'ms');
  console.log('Proof Generation:', proofTime, 'ms');
  console.log('Proof Verification:', verifyTime, 'ms');
}
```

---

## Safety Guarantees

### Complete Isolation
- Separate from production AegisProof circuits
- Separate cryptographic artifacts
- No production zkey or vkey
- No production trusted setup

### Minimal Resources
- Small circuit size
- Fast compilation
- Low memory usage
- Quick proof generation

### No Security Claims
- Not for production use
- No security guarantees
- Testing only
- Evaluation purposes only

---

## Implementation Status

- [x] Circuit specification
- [x] Directory structure
- [x] Compilation steps documented
- [x] Test cases defined
- [ ] Circom circuit implementation
- [ ] Compilation scripts
- [ ] Test implementation
- [ ] Integration with TEE mock
- [ ] Performance benchmarking

---

## Next Steps

1. Implement the dummy Circom circuit
2. Create compilation and generation scripts
3. Implement test suite
4. Integrate with TEE mock framework
5. Run performance benchmarks
6. Document results

---

## Notes

- This pipeline is for evaluation only
- Not related to production AegisProof security
- Uses minimal cryptographic assumptions
- Designed for testing integration workflows
