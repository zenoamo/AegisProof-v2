# AegisShield Deployment Information

## Final Deployment Details

### Network
- **Network**: Hardhat Localhost
- **Chain ID**: 31337
- **RPC URL**: http://127.0.0.1:8545

### Contract Addresses
- **AegisShield**: `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
- **Groth16Verifier29**: `0x5fbdb2315678afecb367f032d93f642f64180aa3`

### Operator
- **Operator Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Operator Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### Circuit Information
- **Circuit**: aegis_commit_core.circom
- **Circom Version**: 2.2.3
- **Public Signals**: 29
- **Template Instances**: 364
- **Non-linear Constraints**: 2,622
- **Linear Constraints**: 3,746
- **Public Inputs**: 24
- **Private Inputs**: 2
- **Public Outputs**: 5
- **Wires**: 6,395
- **Labels**: 10,089

### Proof Information
- **Proof File**: build/proofs/proof_29.json
- **Public Signals File**: build/proofs/public_29.json
- **Verification Key**: build/vkey.json

### Public Signal Layout (Final)
```
[0]  modelManifestCommitment
[1]  executionEnvCommitment  
[2]  generationCommitment
[3]  commitment
[4]  nullifier
[5]  expectedPromptRoot
[6]  expectedOutputRoot
[7]  sessionId
[8]  purposeId
[9]  weightsHash
[10] tokenizerHash
[11] systemPromptHash
[12] loraHash
[13] adapterHash
[14] safetyLayerHash
[15] quantizationHash
[16] precisionHash
[17] runtimeHash
[18] driverHash
[19] temperature
[20] topP
[21] topK
[22] seed
[23] repetitionPenalty
[24] presencePenalty
[25] frequencyPenalty
[26] maxTokens
[27] protocolVersion
[28] timestamp
```

### Signal Index Mapping
- **SESSION_ID_INDEX**: 7
- **PURPOSE_ID_INDEX**: 8
- **COMMITMENT_INDEX**: 3
- **NULLIFIER_INDEX**: 4

### Test Results
- **E2E Test**: ✅ PASSED
- **Penetration Tests (PT-01 to PT-12)**: ✅ ALL PASSED
- **Lean Formal Verification**: ✅ PASSED

### Gas Consumption
- **verifyAndAccept Gas**: 443,144

### Deployment Date
- **Date**: 2026-08-03
- **Timestamp**: Final verification completion