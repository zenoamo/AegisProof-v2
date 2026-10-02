#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import { planMainnetDeployment } from "./mainnet-deployment-plan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "protocol", "contracts", "AegisCanonicalRegistry.sol");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

export function renderCanonicalRegistry({ verifier, registry }) {
  if (!isAddress(verifier)) throw new Error("verifier must be a valid Ethereum address");
  if (!isAddress(registry)) throw new Error("registry must be a valid Ethereum address");

  const normalizedVerifier = getAddress(verifier);
  const normalizedRegistry = getAddress(registry);

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AegisCanonicalRegistry
/// @notice Chain-specific canonical Aegis deployment addresses.
/// @dev Mainnet addresses are generated from the approved deterministic
///      deployment plan. Do not replace them with placeholders or local
///      development addresses.
library AegisCanonicalRegistry {
    uint256 internal constant HARDHAT_CHAIN_ID = 31337;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    address internal constant HARDHAT_VERIFIER =
        0x5fbdb2315678afecb367f032d93f642f64180aa3;

    address internal constant HARDHAT_REGISTRY =
        0xe7f1725e7734ce288f8367e1bb143e90bb3f0512;

    address internal constant MAINNET_VERIFIER =
        ${normalizedVerifier};

    address internal constant MAINNET_REGISTRY =
        ${normalizedRegistry};

    function verifierForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
            return HARDHAT_VERIFIER;
        }
        if (chainId == MAINNET_CHAIN_ID) {
            return MAINNET_VERIFIER;
        }
        return address(0);
    }

    function registryForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
            return HARDHAT_REGISTRY;
        }
        if (chainId == MAINNET_CHAIN_ID) {
            return MAINNET_REGISTRY;
        }
        return address(0);
    }

    function forChain(uint256 chainId) internal pure returns (address) {
        return registryForChain(chainId);
    }
}
`;
}

export function generateMainnetCanonicalRegistry({ deployer, startingNonce }) {
  const plan = planMainnetDeployment({ deployer, startingNonce });
  return {
    plan,
    source: renderCanonicalRegistry({
      verifier: plan.verifier,
      registry: plan.registry,
    }),
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const deployer = process.env.AEGIS_MAINNET_EXPECTED_DEPLOYER;
  const nonceText = process.env.AEGIS_MAINNET_DEPLOYER_NONCE;

  if (!deployer || !isAddress(deployer)) {
    fail("AEGIS_MAINNET_EXPECTED_DEPLOYER must be a valid Ethereum address");
  }
  if (!nonceText || !/^\d+$/.test(nonceText)) {
    fail("AEGIS_MAINNET_DEPLOYER_NONCE must be a non-negative integer");
  }

  if (!process.exitCode) {
    const { plan, source } = generateMainnetCanonicalRegistry({
      deployer,
      startingNonce: Number(nonceText),
    });

    fs.writeFileSync(TARGET, source);
    console.log("Generated Mainnet canonical registry");
    console.log(`Deployer: ${plan.deployer}`);
    console.log(`Starting nonce: ${plan.startingNonce}`);
    console.log(`MAINNET_VERIFIER: ${plan.verifier}`);
    console.log(`MAINNET_REGISTRY: ${plan.registry}`);
    console.log(`Output: ${TARGET}`);
    console.log("No transaction was created or broadcast.");
  }
}
