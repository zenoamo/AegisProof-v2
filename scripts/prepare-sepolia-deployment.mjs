import "dotenv/config";
import { createPublicClient, getAddress, getContractAddress, http, isAddress, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const CANONICAL = path.join(ROOT, "protocol", "contracts", "AegisCanonicalRegistry.sol");

function requireAddress(value, name) {
  if (!value || !isAddress(value) || getAddress(value) === zeroAddress) {
    throw new Error(`${name} is missing or invalid`);
  }
  return getAddress(value);
}

const rpcUrl = process.env.SEPOLIA_RPC_URL;
if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL is required");

const deployer = requireAddress(process.env.SEPOLIA_EXPECTED_DEPLOYER, "SEPOLIA_EXPECTED_DEPLOYER");
const configuredVerifier = process.env.SEPOLIA_VERIFIER_ADDRESS
  ? requireAddress(process.env.SEPOLIA_VERIFIER_ADDRESS, "SEPOLIA_VERIFIER_ADDRESS")
  : null;
const configuredRegistry = process.env.SEPOLIA_REGISTRY_ADDRESS
  ? requireAddress(process.env.SEPOLIA_REGISTRY_ADDRESS, "SEPOLIA_REGISTRY_ADDRESS")
  : null;

const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const chainId = await client.getChainId();
if (chainId !== 11155111) throw new Error(`Expected Sepolia chain 11155111, got ${chainId}`);

const [latestNonce, pendingNonce] = await Promise.all([
  client.getTransactionCount({ address: deployer, blockTag: "latest" }),
  client.getTransactionCount({ address: deployer, blockTag: "pending" }),
]);
if (latestNonce !== pendingNonce) {
  throw new Error(`Pending transaction detected: latest=${latestNonce}, pending=${pendingNonce}`);
}

const verifier = configuredVerifier ??
  getContractAddress({ from: deployer, nonce: BigInt(latestNonce) });
const registryNonce = configuredVerifier ? latestNonce : latestNonce + 1;
const registry = configuredRegistry ??
  getContractAddress({ from: deployer, nonce: BigInt(registryNonce) });

if (configuredVerifier) {
  const code = await client.getBytecode({ address: configuredVerifier });
  if (!code || code === "0x") {
    throw new Error(`SEPOLIA_VERIFIER_ADDRESS has no bytecode: ${configuredVerifier}`);
  }
}
if (configuredRegistry) {
  const code = await client.getBytecode({ address: configuredRegistry });
  if (!code || code === "0x") {
    throw new Error(`SEPOLIA_REGISTRY_ADDRESS has no bytecode: ${configuredRegistry}`);
  }
}

let source = fs.readFileSync(CANONICAL, "utf8");
source = source
  .replace(
    /uint256 internal constant MAINNET_CHAIN_ID = 1;\n/,
    "uint256 internal constant MAINNET_CHAIN_ID = 1;\n    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;\n",
  )
  .replace(
    /address internal constant MAINNET_REGISTRY =\n        (0x[0-9a-fA-F]{40});/,
    `address internal constant MAINNET_REGISTRY =\n        $1;\n\n    address internal constant SEPOLIA_VERIFIER =\n        ${verifier};\n\n    address internal constant SEPOLIA_REGISTRY =\n        ${registry};`,
  )
  .replace(
    /if \(chainId === HARDHAT_CHAIN_ID\) \{\n            return HARDHAT_VERIFIER;\n        \}/,
    "if (chainId === HARDHAT_CHAIN_ID) {\n            return HARDHAT_VERIFIER;\n        }\n        if (chainId === SEPOLIA_CHAIN_ID) {\n            return SEPOLIA_VERIFIER;\n        }",
  )
  .replace(
    /if \(chainId === HARDHAT_CHAIN_ID\) \{\n            return HARDHAT_REGISTRY;\n        \}/,
    "if (chainId === HARDHAT_CHAIN_ID) {\n            return HARDHAT_REGISTRY;\n        }\n        if (chainId === SEPOLIA_CHAIN_ID) {\n            return SEPOLIA_REGISTRY;\n        }",
  );

if (!source.includes("SEPOLIA_VERIFIER")) throw new Error("Failed to update SEPOLIA_VERIFIER in canonical registry");
if (!source.includes("SEPOLIA_REGISTRY")) throw new Error("Failed to update SEPOLIA_REGISTRY in canonical registry");

fs.writeFileSync(CANONICAL, source);
console.log(`Sepolia canonical registry prepared: verifier=${verifier} registry=${registry} nonce=${registryNonce}`);
