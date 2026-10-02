#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, getAddress, isAddress } from "viem";
import { mainnet } from "viem/chains";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(ROOT, "deployments", "manifest.json");

const rpcUrl = process.env.MAINNET_RPC_URL;
const verifierAddress = process.env.AEGIS_MAINNET_CANONICAL_VERIFIER;
const registryAddress = process.env.AEGIS_MAINNET_CANONICAL_REGISTRY;
const expectedDeployer = process.env.AEGIS_MAINNET_EXPECTED_DEPLOYER;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!rpcUrl) fail("MAINNET_RPC_URL is required");
for (const [name, value] of [
  ["AEGIS_MAINNET_CANONICAL_VERIFIER", verifierAddress],
  ["AEGIS_MAINNET_CANONICAL_REGISTRY", registryAddress],
  ["AEGIS_MAINNET_EXPECTED_DEPLOYER", expectedDeployer],
]) {
  if (!value || !isAddress(value)) fail(`${name} must be a valid Ethereum address`);
}

const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

const chainId = await client.getChainId();
if (chainId !== 1) fail(`RPC chain ID is ${chainId}, expected Ethereum Mainnet (1)`);

const [verifierCode, registryCode, deployerBalance] = await Promise.all([
  client.getCode({ address: getAddress(verifierAddress) }),
  client.getCode({ address: getAddress(registryAddress) }),
  client.getBalance({ address: getAddress(expectedDeployer) }),
]);

if (!verifierCode || verifierCode === "0x") fail("canonical verifier address has no deployed bytecode");
if (!registryCode || registryCode === "0x") fail("canonical registry address has no deployed bytecode");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entry = manifest?.chains?.["1"];
if (entry?.deployable === true || manifest?.deploymentStatus === "production") {
  fail("committed manifest must remain fail-closed until on-chain deployment evidence is recorded");
}

console.log("Ethereum Mainnet preflight: PASS");
console.log("Chain ID: 1");
console.log(`Verifier bytecode: ${verifierCode.length > 2 ? "present" : "missing"}`);
console.log(`Registry bytecode: ${registryCode.length > 2 ? "present" : "missing"}`);
console.log(`Expected deployer balance (wei): ${deployerBalance.toString()}`);
console.log("No transaction was created or broadcast.");
