import test from "node:test";
import assert from "node:assert/strict";
import { getContractAddress } from "viem";
import { planMainnetDeployment } from "../../scripts/mainnet-deployment-plan.mjs";

test("plans contiguous Mainnet deployment addresses from deployer nonce", () => {
  const deployer = "0x000000000000000000000000000000000000dEaD";
  const startingNonce = 7;
  const plan = planMainnetDeployment({ deployer, startingNonce });

  assert.equal(plan.chainId, 1);
  assert.equal(plan.startingNonce, 7);
  assert.equal(plan.requiresContiguousNonces, true);
  assert.equal(
    plan.verifier,
    getContractAddress({ from: deployer, nonce: 7n }),
  );
  assert.equal(
    plan.registry,
    getContractAddress({ from: deployer, nonce: 8n }),
  );
  assert.equal(
    plan.shield,
    getContractAddress({ from: deployer, nonce: 9n }),
  );
  assert.notEqual(plan.verifier, plan.registry);
  assert.notEqual(plan.registry, plan.shield);
});

test("rejects an invalid deployer address", () => {
  assert.throws(
    () => planMainnetDeployment({ deployer: "not-an-address", startingNonce: 0 }),
    /deployer must be a valid Ethereum address/,
  );
});

test("rejects an invalid starting nonce", () => {
  assert.throws(
    () => planMainnetDeployment({ deployer: "0x000000000000000000000000000000000000dEaD", startingNonce: -1 }),
    /startingNonce must be a non-negative safe integer/,
  );
});
