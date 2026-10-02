import test from "node:test";
import assert from "node:assert/strict";
import { getContractAddress } from "viem";
import {
  generateMainnetCanonicalRegistry,
  renderCanonicalRegistry,
} from "../../scripts/gen-mainnet-canonical-registry.mjs";

const deployer = "0x000000000000000000000000000000000000dEaD";
const startingNonce = 17;

test("generates Mainnet canonical addresses from the deterministic deployment plan", () => {
  const { plan, source } = generateMainnetCanonicalRegistry({
    deployer,
    startingNonce,
  });

  const expectedVerifier = getContractAddress({
    from: deployer,
    nonce: BigInt(startingNonce),
  });
  const expectedRegistry = getContractAddress({
    from: deployer,
    nonce: BigInt(startingNonce + 1),
  });

  assert.equal(plan.verifier, expectedVerifier);
  assert.equal(plan.registry, expectedRegistry);
  assert.match(source, new RegExp(`MAINNET_VERIFIER =\\s+${expectedVerifier}`));
  assert.match(source, new RegExp(`MAINNET_REGISTRY =\\s+${expectedRegistry}`));
  assert.match(source, /chainId == MAINNET_CHAIN_ID/);
  assert.match(source, /chainId == HARDHAT_CHAIN_ID/);
});

test("renders normalized checksum addresses without changing the local fixtures", () => {
  const source = renderCanonicalRegistry({
    verifier: "0x000000000000000000000000000000000000dead",
    registry: "0x000000000000000000000000000000000000beef",
  });

  assert.match(source, /0x000000000000000000000000000000000000dEaD/);
  assert.match(source, /0x000000000000000000000000000000000000bEEF/);
  assert.match(source, /0x5fbdb2315678afecb367f032d93f642f64180aa3/);
  assert.match(source, /0xe7f1725e7734ce288f8367e1bb143e90bb3f0512/);
});

test("rejects invalid deployment inputs before writing source", () => {
  assert.throws(
    () => generateMainnetCanonicalRegistry({
      deployer: "not-an-address",
      startingNonce,
    }),
    /deployer must be a valid Ethereum address/,
  );

  assert.throws(
    () => generateMainnetCanonicalRegistry({
      deployer,
      startingNonce: -1,
    }),
    /startingNonce must be a non-negative safe integer/,
  );
});
