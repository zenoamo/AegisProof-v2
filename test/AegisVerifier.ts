import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { network } from "hardhat";

describe("AegisVerifier", async function () {
const { viem } = await network.create();

it("Should verify a valid Groth16 proof", async function () {
// Groth16Verifier.solをDeploy
const verifier = await viem.deployContract(
  "contracts/Groth16Verifier29.sol:Groth16Verifier"
);

// snarkJSで生成したProofを読み込む
const proof = JSON.parse(
  fs.readFileSync("build/proofs/proof_29.json", "utf8")
);

// 公開シグナルを読み込む
const publicSignals = JSON.parse(
  fs.readFileSync("build/proofs/public_29.json", "utf8")
);

// snarkJS → Solidity形式に変換
const pA = [
  proof.pi_a[0],
  proof.pi_a[1],
] as const;

const pB = [
  [proof.pi_b[0][1], proof.pi_b[0][0]],
  [proof.pi_b[1][1], proof.pi_b[1][0]],
] as const;

const pC = [
  proof.pi_c[0],
  proof.pi_c[1],
] as const;

// Solidity VerifierのverifyProof()を呼び出す
const result = await verifier.read.verifyProof([
  pA,
  pB,
  pC,
  publicSignals,
]);

// 有効なProofならtrue
assert.equal(result, true);

});
});
