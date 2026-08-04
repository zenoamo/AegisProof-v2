import "dotenv/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

export default {
  plugins: [hardhatToolboxViem],

  // Hardhat 3's build system deletes unknown *.json directories under
  // paths.artifacts on every run/compile (cleanupArtifacts). The Phase 2
  // evidence tree (artifacts/phase2: cache/vkey/tests/reports/proofs) is
  // JSON-based and was being wiped by this. Isolating hardhat's own build
  // output in artifacts/hardhat keeps the frozen evidence tree untouched.
  paths: {
    artifacts: "artifacts/hardhat",
  },

  solidity: {
    version: "0.8.28",
  },

  networks: {
    // In-process simulated network: pin the genesis clock to the frozen Phase 2
    // baseline proof's timestamp window (signal 24 = 1754300000). EVM time
    // cannot rewind, so the chain must start inside the proof's validity window.
    default: {
      initialDate: new Date(1754300000 * 1000),
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      url: rpcUrl ?? "http://127.0.0.1:8545",
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

