#!/usr/bin/env node
import { createPublicClient, http, getAddress, isAddress } from "viem";
import { mainnet } from "viem/chains";

const deployer = process.env.AEGIS_MAINNET_EXPECTED_DEPLOYER;
const rpcUrl = process.env.MAINNET_RPC_URL;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!rpcUrl) fail("MAINNET_RPC_URL is required");
if (!deployer || !isAddress(deployer)) {
  fail("AEGIS_MAINNET_EXPECTED_DEPLOYER must be a valid Ethereum address");
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl),
});

const chainId = await client.getChainId();
if (chainId !== 1) fail(`RPC chain ID is ${chainId}, expected Ethereum Mainnet (1)`);

const address = getAddress(deployer);
const [latestNonce, pendingNonce] = await Promise.all([
  client.getTransactionCount({ address, blockTag: "latest" }),
  client.getTransactionCount({ address, blockTag: "pending" }),
]);

console.log("Ethereum Mainnet deployer nonce probe: PASS");
console.log(`Deployer: ${address}`);
console.log("Chain ID: 1");
console.log(`Latest nonce: ${latestNonce}`);
console.log(`Pending nonce: ${pendingNonce}`);

if (pendingNonce !== latestNonce) {
  console.error("FAIL pending nonce differs from latest nonce; do not reserve the deployment nonce range yet.");
  process.exit(1);
}

console.log(`Safe starting nonce candidate: ${latestNonce}`);
console.log("No transaction was created or broadcast.");
