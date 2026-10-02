#!/usr/bin/env node
import { getContractAddress, getAddress, isAddress } from "viem";

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

export function planMainnetDeployment({ deployer, startingNonce }) {
  if (!isAddress(deployer)) throw new Error("deployer must be a valid Ethereum address");
  if (!Number.isSafeInteger(startingNonce) || startingNonce < 0) {
    throw new Error("startingNonce must be a non-negative safe integer");
  }

  const normalizedDeployer = getAddress(deployer);
  const verifier = getContractAddress({
    from: normalizedDeployer,
    nonce: BigInt(startingNonce),
  });
  const registry = getContractAddress({
    from: normalizedDeployer,
    nonce: BigInt(startingNonce + 1),
  });
  const shield = getContractAddress({
    from: normalizedDeployer,
    nonce: BigInt(startingNonce + 2),
  });

  return {
    chainId: 1,
    deployer: normalizedDeployer,
    startingNonce,
    verifierNonce: startingNonce,
    registryNonce: startingNonce + 1,
    shieldNonce: startingNonce + 2,
    verifier,
    registry,
    shield,
    requiresContiguousNonces: true,
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const deployer = process.env.AEGIS_MAINNET_EXPECTED_DEPLOYER;
  const nonceText = process.env.AEGIS_MAINNET_DEPLOYER_NONCE;

  if (!deployer || !isAddress(deployer)) {
    fail("AEGIS_MAINNET_EXPECTED_DEPLOYER must be a valid Ethereum address");
  }
  if (!nonceText || !/^\\d+$/.test(nonceText)) {
    fail("AEGIS_MAINNET_DEPLOYER_NONCE must be a non-negative integer");
  }

  if (!process.exitCode) {
    const plan = planMainnetDeployment({
      deployer,
      startingNonce: Number(nonceText),
    });

    console.log("Ethereum Mainnet deterministic deployment plan");
    console.log(`Deployer: ${plan.deployer}`);
    console.log(`Starting nonce: ${plan.startingNonce}`);
    console.log(`Production verifier (nonce ${plan.verifierNonce}): ${plan.verifier}`);
    console.log(`Canonical registry (nonce ${plan.registryNonce}): ${plan.registry}`);
    console.log(`AegisShieldV2 (nonce ${plan.shieldNonce}): ${plan.shield}`);
    console.log("Nonce policy: these deployments must be contiguous; no transaction may consume an intervening nonce.");
    console.log("No transaction was created or broadcast.");
  }
}
