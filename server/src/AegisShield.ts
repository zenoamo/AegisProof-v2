
export const aegisShieldAbi = [
  // ==========================================
  // sessionExists(uint256)
  // ==========================================
  {
    type: "function",
    name: "sessionExists",
    stateMutability: "view",
    inputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },

  // ==========================================
  // sessions(uint256)
  // ==========================================
  {
    type: "function",
    name: "sessions",
    stateMutability: "view",
    inputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "purposeId",
        type: "uint256",
      },
      {
        name: "active",
        type: "bool",
      },
    ],
  },

  // ==========================================
  // usedNullifiers(uint256)
  // ==========================================
  {
    type: "function",
    name: "usedNullifiers",
    stateMutability: "view",
    inputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },

  // ==========================================
  // registerSession(uint256, uint256)
  // ==========================================
  {
    type: "function",
    name: "registerSession",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "sessionId",
        type: "uint256",
      },
      {
        name: "purposeId",
        type: "uint256",
      },
    ],
    outputs: [],
  },

  // ==========================================
  // deactivateSession(uint256)
  // ==========================================
  {
    type: "function",
    name: "deactivateSession",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "sessionId",
        type: "uint256",
      },
    ],
    outputs: [],
  },

  // ==========================================
  // verifyAndAccept(
  //   uint[2] pA,
  //   uint[2][2] pB,
  //   uint[2] pC,
  //   uint[29] pubSignals,
  //   uint256 expectedSessionId
  // )
  // ==========================================
  {
    type: "function",
    name: "verifyAndAccept",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "pA",
        type: "uint256[2]",
      },
      {
        name: "pB",
        type: "uint256[2][2]",
      },
      {
        name: "pC",
        type: "uint256[2]",
      },
      {
        name: "pubSignals",
        type: "uint256[29]",
      },
      {
        name: "expectedSessionId",
        type: "uint256",
      },
    ],
    outputs: [],
  },

  // ==========================================
  // ProofAccepted Event
  // ==========================================
  {
    type: "event",
    name: "ProofAccepted",
    anonymous: false,
    inputs: [
      {
        name: "sessionId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "commitment",
        type: "uint256",
        indexed: true,
      },
      {
        name: "nullifier",
        type: "uint256",
        indexed: true,
      },
    ],
  },

  // ==========================================
  // SessionRegistered Event
  // ==========================================
  {
    type: "event",
    name: "SessionRegistered",
    anonymous: false,
    inputs: [
      {
        name: "sessionId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "purposeId",
        type: "uint256",
        indexed: true,
      },
    ],
  },

  // ==========================================
  // SessionDeactivated Event
  // ==========================================
  {
    type: "event",
    name: "SessionDeactivated",
    anonymous: false,
    inputs: [
      {
        name: "sessionId",
        type: "uint256",
        indexed: true,
      },
    ],
  },
] as const;

