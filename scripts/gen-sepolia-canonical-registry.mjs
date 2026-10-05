#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import { planSepoliaDeployment } from "./sepolia-deployment-plan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "protocol", "contracts", "AegisCanonicalRegistry.sol");

export function renderSepoliaCanonicalRegistry({ verifier, registry }) {
  if (!isAddress(verifier)) throw new Error("verifier must be a valid Ethereum address");
  if (!isAddress(registry)) throw new Error("registry must be a valid Ethereum address");

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library AegisCanonicalRegistry {
    uint256 internal constant HARDHAT_CHAIN_ID = 31337;
    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    address internal constant HARDHAT_VERIFIER =
        0x5fbdb2315678afecb367f032d93f642f64180aa3;
    address internal constant HARDHAT_REGISTRY =
        0xe7f1725e7734ce288f8367e1bb143e90bb3f0512;

    address internal constant SEPOLIA_VERIFIER =
        ${getAddress(verifier)};
    address internal constant SEPOLIA_REGISTRY =
        ${getAddress(registry)};

    // Mainnet remains fail-closed until authorized deployment evidence exists.
    address internal constant MAINNET_VERIFIER =
        0x014468895DB46636dCEED11A0981c3dB3d8BE146;
    address internal constant MAINNET_REGISTRY =
        0x5fECFdDE220Ecc5349f16547fa3c49fBc36A62f6;

    function verifierForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) return HARDHAT_VERIFIER;
        if (chainId == SEPOLIA_CHAIN_ID) return SEPOLIA_VERIFIER;
        return address(0);
    }

    function registryForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) return HARDHAT_REGISTRY;
        if (chainId == SEPOLIA_CHAIN_ID) return SEPOLIA_REGISTRY;
        return address(0);
    }

    function forChain(uint256 chainId) internal pure returns (address) {
        return registryForChain(chainId);
    }
}
`;
}

export function generateSepoliaCanonicalRegistry({ deployer, startingNonce }) {
  const plan = planSepoliaDeployment({ deployer, startingNonce });
  return {
    plan,
    source: renderSepoliaCanonicalRegistry({
      verifier: plan.verifier,
      registry: plan.registry,
    }),
  };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const deployer = process.env.SEPOLIA_EXPECTED_DEPLOYER;
  const nonceText = process.env.SEPOLIA_DEPLOYER_NONCE;
  if (!deployer || !isAddress(deployer)) throw new Error("SEPOLIA_EXPECTED_DEPLOYER must be a valid Ethereum address");
  if (!nonceText || !/^\d+$/.test(nonceText)) throw new Error("SEPOLIA_DEPLOYER_NONCE must be a non-negative integer");

  const { plan, source } = generateSepoliaCanonicalRegistry({
    deployer,
    startingNonce: Number(nonceText),
  });
  fs.writeFileSync(TARGET, source);
  console.log("Generated Sepolia canonical registry");
  console.log(`Deployer: ${plan.deployer}`);
  console.log(`Starting nonce: ${plan.startingNonce}`);
  console.log(`SEPOLIA_VERIFIER: ${plan.verifier}`);
  console.log(`SEPOLIA_REGISTRY: ${plan.registry}`);
  console.log(`AegisShieldV2: ${plan.shield}`);
  console.log(`Output: ${TARGET}`);
  console.log("No transaction was created or broadcast.");
}
