// Minimal Hardhat config for prover on-chain compatibility tests.
// Keeps the main hardhat.config.ts unchanged (Architecture Freeze).
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default {
  plugins: [hardhatToolboxViem],
  paths: {
    artifacts: "artifacts/hardhat",
    sources: "scripts/prover-contracts",
  },
  solidity: {
    version: "0.8.28",
  },
  networks: {
    default: {
      initialDate: new Date(1754300000 * 1000),
    },
  },
};
