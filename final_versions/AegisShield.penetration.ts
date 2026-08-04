import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { network } from "hardhat";

// ==========================================
// Public Signal Index
// ==========================================
// snarkjs public signal ordering:
//
// Public Inputs:
// [0]  expectedPromptRoot
// [1]  expectedOutputRoot
// [2]  sessionId
// [3]  purposeId
// [4]  weightsHash
// [5]  tokenizerHash
// [6]  systemPromptHash
// [7]  loraHash
// [8]  adapterHash
// [9]  safetyLayerHash
// [10] quantizationHash
// [11] precisionHash
// [12] runtimeHash
// [13] driverHash
// [14] temperature
// [15] topP
// [16] topK
// [17] seed
// [18] repetitionPenalty
// [19] presencePenalty
// [20] frequencyPenalty
// [21] maxTokens
// [22] protocolVersion
// [23] timestamp
//
// Outputs:
// [24] modelManifestCommitment
// [25] executionEnvCommitment
// [26] generationCommitment
// [27] commitment
// [28] nullifier
// ==========================================

const SESSION_ID_INDEX = 2;
const PURPOSE_ID_INDEX = 3;
const COMMITMENT_INDEX = 27;
const NULLIFIER_INDEX = 28;

describe(
  "AegisShield Penetration Tests",
  async function () {
    const { viem } = await network.create();

    // ==========================================
    // Type Definitions
    // ==========================================

    type Signals29 = readonly [
      bigint, bigint, bigint, bigint, bigint,
      bigint, bigint, bigint, bigint, bigint,
      bigint, bigint, bigint, bigint, bigint,
      bigint, bigint, bigint, bigint, bigint,
      bigint, bigint, bigint, bigint, bigint,
      bigint, bigint, bigint, bigint
    ];

    type SessionData = readonly [
      bigint,
      boolean
    ];

    // ==========================================
    // Deploy AegisShield
    // ==========================================

    async function deployShield() {
      const verifier =
        await viem.deployContract(
          "contracts/Groth16Verifier29.sol:Groth16Verifier"
        );

      const [operator] =
        await viem.getWalletClients();

      const shield =
        await viem.deployContract(
          "AegisShield",
          [
            verifier.address,
            operator.account.address,
          ]
        );

      return {
        shield,
        operator,
      };
    }

    // ==========================================
    // Load Proof
    // ==========================================

    async function loadProof() {
      const proof =
        JSON.parse(
          fs.readFileSync(
            "build/proofs/proof_29.json",
            "utf8"
          )
        );

      const publicSignals =
        JSON.parse(
          fs.readFileSync(
            "build/proofs/public_29.json",
            "utf8"
          )
        );

      assert.equal(
        publicSignals.length,
        29,
        "Expected exactly 29 public signals"
      );

      const pA = [
        BigInt(proof.pi_a[0]),
        BigInt(proof.pi_a[1]),
      ] as const;

      const pB = [
        [
          BigInt(proof.pi_b[0][1]),
          BigInt(proof.pi_b[0][0]),
        ],
        [
          BigInt(proof.pi_b[1][1]),
          BigInt(proof.pi_b[1][0]),
        ],
      ] as const;

      const pC = [
        BigInt(proof.pi_c[0]),
        BigInt(proof.pi_c[1]),
      ] as const;

      const signals =
        publicSignals.map(
          (value: string) =>
            BigInt(value)
        ) as Signals29;

      return {
        pA,
        pB,
        pC,
        signals,
      };
    }

    // ==========================================
    // PT-01
    // Unauthorized Session Registration
    // ==========================================

    it(
      "PT-01: Should reject unauthorized session registration",
      async function () {
        const { shield } =
          await deployShield();

        const [, attacker] =
          await viem.getWalletClients();

        await assert.rejects(
          shield.write.registerSession(
            [
              1001n,
              0n,
            ],
            {
              account:
                attacker.account,
            }
          )
        );
      }
    );

    // ==========================================
    // PT-02
    // Unauthorized Session Deactivation
    // ==========================================

    it(
      "PT-02: Should reject unauthorized session deactivation",
      async function () {
        const { shield } =
          await deployShield();

        const [, attacker] =
          await viem.getWalletClients();

        const sessionId =
          1002n;

        await shield.write.registerSession([
          sessionId,
          0n,
        ]);

        await assert.rejects(
          shield.write.deactivateSession(
            [
              sessionId,
            ],
            {
              account:
                attacker.account,
            }
          )
        );

        const session =
          await shield.read.sessions([
            sessionId,
          ]) as SessionData;

        assert.equal(
          session[1],
          true
        );
      }
    );

    // ==========================================
    // PT-03
    // Disallowed Purpose ID
    // ==========================================

    it(
      "PT-03: Should reject a disallowed purpose ID",
      async function () {
        const { shield } =
          await deployShield();

        await assert.rejects(
          shield.write.registerSession([
            1003n,
            999n,
          ])
        );
      }
    );

    // ==========================================
    // PT-04
    // Double Deactivation
    // ==========================================

    it(
      "PT-04: Should reject deactivation of an inactive session",
      async function () {
        const { shield } =
          await deployShield();

        const sessionId =
          1004n;

        await shield.write.registerSession([
          sessionId,
          0n,
        ]);

        await shield.write.deactivateSession([
          sessionId,
        ]);

        await assert.rejects(
          shield.write.deactivateSession([
            sessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-05
    // Deactivation of Unknown Session
    // ==========================================

    it(
      "PT-05: Should reject deactivation of a never-registered session",
      async function () {
        const { shield } =
          await deployShield();

        await assert.rejects(
          shield.write.deactivateSession([
            999999n,
          ])
        );
      }
    );

    // ==========================================
    // PT-06
    // Nullifier Replay
    // ==========================================

    it(
      "PT-06: Should reject replay of the same nullifier",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const sessionId =
          signals[SESSION_ID_INDEX];

        const purposeId =
          signals[PURPOSE_ID_INDEX];

        const commitment =
          signals[COMMITMENT_INDEX];

        const nullifier =
          signals[NULLIFIER_INDEX];

        // ========================================
        // 1. Register Session
        // ========================================

        await shield.write.registerSession([
          sessionId,
          purposeId,
        ]);

        // ========================================
        // 2. First Submission
        // ========================================

        await shield.write.verifyAndAccept([
          pA,
          pB,
          pC,
          signals,
          sessionId,
        ]);

        // ========================================
        // 3. Confirm Nullifier Used
        // ========================================

        const used =
          await shield.read.usedNullifiers([
            nullifier,
          ]);

        assert.equal(
          used,
          true
        );

        // ========================================
        // 4. Confirm Commitment
        // ========================================

        assert.notEqual(
          commitment,
          0n,
          "Commitment should not be zero"
        );

        // ========================================
        // 5. Replay Same Proof
        //
        // Same:
        // - Session
        // - Commitment
        // - Nullifier
        // - Proof
        //
        // Expected:
        // "Nullifier already used"
        // ========================================

        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-07
    // Unregistered Session
    // ==========================================

    it(
      "PT-07: Should reject a valid proof for an unregistered session",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const sessionId =
          signals[SESSION_ID_INDEX];

        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-08
    // Deactivated Session
    // ==========================================

    it(
      "PT-08: Should reject a valid proof for a deactivated session",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const sessionId =
          signals[SESSION_ID_INDEX];

        const purposeId =
          signals[PURPOSE_ID_INDEX];

        await shield.write.registerSession([
          sessionId,
          purposeId,
        ]);

        await shield.write.deactivateSession([
          sessionId,
        ]);

        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-09
    // Session ID Spoofing
    // ==========================================

    it(
      "PT-09: Should reject session ID spoofing",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const correctSessionId =
          signals[SESSION_ID_INDEX];

        const spoofedSessionId =
          correctSessionId + 1n;

        const purposeId =
          signals[PURPOSE_ID_INDEX];

        await shield.write.registerSession([
          correctSessionId,
          purposeId,
        ]);

        await shield.write.registerSession([
          spoofedSessionId,
          purposeId,
        ]);

        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            spoofedSessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-10
    // Same Proof Against Another Session
    // ==========================================

    it(
      "PT-10: Should reject the same proof when submitted against another session",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const originalSessionId =
          signals[SESSION_ID_INDEX];

        const anotherSessionId =
          originalSessionId + 1n;

        const purposeId =
          signals[PURPOSE_ID_INDEX];

        await shield.write.registerSession([
          originalSessionId,
          purposeId,
        ]);

        await shield.write.registerSession([
          anotherSessionId,
          purposeId,
        ]);

        // First submission must succeed.
        await shield.write.verifyAndAccept([
          pA,
          pB,
          pC,
          signals,
          originalSessionId,
        ]);

        // Same proof contains originalSessionId.
        // Passing anotherSessionId must fail
        // with Session mismatch.
        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            anotherSessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-11
    // Purpose Binding
    // ==========================================

    it(
      "PT-11: Should reject a valid proof when Session Purpose ID differs from Proof Purpose ID",
      async function () {
        const { shield } =
          await deployShield();

        const {
          pA,
          pB,
          pC,
          signals,
        } = await loadProof();

        const sessionId =
          signals[SESSION_ID_INDEX];

        const proofPurposeId =
          signals[PURPOSE_ID_INDEX];

        const mismatchedPurposeId =
          proofPurposeId === 0n
            ? 1n
            : 0n;

        await shield.write.registerSession([
          sessionId,
          mismatchedPurposeId,
        ]);

        await assert.rejects(
          shield.write.verifyAndAccept([
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ])
        );
      }
    );

    // ==========================================
    // PT-12
    // Session ID Re-registration
    // ==========================================

    it(
      "PT-12: Should reject re-registration of a previously registered and deactivated Session ID",
      async function () {
        const { shield } =
          await deployShield();

        const {
          signals,
        } = await loadProof();

        const sessionId =
          signals[SESSION_ID_INDEX];

        const purposeId =
          signals[PURPOSE_ID_INDEX];

        // 1. Register Session
        await shield.write.registerSession([
          sessionId,
          purposeId,
        ]);

        // 2. Deactivate Session
        await shield.write.deactivateSession([
          sessionId,
        ]);

        // 3. Attempt re-registration
        await assert.rejects(
          shield.write.registerSession([
            sessionId,
            purposeId,
          ])
        );

        // 4. Session must still exist
        const exists =
          await shield.read.sessionExists([
            sessionId,
          ]);

        assert.equal(
          exists,
          true
        );

        // 5. Session must remain inactive
        const session =
          await shield.read.sessions([
            sessionId,
          ]) as SessionData;

        assert.equal(
          session[0],
          purposeId
        );

        assert.equal(
          session[1],
          false
        );
      }
      
    );
  }
);
