import "dotenv/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
const mainnetRpcUrl = process.env.MAINNET_RPC_URL;
const mainnetPrivateKey = process.env.MAINNET_PRIVATE_KEY;

const networks: Record<string, unknown> = {
  // In-process simulated network: pin the genesis clock to the frozen
  // Phase 2 baseline proof's timestamp window (signal 24 = 1754300000).
  // EVM time cannot rewind, so the chain must start inside the proof's
  // validity window.
  default: {
    initialDate: new Date(1754300000 * 1000),
  },

  // Explicit local JSON-RPC node.
  localhost: {
    type: "http",
    url: "http://127.0.0.1:8545",
  },
};

if (rpcUrl) {
  networks.sepolia = {
    type: "http",
    url: rpcUrl,
    accounts: privateKey ? [privateKey] : [],
  };
}

if (mainnetRpcUrl) {
  networks.mainnet = {
    type: "http",
    url: mainnetRpcUrl,
    accounts: mainnetPrivateKey ? [mainnetPrivateKey] : [],
  };
}

export default {
  plugins: [hardhatToolboxViem],

  // Keep Hardhat build artifacts isolated from the frozen Phase 2 evidence
  // tree under artifacts/phase2.
  paths: {
    artifacts: "artifacts/hardhat",
    sources: "protocol/contracts",
  },

  solidity: {
    version: "0.8.28",
  },

  networks,
};