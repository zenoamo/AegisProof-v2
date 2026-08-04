// ============================================================================
// AegisShieldV2 + Groth16VerifierV2 development test.
// ----------------------------------------------------------------------------
// Run: npx hardhat run test/AegisShieldV2.ts
// Uses the in-process hardhat network (no external node required) and the
// frozen Phase 2 baseline proof at artifacts/phase2/proofs/proof_v2_baseline.json.
// The DEV verifier is generated from a single-contribution dev zkey — this
// test validates the v2 contract policy, not the production setup.
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// SSoT policy values (specs/aegis-protocol.v2.json contractPolicy)
const MAX_AGE = 86400n;
const SKEW = 300n;

interface Baseline {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
}

const baseline: Baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/phase2/proofs/proof_v2_baseline.json"), "utf8")
);

// snarkjs proof -> Solidity calldata (G2 coordinate order swapped)
const pA = [baseline.proof.pi_a[0], baseline.proof.pi_a[1]] as unknown as readonly [bigint, bigint];
const pB = [
  [baseline.proof.pi_b[0][1], baseline.proof.pi_b[0][0]],
  [baseline.proof.pi_b[1][1], baseline.proof.pi_b[1][0]],
] as unknown as readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
const pC = [baseline.proof.pi_c[0], baseline.proof.pi_c[1]] as unknown as readonly [bigint, bigint];

const PROOF_TS = BigInt(baseline.publicSignals[24]); // signal 24 = timestamp
const NULLIFIER = baseline.publicSignals[29]; // signal 29 = nullifier
const SESSION_ID = BigInt(baseline.publicSignals[2]); // signal 2 = sessionId
const PURPOSE_ID = BigInt(baseline.publicSignals[3]); // signal 3 = purposeId

let passed = 0;
function ok(cond: boolean, name: string) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

async function expectRevert(p: Promise<unknown>, needle: string, name: string) {
  try {
    await p;
    assert.fail(`${name}: expected revert, but the transaction succeeded`);
  } catch (e: any) {
    const msg: string = String(e?.shortMessage ?? e?.message ?? e);
    assert.ok(msg.includes(needle), `${name}: expected "${needle}" in: ${msg.slice(0, 400)}`);
  }
  passed++;
  console.log(`PASS ${name}`);
}

async function main() {
  const { viem } = await network.connect(); // built-in in-process "default" network (Hardhat 3)
  const [deployer, outsider] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const chainId = await publicClient.getChainId();
  assert.equal(chainId, 31337, "test network chainId must be 31337 (matches baseline proof)");

  // ---------------------------------------------------------------- deploy
  const verifier = await viem.deployContract(
    "contracts/Groth16VerifierV2.sol:Groth16VerifierV2"
  );
  ok((await publicClient.getBytecode({ address: verifier.address })) !== undefined, "verifier bytecode deployed");

  const shield = await viem.deployContract("AegisShieldV2", [
    verifier.address,
    deployer.account.address,
  ]);
  ok((await publicClient.getBytecode({ address: shield.address })) !== undefined, "shield bytecode deployed");

  assert.equal(
    String(await shield.read.verifier()).toLowerCase(),
    verifier.address.toLowerCase(),
    "constructor: verifier stored"
  );
  assert.equal(
    String(await shield.read.operator()).toLowerCase(),
    deployer.account.address.toLowerCase(),
    "constructor: operator stored"
  );
  ok(true, "constructor state consistent");

  // ---------------------------------------------------------------- setup
  await shield.write.setPurposeAllowed([PURPOSE_ID, true]);
  await shield.write.registerSession([SESSION_ID, PURPOSE_ID]);
  ok(await shield.read.sessionExists([SESSION_ID]), "session 777 registered");

  const setNextTs = (ts: bigint) =>
    publicClient.request({
      method: "evm_setNextBlockTimestamp" as never,
      params: [Number(ts)] as never,
    });

  // Pin the chain clock inside the baseline proof's validity window.
  await setNextTs(PROOF_TS + 60n);

  // ------------------------------------------------- positive: accept proof
  await shield.write.verifyAndAccept([pA, pB, pC, baseline.publicSignals as never, SESSION_ID]);
  ok(await shield.read.usedNullifiers([BigInt(NULLIFIER)]), "baseline proof accepted; nullifier consumed");

  // ------------------------------------------------- negative: replay
  await expectRevert(
    shield.write.verifyAndAccept([pA, pB, pC, baseline.publicSignals as never, SESSION_ID]),
    "Nullifier already used",
    "replay rejected (same nullifier)"
  );

  // ------------------------------------------------- negative: tampered content signal
  const tampered = [...baseline.publicSignals];
  tampered[0] = (BigInt(tampered[0]) + 1n).toString(); // expectedPromptRoot -> proof invalid
  await expectRevert(
    shield.write.verifyAndAccept([pA, pB, pC, tampered as never, SESSION_ID]),
    "Invalid proof",
    "tampered content signal rejected by verifier"
  );

  // ------------------------------------------------- negative: wrong chainId
  const wrongChain = [...baseline.publicSignals];
  wrongChain[22] = "1"; // chainId is bound into the nullifier -> proof invalid
  await expectRevert(
    shield.write.verifyAndAccept([pA, pB, pC, wrongChain as never, SESSION_ID]),
    "Invalid proof",
    "cross-chain proof rejected (chainId bound in nullifier)"
  );

  // ------------------------------------------------- negative: timestamp in future
  // timestamp is NOT bound in either hash, so a VALID proof can carry any
  // timestamp; the contract-layer window check is the only control and must
  // reject it. proof_v2_future_ts.json is a genuine proof (dev zkey) whose
  // declared timestamp is +1000000s (generate: scripts/gen_future_ts_proof.mjs).
  // (Must run before any forward time jump — EVM time cannot rewind.)
  const futureProof = JSON.parse(
    fs.readFileSync(path.join(ROOT, "artifacts/phase2/tests/proof_v2_future_ts.json"), "utf8")
  );
  const fpA = [futureProof.proof.pi_a[0], futureProof.proof.pi_a[1]] as never;
  const fpB = [
    [futureProof.proof.pi_b[0][1], futureProof.proof.pi_b[0][0]],
    [futureProof.proof.pi_b[1][1], futureProof.proof.pi_b[1][0]],
  ] as never;
  const fpC = [futureProof.proof.pi_c[0], futureProof.proof.pi_c[1]] as never;
  await setNextTs(PROOF_TS + 120n);
  await expectRevert(
    shield.write.verifyAndAccept([fpA, fpB, fpC, futureProof.publicSignals as never, SESSION_ID]),
    "Timestamp in future",
    "valid proof with untrusted future timestamp rejected by window check"
  );

  // ------------------------------------------------- negative: inactive session
  await shield.write.deactivateSession([SESSION_ID]);
  await setNextTs(PROOF_TS + 180n);
  await expectRevert(
    shield.write.verifyAndAccept([pA, pB, pC, baseline.publicSignals as never, SESSION_ID]),
    "Session inactive",
    "deactivated session rejected"
  );

  // ------------------------------------------------- negative: timestamp too old
  // (last: jumps the clock past the validity window permanently)
  await setNextTs(PROOF_TS + MAX_AGE + SKEW + 100n);
  await expectRevert(
    shield.write.verifyAndAccept([pA, pB, pC, baseline.publicSignals as never, SESSION_ID]),
    "Timestamp too old",
    "expired timestamp window rejected"
  );

  // ------------------------------------------------- negative: unauthorized caller
  const shieldAsOutsider = await viem.getContractAt("AegisShieldV2", shield.address, {
    client: { wallet: outsider },
  });
  await expectRevert(
    shieldAsOutsider.write.verifyAndAccept([pA, pB, pC, baseline.publicSignals as never, SESSION_ID]),
    "Unauthorized caller",
    "non-operator caller rejected"
  );

  console.log(`\nAegisShieldV2 TESTS: ${passed}/${passed} PASS`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("");
    console.error("AegisShieldV2 TEST FAILED");
    console.error(error);
    process.exit(1);
  });
