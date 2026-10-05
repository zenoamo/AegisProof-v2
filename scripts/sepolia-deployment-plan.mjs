#!/usr/bin/env node
import { getContractAddress, getAddress, isAddress } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111;

export function planSepoliaDeployment({ deployer, startingNonce }) {
  if (!isAddress(deployer)) throw new Error("deployer must be a valid Ethereum address");
  if (!Number.isSafeInteger(startingNonce) || startingNonce < 0) {
    throw new Error("startingNonce must be a non-negative safe integer");
  }

  const normalizedDeployer = getAddress(deployer);
  const verifier = getContractAddress({ from: normalizedDeployer, nonce: BigInt(startingNonce) });
  const registry = getContractAddress({ from: normalizedDeployer, nonce: BigInt(startingNonce + 1) });
  const shield = getContractAddress({ from: normalizedDeployer, nonce: BigInt(startingNonce + 2) });

  return {
    chainId: SEPOLIA_CHAIN_ID,
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
