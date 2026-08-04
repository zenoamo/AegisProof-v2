
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { network } from "hardhat";

describe("AegisShield Penetration Tests", async function () {
  const { viem } = await network.create();

  // ==========================================
  // Deploy
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
      verifier,
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

    // ==========================================
    // Groth16 Proof
    // ==========================================

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

    // ==========================================
    // Canonical Public Signal Layout
    //
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
    // [24] modelManifestCommitment
    // [25] executionEnvCommitment
    // [26] generationCommitment
    // [27] commitment
    // [28] nullifier
    //
    // ==========================================

    const signals =
      publicSignals.map(
        (value: string) =>
          BigInt(value)
      ) as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint
      ];

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
      const {
        shield,
      } = await deployShield();

      const [
        ,
        attacker,
      ] =
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
      const {
        shield,
      } = await deployShield();

      const [
        ,
        attacker,
      ] =
        await viem.getWalletClients();

      const sessionId =
        1002n;

      await shield.write.registerSession(
        [
          sessionId,
          0n,
        ]
      );

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
        await shield.read.sessions(
          [
            sessionId,
          ]
        ) as readonly [
          bigint,
          boolean
        ];

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
      const {
        shield,
      } = await deployShield();

      await assert.rejects(
        shield.write.registerSession(
          [
            1003n,
            999n,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const sessionId =
        1004n;

      await shield.write.registerSession(
        [
          sessionId,
          0n,
        ]
      );

      await shield.write.deactivateSession(
        [
          sessionId,
        ]
      );

      await assert.rejects(
        shield.write.deactivateSession(
          [
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-05
  // Unknown Session
  // ==========================================

  it(
    "PT-05: Should reject deactivation of a never-registered session",
    async function () {
      const {
        shield,
      } = await deployShield();

      await assert.rejects(
        shield.write.deactivateSession(
          [
            999999n,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-06
  // Cross-Session Nullifier Replay
  // ==========================================

  it(
    "PT-06: Should reject cross-session replay of the same nullifier",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      const nullifier =
        signals[28];

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await shield.write.verifyAndAccept(
        [
          pA,
          pB,
          pC,
          signals,
          sessionId,
        ]
      );

      const used =
        await shield.read.usedNullifiers(
          [
            nullifier,
          ]
        );

      assert.equal(
        used,
        true
      );

      const anotherSessionId =
        sessionId + 1n;

      await shield.write.registerSession(
        [
          anotherSessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            anotherSessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await shield.write.deactivateSession(
        [
          sessionId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const correctSessionId =
        signals[2];

      const spoofedSessionId =
        correctSessionId + 1n;

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          correctSessionId,
          purposeId,
        ]
      );

      await shield.write.registerSession(
        [
          spoofedSessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            spoofedSessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const originalSessionId =
        signals[2];

      const anotherSessionId =
        originalSessionId + 1n;

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          originalSessionId,
          purposeId,
        ]
      );

      await shield.write.registerSession(
        [
          anotherSessionId,
          purposeId,
        ]
      );

      await shield.write.verifyAndAccept(
        [
          pA,
          pB,
          pC,
          signals,
          originalSessionId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            anotherSessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const proofPurposeId =
        signals[3];

      const mismatchedPurposeId =
        proofPurposeId === 0n
          ? 1n
          : 0n;

      await shield.write.registerSession(
        [
          sessionId,
          mismatchedPurposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ]
        )
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
      const {
        shield,
      } = await deployShield();

      const {
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await shield.write.deactivateSession(
        [
          sessionId,
        ]
      );

      await assert.rejects(
        shield.write.registerSession(
          [
            sessionId,
            purposeId,
          ]
        )
      );

      const exists =
        await shield.read.sessionExists(
          [
            sessionId,
          ]
        );

      assert.equal(
        exists,
        true
      );

      const session =
        await shield.read.sessions(
          [
            sessionId,
          ]
        ) as readonly [
          bigint,
          boolean
        ];

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

  // ==========================================
  // PT-13
  // Complete Proof Replay
  // ==========================================

  it(
    "PT-13: Should reject complete replay of the same proof",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      // First submission must succeed

      await shield.write.verifyAndAccept(
        [
          pA,
          pB,
          pC,
          signals,
          sessionId,
        ]
      );

      // Exact same proof replay must fail

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-14
  // Public Signal Tampering
  // ==========================================

  it(
    "PT-14: Should reject tampered public signals",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      const tamperedSignals =
        [
          ...signals,
        ] as [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ];

      // Tamper with an unrelated public signal

      tamperedSignals[0] =
        tamperedSignals[0] + 1n;

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            tamperedSignals,
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-15
  // Purpose ID Tampering
  // ==========================================

  it(
    "PT-15: Should reject purpose ID tampering",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      const tamperedSignals =
        [
          ...signals,
        ] as [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ];

      tamperedSignals[3] =
        purposeId === 0n
          ? 1n
          : 0n;

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            tamperedSignals,
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-16
  // Commitment Tampering
  // ==========================================

  it(
    "PT-16: Should reject commitment tampering",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      const tamperedSignals =
        [
          ...signals,
        ] as [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ];

      tamperedSignals[27] =
        tamperedSignals[27] + 1n;

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            tamperedSignals,
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-17
  // Nullifier Tampering
  // ==========================================

  it(
    "PT-17: Should reject nullifier tampering",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      const tamperedSignals =
        [
          ...signals,
        ] as [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ];

      tamperedSignals[28] =
        tamperedSignals[28] + 1n;

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            tamperedSignals,
            sessionId,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-18
  // Zero Session ID
  // ==========================================

  it(
    "PT-18: Should reject zero Session ID",
    async function () {
      const {
        shield,
      } = await deployShield();

      await assert.rejects(
        shield.write.registerSession(
          [
            0n,
            0n,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-19
  // Zero Purpose ID
  // ==========================================

  it(
    "PT-19: Should allow valid zero Purpose ID",
    async function () {
      const {
        shield,
      } = await deployShield();

      const sessionId =
        19000n;

      await shield.write.registerSession(
        [
          sessionId,
          0n,
        ]
      );

      const session =
        await shield.read.sessions(
          [
            sessionId,
          ]
        ) as readonly [
          bigint,
          boolean
        ];

      assert.equal(
        session[0],
        0n
      );

      assert.equal(
        session[1],
        true
      );
    }
  );

  // ==========================================
  // PT-20
  // Unknown Purpose ID
  // ==========================================

  it(
    "PT-20: Should reject an unknown Purpose ID",
    async function () {
      const {
        shield,
      } = await deployShield();

      await assert.rejects(
        shield.write.registerSession(
          [
            20000n,
            999999n,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-21
  // Session ID Collision
  // ==========================================

  it(
    "PT-21: Should reject Session ID collision",
    async function () {
      const {
        shield,
      } = await deployShield();

      const sessionId =
        21000n;

      await shield.write.registerSession(
        [
          sessionId,
          0n,
        ]
      );

      await assert.rejects(
        shield.write.registerSession(
          [
            sessionId,
            0n,
          ]
        )
      );
    }
  );

  // ==========================================
  // PT-22
  // Deactivated Session Replay
  // ==========================================

  it(
    "PT-22: Should reject proof submission after session deactivation",
    async function () {
      const {
        shield,
      } = await deployShield();

      const {
        pA,
        pB,
        pC,
        signals,
      } =
        await loadProof();

      const sessionId =
        signals[2];

      const purposeId =
        signals[3];

      await shield.write.registerSession(
        [
          sessionId,
          purposeId,
        ]
      );

      await shield.write.deactivateSession(
        [
          sessionId,
        ]
      );

      await assert.rejects(
        shield.write.verifyAndAccept(
          [
            pA,
            pB,
            pC,
            signals,
            sessionId,
          ]
        )
      );
    }
  );
});

