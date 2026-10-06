// Sepolia deployment connection check.
// Credentials come only from SEPOLIA_PRIVATE_KEY and SEPOLIA_RPC_URL.
// This module does not write files and does not print the key or the RPC URL.
export const SEPOLIA_CHAIN_ID = 11155111;

const REASON_URL_MISSING = "SEPOLIA_RPC_URL is not configured";
const REASON_URL_INVALID = "SEPOLIA_RPC_URL is invalid";
const REASON_KEY_MISSING = "SEPOLIA_PRIVATE_KEY is not configured";
const REASON_KEY_INVALID = "SEPOLIA_PRIVATE_KEY is invalid";
const REASON_RPC_FAILED = "Sepolia RPC connection failed";
const REASON_CHAIN_MISMATCH = "RPC chainId mismatch";

const FIXED_REASONS = new Set([
  REASON_URL_MISSING,
  REASON_URL_INVALID,
  REASON_KEY_MISSING,
  REASON_KEY_INVALID,
  REASON_RPC_FAILED,
  REASON_CHAIN_MISMATCH,
]);

function fail(reason, extra = []) {
  return {
    ok: false,
    exitCode: 1,
    lines: ["Sepolia connection: FAIL", `Reason: ${reason}`, ...extra],
  };
}

function normalizePrivateKey(raw) {
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return `0x${hex}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Read Sepolia credentials from an environment object.
 * The returned private key stays in memory for the caller. Reasons never include it.
 */
export function readSepoliaCredentials(env = process.env) {
  const rpcUrl = typeof env?.SEPOLIA_RPC_URL === "string" ? env.SEPOLIA_RPC_URL.trim() : "";
  const privateKeyRaw = typeof env?.SEPOLIA_PRIVATE_KEY === "string" ? env.SEPOLIA_PRIVATE_KEY.trim() : "";
  if (!rpcUrl) return { ok: false, reason: REASON_URL_MISSING };
  if (!isHttpUrl(rpcUrl)) return { ok: false, reason: REASON_URL_INVALID };
  if (!privateKeyRaw) return { ok: false, reason: REASON_KEY_MISSING };
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey) return { ok: false, reason: REASON_KEY_INVALID };
  return { ok: true, rpcUrl, privateKey };
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

function isEthAmount(value) {
  return typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function publicReason(err) {
  const msg = err instanceof Error ? err.message : "";
  if (FIXED_REASONS.has(msg)) return msg;
  return REASON_RPC_FAILED;
}

export async function defaultSepoliaConnect({ rpcUrl, privateKey }) {
  const { createPublicClient, formatEther, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  let account;
  try {
    account = privateKeyToAccount(privateKey);
  } catch {
    throw new Error(REASON_KEY_INVALID);
  }
  if (!isAddress(account?.address)) throw new Error(REASON_KEY_INVALID);

  const client = createPublicClient({
    transport: http(rpcUrl, { retryCount: 0, timeout: 20_000 }),
  });

  let chainId;
  try {
    chainId = toSafeChainId(await client.getChainId());
  } catch {
    throw new Error(REASON_RPC_FAILED);
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return { chainId, address: account.address, balanceEth: null };
  }

  let balance;
  try {
    balance = await client.getBalance({ address: account.address });
  } catch {
    throw new Error(REASON_RPC_FAILED);
  }
  const balanceEth = formatEther(balance);
  if (!isEthAmount(balanceEth)) throw new Error(REASON_RPC_FAILED);
  return { chainId, address: account.address, balanceEth };
}

export async function verifySepoliaConnection(env = process.env, deps = {}) {
  const creds = readSepoliaCredentials(env);
  if (!creds.ok) return fail(creds.reason);

  const connect = deps.connect ?? defaultSepoliaConnect;
  let snapshot;
  try {
    snapshot = await connect({ rpcUrl: creds.rpcUrl, privateKey: creds.privateKey });
  } catch (err) {
    return fail(publicReason(err));
  }

  const chainId = toSafeChainId(snapshot?.chainId);
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return fail(REASON_CHAIN_MISMATCH, [
      `Expected: ${SEPOLIA_CHAIN_ID}`,
      `Actual: ${chainId === null ? "unavailable" : chainId}`,
    ]);
  }
  if (!isAddress(snapshot?.address) || !isEthAmount(snapshot?.balanceEth)) {
    return fail(REASON_RPC_FAILED);
  }

  return {
    ok: true,
    exitCode: 0,
    lines: [
      "Sepolia connection: PASS",
      `chainId: ${SEPOLIA_CHAIN_ID}`,
      "network: Sepolia",
      `signer: ${snapshot.address}`,
      `balance: ${snapshot.balanceEth} ETH`,
    ],
  };
}
