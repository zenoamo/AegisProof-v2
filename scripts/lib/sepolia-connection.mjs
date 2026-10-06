// Sepolia EVM connectivity check.
// RPC URL comes only from SEPOLIA_RPC_URL.
// The EVM account comes only from SEPOLIA_PRIVATE_KEY.
// This module does not write files and does not print the key, its length, or the RPC URL.
// The Sepolia account is an EVM connectivity credential only.
// It is not a production provenance signer and not an ML-DSA key.
// A successful check does not verify production provenance and does not pass Groth16 regression.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_NETWORK = "sepolia";
export const SEPOLIA_CREDENTIAL_ROLE = "evm-connectivity";

const REASON_URL_MISSING = "SEPOLIA_RPC_URL is not configured";
const REASON_URL_INVALID = "SEPOLIA_RPC_URL is invalid";
const REASON_KEY_MISSING = "SEPOLIA_PRIVATE_KEY is not configured";
const REASON_KEY_INVALID = "SEPOLIA_PRIVATE_KEY is invalid";
const REASON_RPC_FAILED = "Sepolia RPC connection failed";
const REASON_CHAIN_MISMATCH = "unexpected chainId";

const REGISTRY_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../protocol/contracts/AegisCanonicalRegistry.sol",
);

const RPC_REASONS = new Set([REASON_URL_INVALID, REASON_RPC_FAILED, REASON_CHAIN_MISMATCH]);

function normalizePrivateKey(raw) {
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return `0x${hex.toLowerCase()}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readRpc(env) {
  const rpcUrl = typeof env?.SEPOLIA_RPC_URL === "string" ? env.SEPOLIA_RPC_URL.trim() : "";
  if (!rpcUrl) return { state: "missing" };
  if (!isHttpUrl(rpcUrl)) return { state: "invalid" };
  return { state: "present", rpcUrl };
}

function readKey(env) {
  const privateKeyRaw = typeof env?.SEPOLIA_PRIVATE_KEY === "string" ? env.SEPOLIA_PRIVATE_KEY.trim() : "";
  if (!privateKeyRaw) return { state: "missing" };
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey) return { state: "invalid" };
  return { state: "present", privateKey };
}

function toSafeChainId(value) {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(parsed);
  } catch {
    return null;
  }
}

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function rpcReason(err) {
  const msg = err instanceof Error ? err.message : "";
  if (RPC_REASONS.has(msg)) return msg;
  return REASON_RPC_FAILED;
}

function signerReason() {
  return REASON_KEY_INVALID;
}

function resolveChainToken(source, chainId) {
  if (!source.includes(String(chainId))) return null;
  if (new RegExp(`chainId\\s*==\\s*${chainId}\\b`).test(source)) return String(chainId);
  const constant = source.match(new RegExp(`constant\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*${chainId}\\s*;`));
  if (constant && new RegExp(`chainId\\s*==\\s*${constant[1]}\\b`).test(source)) return constant[1];
  return null;
}

/**
 * Sepolia is configured only when registryForChain returns a non-zero address
 * for chain id 11155111. address(0) and a missing binding are not deployments.
 * @param {string | null | undefined} source
 * @returns {"CONFIGURED" | "NOT CONFIGURED" | "NOT RUN"}
 */
export function classifySepoliaCanonicalRegistry(source) {
  if (typeof source !== "string" || source.length === 0) return "NOT RUN";
  const token = resolveChainToken(source, SEPOLIA_CHAIN_ID);
  if (!token) return "NOT CONFIGURED";
  const patterns = [
    new RegExp(
      `if\\s*\\(\\s*chainId\\s*==\\s*${token}\\s*\\)\\s*\\{[\\s\\S]*?return\\s+(0x[0-9a-fA-F]{40})\\s*;`,
    ),
    new RegExp(`if\\s*\\(\\s*chainId\\s*==\\s*${token}\\s*\\)\\s*return\\s+(0x[0-9a-fA-F]{40})\\s*;`),
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    if (/^0x0+$/i.test(match[1])) return "NOT CONFIGURED";
    return "CONFIGURED";
  }
  return "NOT CONFIGURED";
}

function loadRegistrySource(override) {
  if (typeof override === "string" || override === null) return override;
  try {
    return fs.readFileSync(REGISTRY_SOURCE, "utf8");
  } catch {
    return null;
  }
}

export async function defaultSepoliaConnect({ rpcUrl }) {
  if (typeof rpcUrl !== "string" || !isHttpUrl(rpcUrl)) throw new Error(REASON_URL_INVALID);
  const { createPublicClient, http } = await import("viem");
  const client = createPublicClient({
    transport: http(rpcUrl, { retryCount: 0, timeout: 15_000 }),
  });
  let chainId;
  try {
    chainId = await client.getChainId();
  } catch {
    throw new Error(REASON_RPC_FAILED);
  }
  const parsed = toSafeChainId(chainId);
  if (parsed === null) throw new Error(REASON_RPC_FAILED);
  return { chainId: parsed };
}

export async function defaultDeriveSigner({ privateKey }) {
  const normalized = typeof privateKey === "string" ? normalizePrivateKey(privateKey) : null;
  if (!normalized) throw new Error(REASON_KEY_INVALID);
  const { privateKeyToAccount } = await import("viem/accounts");
  let account;
  try {
    account = privateKeyToAccount(normalized);
  } catch {
    throw new Error(REASON_KEY_INVALID);
  }
  if (!isAddress(account?.address)) throw new Error(REASON_KEY_INVALID);
  return { address: account.address };
}

function decideExit(rpcStatus, chainStatus, signerStatus) {
  if (rpcStatus === "FAIL" || chainStatus === "FAIL" || signerStatus === "FAIL") return 1;
  if (rpcStatus === "CONNECTED" && chainStatus === String(SEPOLIA_CHAIN_ID) && signerStatus === "AVAILABLE") {
    return 0;
  }
  return 3;
}

/**
 * Check Sepolia RPC and the Sepolia signer independently.
 * Exit 0 when both succeed. Exit 1 when a present credential fails.
 * Exit 3 when a required credential is absent and nothing present failed.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ connect?: Function, deriveSigner?: Function, registrySource?: string | null }} [deps]
 */
export async function verifySepoliaConnection(env = process.env, deps = {}) {
  const rpcCred = readRpc(env);
  const keyCred = readKey(env);
  const registry = classifySepoliaCanonicalRegistry(loadRegistrySource(deps.registrySource));

  let rpcStatus = "NOT RUN";
  let chainStatus = "NOT RUN";
  let signerStatus = "NOT RUN";
  let address = null;
  const reasons = [];

  if (rpcCred.state === "missing") {
    reasons.push(REASON_URL_MISSING);
  } else if (rpcCred.state === "invalid") {
    rpcStatus = "FAIL";
    chainStatus = "FAIL";
    reasons.push(REASON_URL_INVALID);
  } else {
    try {
      const snapshot = await (deps.connect ?? defaultSepoliaConnect)({ rpcUrl: rpcCred.rpcUrl });
      const chainId = toSafeChainId(snapshot?.chainId);
      if (chainId === SEPOLIA_CHAIN_ID) {
        rpcStatus = "CONNECTED";
        chainStatus = String(SEPOLIA_CHAIN_ID);
      } else {
        rpcStatus = "FAIL";
        chainStatus = "FAIL";
        reasons.push(REASON_CHAIN_MISMATCH);
      }
    } catch (err) {
      rpcStatus = "FAIL";
      chainStatus = "FAIL";
      reasons.push(rpcReason(err));
    }
  }

  if (keyCred.state === "missing") {
    reasons.push(REASON_KEY_MISSING);
  } else if (keyCred.state === "invalid") {
    signerStatus = "FAIL";
    reasons.push(REASON_KEY_INVALID);
  } else {
    try {
      const derived = await (deps.deriveSigner ?? defaultDeriveSigner)({ privateKey: keyCred.privateKey });
      if (!isAddress(derived?.address)) {
        signerStatus = "FAIL";
        reasons.push(signerReason());
      } else {
        signerStatus = "AVAILABLE";
        address = derived.address;
      }
    } catch {
      signerStatus = "FAIL";
      reasons.push(signerReason());
    }
  }

  const exitCode = decideExit(rpcStatus, chainStatus, signerStatus);
  const lines = [
    `Sepolia RPC: ${rpcStatus}`,
    `Sepolia chainId: ${chainStatus}`,
    `Sepolia signer: ${signerStatus}`,
  ];
  if (signerStatus === "AVAILABLE" && address) lines.push(`Signer address: ${address}`);
  for (const reason of reasons) lines.push(`Reason: ${reason}`);
  lines.push(`Sepolia CanonicalRegistry: ${registry}`);

  return {
    ok: exitCode === 0,
    exitCode,
    lines,
    rpc: rpcStatus,
    chainId: chainStatus,
    signer: signerStatus,
    address,
    registry,
    network: SEPOLIA_NETWORK,
    role: SEPOLIA_CREDENTIAL_ROLE,
  };
}
