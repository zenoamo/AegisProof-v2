┌──────────────────────────────────────────────────────────────┐
│                        AegisProof System                     │
└──────────────────────────────────────────────────────────────┘

                         オフチェーン
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────────┐                                         │
│  │ Circuit Source  │                                         │
│  │ .circom         │                                         │
│  │                 │                                         │
│  │ Aegis Commit    │                                         │
│  │ Core Circuit    │                                         │
│  └────────┬────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                         │
│  │  Circom Compile │                                         │
│  │                 │                                         │
│  │  WASM           │                                         │
│  │  R1CS           │                                         │
│  └────────┬────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐       ┌──────────────────────┐          │
│  │ Powers of Tau   │──────▶│  Groth16 Setup       │          │
│  │ .ptau           │       │                      │          │
│  └─────────────────┘       │  proving_key.zkey    │          │
│                            │  verification_key    │          │
│                            └──────────┬───────────┘          │
│                                       │                      │
│                                       ▼                      │
│                            ┌──────────────────────┐          │
│                            │  Proof Generator     │          │
│                            │                      │          │
│                            │  input.json          │          │
│                            │  + WASM              │          │
│                            │  + zkey              │          │
│                            └──────────┬───────────┘          │
│                                       │                      │
│                                       ▼                      │
│                            ┌──────────────────────┐          │
│                            │ Groth16 Proof        │          │
│                            │                      │          │
│                            │ proof_29.json        │          │
│                            │ public_29.json       │          │
│                            └──────────┬───────────┘          │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        │ Proof
                                        │ Public Signals
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                         Sepolia Testnet                       │
│                          オンチェーン                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    AegisShield                         │  │
│  │                                                        │  │
│  │  ┌──────────────────────┐                              │  │
│  │  │ Session Registry     │                              │  │
│  │  │                      │                              │  │
│  │  │ sessionId            │                              │  │
│  │  │ purposeId            │                              │  │
│  │  │ active                │                              │  │
│  │  └──────────┬───────────┘                              │  │
│  │             │                                          │  │
│  │             ▼                                          │  │
│  │  ┌──────────────────────┐                              │  │
│  │  │ Purpose Registry     │                              │  │
│  │  │                      │                              │  │
│  │  │ allowedPurposes      │                              │  │
│  │  └──────────┬───────────┘                              │  │
│  │             │                                          │  │
│  │             ▼                                          │  │
│  │  ┌──────────────────────┐                              │  │
│  │  │ Session Binding      │                              │  │
│  │  │                      │                              │  │
│  │  │ Proof Session ID     │                              │  │
│  │  │        ==            │                              │  │
│  │  │ Expected Session ID  │                              │  │
│  │  └──────────┬───────────┘                              │  │
│  │             │                                          │  │
│  │             ▼                                          │  │
│  │  ┌──────────────────────┐                              │  │
│  │  │ Purpose Binding      │                              │  │
│  │  │                      │                              │  │
│  │  │ Session Purpose      │                              │  │
│  │  │        ==            │                              │  │
│  │  │ Proof Purpose        │                              │  │
│  │  └──────────┬───────────┘                              │  │
│  │             │                                          │  │
│  │             ▼                                          │  │
│  │  ┌──────────────────────┐                              │  │
│  │  │ Groth16 Verifier     │◀──────────────┐              │  │
│  │  │                      │               │              │  │
│  │  │ verifyProof()        │               │              │  │
│  │  └──────────┬───────────┘               │              │  │
│  │             │                           │              │  │
│  │             ▼                           │              │  │
│  │  ┌──────────────────────┐               │              │  │
│  │  │ Nullifier Registry   │               │              │  │
│  │  │                      │               │              │  │
│  │  │ usedNullifiers       │               │              │  │
│  │  └──────────┬───────────┘               │              │  │
│  │             │                           │              │  │
│  │             ▼                           │              │  │
│  │      ┌───────────────┐                  │              │  │
│  │      │ ProofAccepted │                  │              │  │
│  │      │               │                  │              │  │
│  │      │ commitment    │                  │              │  │
│  │      │ nullifier     │                  │              │  │
│  │      │ sessionId     │                  │              │  │
│  │      └───────────────┘                  │              │  │
│  │                                        │              │  │
│  └────────────────────────────────────────┼──────────────┘  │
│                                           │                 │
│  ┌────────────────────────────────────────▼──────────────┐  │
│  │             Groth16Verifier29                         │  │
│  │                                                        │  │
│  │  Generated Solidity Verifier                           │  │
│  │                                                        │  │
│  │  verifyProof(                                          │  │
│  │      pA,                                                │  │
│  │      pB,                                                │  │
│  │      pC,                                                │  │
│  │      pubSignals                                          │  │
│  │  )                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ E2E Test
                              │
┌─────────────────────────────┴────────────────────────────────┐
│                    testVerifyAndAccept.ts                    │
│                                                              │
│  1. Connect to Sepolia                                       │
│  2. Check AegisShield bytecode                               │
│  3. Check operator                                           │
│  4. Load proof_29.json                                       │
│  5. Load public_29.json                                      │
│  6. Register Session                                         │
│  7. Verify Session                                           │
│  8. verifyAndAccept()                                        │
│  9. Check ProofAccepted event                                │
│ 10. Check nullifier                                          │
│ 11. Replay attack test                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
  攻撃耐性テスト
┌──────────────────────────────────────────────────────────────┐
│                AegisShield.penetration.ts                    │
│                                                              │
│  PT-01  Unauthorized Registration                            │
│  PT-02  Unauthorized Deactivation                            │
│  PT-03  Disallowed Purpose                                   │
│  PT-04  Double Deactivation                                  │
│  PT-05  Unknown Session                                      │
│  PT-06  Nullifier Replay                                     │
│  PT-07  Unregistered Session                                 │
│  PT-08  Deactivated Session                                  │
│  PT-09  Session ID Spoofing                                  │
│  PT-10  Cross-Session Proof                                  │
│  PT-11  Purpose Binding                                      │
│  PT-12  Session ID Re-registration                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘