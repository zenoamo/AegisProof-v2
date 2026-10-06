// Sepolia canonical verifier preflight.
// Chain id 11155111 only. Mainnet, localhost, and test verifiers are not fallbacks.
// The binding is verifierForChain for that chain, not a file-level address constant.
// address(0) is not a deployment and is not FAIL. Missing bytecode stays FAIL.
// SEPOLIA_PRIVATE_KEY derives a signer address only. It is not a verifier address
// and not a production provenance signer.
// This module does not write files, broadcast transactions, or print credentials.
// A passing preflight is not production provenance VERIFIED and is not Groth16 regression PASS.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import { canonicalVerifierSelector } from "./mainnet-preflight.mjs";
import { defaultDeriveSigner, SEPOLIA_CHAIN_ID } from "./sepolia-connection.mjs";

export { SEPOLIA_CHAIN_ID };
export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_NOT_RUN = 3;

const REASON_RPC_MISSING = "SEPOLIA_RPC_URL is not configured";
const REASON_RPC_INVALID = "SEPOLIA_RPC_URL is invalid";
const REASON_RPC_FAILED = "Sepolia RPC connection failed";
const REASON_CODE_FAILED = "Sepolia bytecode query failed";
const REASON_CHAIN = "unexpected chainId";
const REASON_KEY_INVALID = "SEPOLIA_PRIVATE_KEY is invalid";
const REASON_NO_CODE = "canonical verifier address has no deployed bytecode";
const REASON_LOCALHOST = "localhost verifier is not a Sepolia deployment";
const REASON_MAINNET = "mainnet verifier is not a Sepolia deployment";
const REASON_IDENTITY = "deployed bytecode is not the canonical verifier";
const REASON_IDENTITY_METADATA = "canonical verifier identity metadata is unavailable";
const FAIL_IDENTITY = "FAIL canonical verifier identity mismatch";
const FAIL_MANIFEST = "FAIL deployment manifest mismatch";
const REASON_HASH = "canonical verifier bytecode does not match deployment manifest";
const REASON_MANIFEST_CHAIN = "deployment manifest chain id is not 11155111";
const REASON_MANIFEST_ADDRESS = "deployment manifest verifier address does not match CanonicalRegistry";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY_SOURCE = path.join(ROOT, "protocol/contracts/AegisCanonicalRegistry.sol");
const VERIFIER_SOURCE = path.join(ROOT, "protocol/contracts/Groth16VerifierV2Production.sol");
const MANIFEST_PATH = path.join(ROOT, "deployments/manifest.json");
const REJECTED_CONSTANTS = ["HARDHAT_VERIFIER", "HARDHAT_REGISTRY", "MAINNET_VERIFIER", "MAINNET_REGISTRY"];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function isZeroAddress(value) {
  return typeof value === "string" && /^0x0{40}$/i.test(value);
}

function extractFunctionBody(source, name) {
  const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  const brace = source.indexOf("{", start);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(brace + 1, i);
    }
  }
  return null;
}

function chainTokens(source, chainId) {
  const tokens = new Set([String(chainId)]);
  const re = new RegExp(`constant\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*${chainId}\\s*;`, "g");
  for (const match of source.matchAll(re)) tokens.add(match[1]);
  return [...tokens];
}

function constantAddress(source, name) {
  const match = source.match(new RegExp(`constant\\s+${name}\\s*=\\s*(0x[0-9a-fA-F]{40})\\s*;`));
  return match ? match[1] : null;
}

function addressFromExpression(source, expr) {
  const trimmed = expr.trim();
  if (/^address\s*\(\s*0\s*\)$/.test(trimmed)) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return trimmed;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return constantAddress(source, trimmed);
  return null;
}

function returnedForChain(source, fnBody, tokens) {
  if (!fnBody || tokens.length === 0) return null;
  const tokenAlt = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const braced = new RegExp(`if\\s*\\(\\s*chainId\\s*==\\s*(?:${tokenAlt})\\s*\\)\\s*\\{([\\s\\S]*?)\\}`, "g");
  for (const match of fnBody.matchAll(braced)) {
    const returned = match[1].match(/return\s+([^;]+);/);
    if (returned) return addressFromExpression(source, returned[1]);
  }
  const direct = new RegExp(`if\\s*\\(\\s*chainId\\s*==\\s*(?:${tokenAlt})\\s*\\)\\s*return\\s+([^;]+);`, "g");
  for (const match of fnBody.matchAll(direct)) {
    return addressFromExpression(source, match[1]);
  }
  return null;
}

function rejectedAddresses(source) {
  const found = [];
  for (const name of REJECTED_CONSTANTS) {
    const address = constantAddress(source, name);
    if (address && isAddress(address)) found.push({ name, address: getAddress(address) });
  }
  return found;
}

/**
 * Active Sepolia binding is the address verifierForChain returns for chain id 11155111.
 * A file-level constant that the function does not return is not a deployment.
 * @param {string | null | undefined} source
 */
export function readSepoliaVerifierBinding(source) {
  if (typeof source !== "string" || source.length === 0) {
    return { registry: "UNAVAILABLE", address: null, rejected: [] };
  }
  if (!source.includes("AegisCanonicalRegistry") || !source.includes("verifierForChain")) {
    return { registry: "UNAVAILABLE", address: null, rejected: [] };
  }
  const fnBody = extractFunctionBody(source, "verifierForChain");
  const address = returnedForChain(source, fnBody, chainTokens(source, SEPOLIA_CHAIN_ID));
  const rejected = rejectedAddresses(source);
  if (!address || isZeroAddress(address) || !isAddress(address)) {
    return { registry: "NOT CONFIGURED", address: null, rejected };
  }
  const checksum = getAddress(address);
  const hit = rejected.find((item) => item.address.toLowerCase() === checksum.toLowerCase());
  if (hit) {
    return {
      registry: "FAIL",
      address: checksum,
      rejected,
      local: hit.name.startsWith("HARDHAT"),
      mainnet: hit.name.startsWith("MAINNET"),
    };
  }
  return { registry: "CONFIGURED", address: checksum, rejected };
}

function bytecodePresent(code) {
  if (typeof code !== "string") return false;
  const hex = code.startsWith("0x") || code.startsWith("0X") ? code.slice(2) : code;
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length >= 2 && !/^0+$/.test(hex);
}

function bytecodeSha256(code) {
  const hex = code.startsWith("0x") || code.startsWith("0X") ? code.slice(2) : code;
  return createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex");
}

function bytecodeMatchesVerifier(code, selector) {
  if (!selector || !bytecodePresent(code)) return false;
  const body = selector.startsWith("0x") ? selector.slice(2) : selector;
  const hex = code.startsWith("0x") || code.startsWith("0X") ? code.slice(2) : code;
  return hex.toLowerCase().includes(body.toLowerCase());
}

function manifestVerifier(manifest) {
  const entry = manifest?.chains?.[String(SEPOLIA_CHAIN_ID)];
  if (!entry || typeof entry !== "object") return { address: null, hash: null, chainMismatch: false };
  const declared = entry.chainId;
  const chainMismatch = declared !== undefined && declared !== null && String(declared) !== String(SEPOLIA_CHAIN_ID);
  const address = typeof entry.canonicalVerifierAddress === "string" && isAddress(entry.canonicalVerifierAddress)
    && !isZeroAddress(entry.canonicalVerifierAddress)
    ? getAddress(entry.canonicalVerifierAddress)
    : null;
  const hash = typeof entry.verifierBytecodeSha256 === "string" && /^[0-9a-fA-F]{64}$/.test(entry.verifierBytecodeSha256)
    ? entry.verifierBytecodeSha256.toLowerCase()
    : null;
  return { address, hash, chainMismatch };
}

function loadText(file, override) {
  if (typeof override === "string" || override === null) return override;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function loadManifest(override) {
  if (override === null) return null;
  if (override && typeof override === "object") return override;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

export async function defaultSepoliaVerifierConnect({ rpcUrl }) {
  if (typeof rpcUrl !== "string" || !isHttpUrl(rpcUrl)) throw new Error(REASON_RPC_INVALID);
  const { createPublicClient, http } = await import("viem");
  const { sepolia } = await import("viem/chains");
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, { retryCount: 0, timeout: 20_000 }),
  });
  let chainId;
  try {
    chainId = await client.getChainId();
  } catch {
    throw new Error(REASON_RPC_FAILED);
  }
  return {
    chainId,
    async getCode(address) {
      try {
        return await client.getCode({ address });
      } catch {
        throw new Error(REASON_CODE_FAILED);
      }
    },
  };
}

async function classifySigner(env, deps) {
  const raw = typeof env?.SEPOLIA_PRIVATE_KEY === "string" ? env.SEPOLIA_PRIVATE_KEY.trim() : "";
  if (!raw) return { status: "NOT RUN" };
  try {
    const derived = await (deps.deriveSigner ?? defaultDeriveSigner)({ privateKey: raw });
    if (!isAddress(derived?.address)) return { status: "FAIL", reason: REASON_KEY_INVALID };
    return { status: "AVAILABLE", address: getAddress(derived.address) };
  } catch {
    return { status: "FAIL", reason: REASON_KEY_INVALID };
  }
}

function signerLines(signer) {
  const lines = [`Sepolia signer: ${signer.status}`];
  if (signer.status === "AVAILABLE" && signer.address) lines.push(`Signer address: ${signer.address}`);
  if (signer.reason) lines.push(`Reason: ${signer.reason}`);
  return lines;
}

function finish(exitCode, lines) {
  return { ok: exitCode === EXIT_PASS, exitCode, lines };
}

function registryLines(binding) {
  if (binding.registry === "UNAVAILABLE") {
    return [
      "Sepolia CanonicalRegistry: NOT RUN",
      "Sepolia Canonical verifier: NOT RUN",
      "Sepolia Canonical verifier bytecode: NOT RUN",
    ];
  }
  if (binding.registry === "CONFIGURED") {
    return [
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${binding.address}`,
    ];
  }
  if (binding.registry === "FAIL") {
    return [
      "Sepolia CanonicalRegistry: FAIL",
      "Sepolia Canonical verifier: FAIL",
      "Sepolia Canonical verifier bytecode: NOT RUN",
    ];
  }
  return [
    "Sepolia CanonicalRegistry: NOT CONFIGURED",
    "Sepolia Canonical verifier: NOT CONFIGURED",
    "Sepolia Canonical verifier bytecode: NOT RUN",
  ];
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ connect?: Function, deriveSigner?: Function, registrySource?: string | null, verifierSource?: string | null, manifest?: object | null }} [deps]
 */
export async function runSepoliaPreflight(env = process.env, deps = {}) {
  const rpcRaw = typeof env?.SEPOLIA_RPC_URL === "string" ? env.SEPOLIA_RPC_URL.trim() : "";
  const binding = readSepoliaVerifierBinding(loadText(REGISTRY_SOURCE, deps.registrySource));
  const manifest = manifestVerifier(loadManifest(deps.manifest));
  const signer = await classifySigner(env, deps);

  const notRun = (reason) => finish(signer.status === "FAIL" ? EXIT_FAIL : EXIT_NOT_RUN, [
    "Sepolia RPC: NOT RUN",
    "Sepolia chainId: NOT RUN",
    ...registryLines(binding.registry === "CONFIGURED" || binding.registry === "FAIL"
      ? { registry: "NOT CONFIGURED", address: null }
      : binding),
    ...signerLines(signer),
    `Reason: ${reason}`,
  ]);

  if (!rpcRaw) return notRun(REASON_RPC_MISSING);
  if (!isHttpUrl(rpcRaw)) return notRun(REASON_RPC_INVALID);

  let snapshot;
  try {
    snapshot = await (deps.connect ?? defaultSepoliaVerifierConnect)({ rpcUrl: rpcRaw });
  } catch (err) {
    const reason = err instanceof Error && (err.message === REASON_RPC_INVALID || err.message === REASON_RPC_FAILED)
      ? err.message
      : REASON_RPC_FAILED;
    return notRun(reason);
  }

  const chainId = toSafeChainId(snapshot?.chainId);
  if (chainId === null) return notRun(REASON_RPC_FAILED);
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: FAIL",
      "Sepolia chainId: FAIL",
      ...registryLines(binding.registry === "CONFIGURED" ? { registry: "NOT CONFIGURED", address: null } : binding),
      ...signerLines(signer),
      `FAIL ${REASON_CHAIN}`,
    ]);
  }

  if (binding.registry === "UNAVAILABLE") {
    return finish(signer.status === "FAIL" ? EXIT_FAIL : EXIT_NOT_RUN, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      ...registryLines(binding),
      ...signerLines(signer),
    ]);
  }

  if (binding.registry === "FAIL") {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      ...registryLines(binding),
      ...signerLines(signer),
      `Reason: ${binding.mainnet ? REASON_MAINNET : REASON_LOCALHOST}`,
    ]);
  }

  if (binding.registry !== "CONFIGURED" || !binding.address) {
    return finish(signer.status === "FAIL" ? EXIT_FAIL : EXIT_NOT_RUN, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      ...registryLines(binding),
      ...signerLines(signer),
    ]);
  }

  if (signer.status === "FAIL") {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${binding.address}`,
      "Sepolia Canonical verifier bytecode: NOT RUN",
      ...signerLines(signer),
    ]);
  }

  const address = binding.address;
  let code;
  try {
    code = await snapshot.getCode(address);
  } catch (err) {
    const reason = err instanceof Error && err.message === REASON_CODE_FAILED ? err.message : REASON_CODE_FAILED;
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier bytecode: FAIL",
      ...signerLines(signer),
      `Reason: ${reason}`,
    ]);
  }

  if (!bytecodePresent(code)) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier bytecode: NOT DEPLOYED",
      ...signerLines(signer),
      `FAIL ${REASON_NO_CODE}`,
    ]);
  }

  const selector = canonicalVerifierSelector(loadText(VERIFIER_SOURCE, deps.verifierSource));
  if (!selector || !bytecodeMatchesVerifier(code, selector)) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier bytecode: PRESENT",
      ...signerLines(signer),
      FAIL_IDENTITY,
      `Reason: ${selector ? REASON_IDENTITY : REASON_IDENTITY_METADATA}`,
    ]);
  }

  if (manifest.chainMismatch) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier identity: VERIFIED",
      ...signerLines(signer),
      FAIL_MANIFEST,
      `Reason: ${REASON_MANIFEST_CHAIN}`,
    ]);
  }
  if (manifest.address && manifest.address.toLowerCase() !== address.toLowerCase()) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier identity: VERIFIED",
      ...signerLines(signer),
      FAIL_MANIFEST,
      `Reason: ${REASON_MANIFEST_ADDRESS}`,
    ]);
  }
  if (manifest.hash && bytecodeSha256(code) !== manifest.hash) {
    return finish(EXIT_FAIL, [
      "Sepolia RPC: CONNECTED",
      "Sepolia chainId: 11155111",
      "Sepolia CanonicalRegistry: CONFIGURED",
      `Sepolia Canonical verifier: ${address}`,
      "Sepolia Canonical verifier identity: VERIFIED",
      ...signerLines(signer),
      FAIL_MANIFEST,
      `Reason: ${REASON_HASH}`,
    ]);
  }

  const lines = [
    "Sepolia RPC: CONNECTED",
    "Sepolia chainId: 11155111",
    "Sepolia CanonicalRegistry: CONFIGURED",
    `Sepolia Canonical verifier: ${address}`,
    "Sepolia Canonical verifier bytecode: DEPLOYED",
    "Sepolia Canonical verifier identity: VERIFIED",
  ];
  if (manifest.address || manifest.hash) lines.push("deployment manifest: MATCHED");
  lines.push(
    ...signerLines(signer),
    "Sepolia Canonical Verifier: READY",
    "Sepolia preflight: PASS",
    "No transaction was created or broadcast.",
  );
  return finish(EXIT_PASS, lines);
}
