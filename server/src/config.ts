import dotenv from "dotenv";
import path from "node:path";

// Load .env from the project root, whether the server is
// started from the repository root or from server/.
dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

export const config = {
  rpcUrl:
    process.env.RPC_URL ??
    process.env.LOCALHOST_RPC_URL,
  privateKey:
    process.env.OPERATOR_PRIVATE_KEY ??
    process.env.LOCALHOST_PRIVATE_KEY,
  shieldAddress: process.env.SHIELD_ADDRESS,
  verifierAddress: process.env.VERIFIER_ADDRESS,
} as const;

if (!config.rpcUrl) {
  throw new Error("RPC_URL is not set");
}

if (!config.privateKey) {
  throw new Error("OPERATOR_PRIVATE_KEY is not set");
}

if (!config.shieldAddress) {
  throw new Error("SHIELD_ADDRESS is not set");
}

if (!config.verifierAddress) {
  throw new Error("VERIFIER_ADDRESS is not set");
}

