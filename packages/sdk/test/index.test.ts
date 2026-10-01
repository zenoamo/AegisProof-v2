import assert from "node:assert/strict";
import {
  EXPECTED_SIGNAL_COUNT,
  SIGNAL_INDEX_MAP,
  SIGNAL_NAMES,
  buildPublicSignals,
  grothProofToCalldata,
  parsePublicSignals,
  toCalldataSignals,
  validateSignalCount,
  InvalidSignalCountError,
  SignalMappingError,
} from "../src/core";

assert.equal(EXPECTED_SIGNAL_COUNT, 30);
assert.equal(SIGNAL_NAMES.length, 30);
assert.deepEqual(
  SIGNAL_NAMES,
  Object.keys(SIGNAL_INDEX_MAP),
);

assert.equal(SIGNAL_INDEX_MAP.expectedPromptRoot, 0);
assert.equal(SIGNAL_INDEX_MAP.sessionId, 2);
assert.equal(SIGNAL_INDEX_MAP.chainId, 22);
assert.equal(SIGNAL_INDEX_MAP.timestamp, 24);
assert.equal(SIGNAL_INDEX_MAP.commitment, 28);
assert.equal(SIGNAL_INDEX_MAP.nullifier, 29);

const named = Object.fromEntries(
  SIGNAL_NAMES.map((name, index) => [name, String(index + 1)]),
);
const signals = buildPublicSignals(named);

assert.equal(signals.length, 30);
assert.equal(signals[0], "1");
assert.equal(signals[22], "23");
assert.equal(signals[24], "25");
assert.equal(signals[29], "30");
assert.deepEqual(parsePublicSignals(signals), named);

assert.throws(
  () => buildPublicSignals({ timestamp: "123" }),
  SignalMappingError,
);
assert.throws(
  () => validateSignalCount(signals.slice(0, 29)),
  InvalidSignalCountError,
);

const calldata = toCalldataSignals(signals);
assert.equal(calldata[0], "0".repeat(63) + "1");
assert.equal(calldata[29], "0".repeat(62) + "30");

const proof = {
  pi_a: ["1", "2"] as const,
  pi_b: [
    ["3", "4"],
    ["5", "6"],
  ] as const,
  pi_c: ["7", "8"] as const,
};

const proofCalldata = grothProofToCalldata(proof);
assert.deepEqual(proofCalldata.pA, [1n, 2n]);
assert.deepEqual(proofCalldata.pB, [[4n, 3n], [6n, 5n]]);
assert.deepEqual(proofCalldata.pC, [7n, 8n]);

console.log("SDK unit tests: PASS");
