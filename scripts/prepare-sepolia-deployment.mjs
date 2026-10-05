#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, getAddress, isAddress } from "viem";
import { sepolia } from "viem/chains";
import { generateSepoliaCanonicalRegistry } from "./gen-sepolia-canonical-registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const deployer = process.env.SEPOLIA_EXPECTED_DEPLOYER;

if (!RPC_URL) throw new Error("SEPOLIA_RPC_URL is required");
if (!deployer || !isAddress(deployer)) throw new Error("SEPOLIA_EXPECTED_DEPLOYER must be a valid Ethereum address");

const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const chainId = await client.getChainId();
if (chainId !== 11155111) throw new Error(`RPC chain ID is ${chainId}, expected Sepolia (11155111)`);

const address = getAddress(deployer);
const [latestNonce, pendingNonce] = await Promise.all([
  client.getTransactionCount({ address, blockTag: "latest" }),
  client.getTransactionCount({ address, blockTag: "pending" }),
]);

if (pendingNonce !== latestNonce) {
  throw new Error(`Pending nonce ${pendingNonce} differs from latest nonce ${latestNonce}; clear pending transactions before reserving the deployment range.`);
}

const { plan, source } = generateSepoliaCanonicalRegistry({
  deployer: address,
  startingNonce: latestNonce,
});

fs.writeFileSync(path.join(ROOT, "protocol", "contracts", "AegisCanonicalRegistry.sol"), source);

console.log("Sepolia deployment preflight: PASS");
console.log(`Deployer: ${plan.deployer}`);
console.log("Chain ID: 11155111");
console.log(`Starting nonce: ${plan.startingNonce}`);
console.log(`Verifier: ${plan.verifier}`);
console.log(`Registry: ${plan.registry}`);
console.log(`Shield: ${plan.shield}`);
console.log("Nonce policy: verifier, registry, and shield must consume contiguous nonces.");
console.log("No transaction was created or broadcast.");
