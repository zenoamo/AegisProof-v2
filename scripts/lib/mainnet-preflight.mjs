// Ethereum Mainnet canonical verifier preflight.
// Chain id 1 only. Sepolia, localhost, and test keys are not fallbacks.
// The active CanonicalRegistry binding is verifierForChain, not a counterfactual constant.
// address(0) is not a deployment and is not FAIL. Missing bytecode stays FAIL.
// This module does not write files, broadcast transactions, or print RPC credentials.
// A passing preflight is not production provenance VERIFIED and is not Groth16 regression PASS.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress, toFunctionSelector } from "viem";

export const MAINNET_CHAIN_ID = 1;
export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_NOT_RUN = 3;

const REASON_RPC_MISSING = "MAINNET_RPC_URL is not configured";
const REASON_RPC_INVALID = "MAINNET_RPC_URL is invalid";
const REASON_RPC_FAILED = "Mainnet RPC connection failed";
const REASON_CODE_FAILED = "Mainnet bytecode query failed";
const REASON_CHAIN = "unexpected chainId";
const REASON_VERIFIER_INVALID = "AEGIS_MAINNET_CANONICAL_VERIFIER is invalid";
const REASON_REGISTRY_INVALID = "AEGIS_MAINNET_CANONICAL_REGISTRY is invalid";
const REASON_MISMATCH = "canonical verifier address does not match CanonicalRegistry";
const REASON_NO_CODE = "canonical verifier address has no deployed bytecode";
const REASON_LOCALHOST = "localhost verifier is not a Mainnet deployment";
const REASON_UNBOUND = "CanonicalRegistry mainnet binding is not active";
const REASON_IDENTITY = "deployed bytecode is not the canonical verifier";
const REASON_IDENTITY_METADATA = "canonical verifier identity metadata is unavailable";
const FAIL_IDENTITY = "FAIL canonical verifier identity mismatch";
const FAIL_MANIFEST = "FAIL deployment manifest mismatch";
const VERIFY_PROOF_SELECTOR = "function verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[30])";
const REASON_HASH = "canonical verifier bytecode does not match deployment manifest";
const REASON_MANIFEST_ADDRESS = "deployment manifest verifier address does not match CanonicalRegistry";
const REASON_SOURCE = "CanonicalRegistry source is unavailable";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY_SOURCE = path.join(ROOT, "protocol/contracts/AegisCanonicalRegistry.sol");
const VERIFIER_SOURCE = path.join(ROOT, "protocol/contracts/Groth16VerifierV2Production.sol");
const MANIFEST_PATH = path.join(ROOT, "deployments/manifest.json");

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

function readAddress(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return { state: "missing" };
  const value = raw.trim();
  if (isZeroAddress(value)) return { state: "zero" };
  if (!isAddress(value)) return { state: "invalid" };
  return { state: "present", address: getAddress(value) };
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

function localAddresses(source) {
  const found = [];
  for (const name of ["HARDHAT_VERIFIER", "HARDHAT_REGISTRY"]) {
    const address = constantAddress(source, name);
    if (address && isAddress(address)) found.push(getAddress(address));
  }
  return found;
}

/**
 * Active mainnet binding is the address verifierForChain returns for chain id 1.
 * A file-level constant that the function does not return is not a deployment.
 * @param {string | null | undefined} source
 */
export function readMainnetVerifierBinding(source) {
  if (typeof source !== "string" || source.length === 0) {
    return { registry: "FAIL", address: null, localAddresses: [] };
  }
  if (!source.includes("AegisCanonicalRegistry") || !source.includes("verifierForChain")) {
    return { registry: "FAIL", address: null, localAddresses: [] };
  }
  const fnBody = extractFunctionBody(source, "verifierForChain");
  const address = returnedForChain(source, fnBody, chainTokens(source, MAINNET_CHAIN_ID));
  const locals = localAddresses(source);
  if (!address || isZeroAddress(address) || !isAddress(address)) {
    return { registry: "NOT CONFIGURED", address: null, localAddresses: locals };
  }
  const checksum = getAddress(address);
  if (locals.some((local) => local.toLowerCase() === checksum.toLowerCase())) {
    return { registry: "FAIL", address: checksum, localAddresses: locals, local: true };
  }
  return { registry: "CONFIGURED", address: checksum, localAddresses: locals };
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

function manifestVerifier(manifest) {
  const entry = manifest?.chains?.["1"];
  if (!entry || typeof entry !== "object") return { address: null, hash: null };
  const address = typeof entry.canonicalVerifierAddress === "string" && isAddress(entry.canonicalVerifierAddress)
    && !isZeroAddress(entry.canonicalVerifierAddress)
    ? getAddress(entry.canonicalVerifierAddress)
    : null;
  const hash = typeof entry.verifierBytecodeSha256 === "string" && /^[0-9a-fA-F]{64}$/.test(entry.verifierBytecodeSha256)
    ? entry.verifierBytecodeSha256.toLowerCase()
    : null;
  return { address, hash };
}

function loadText(file, override) {
  if (typeof override === "string" || override === null) return override;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * Selector of the production verifier's verifyProof, taken from that contract's
 * existing declaration. A missing declaration does not invent an identity.
 * @param {string | null | undefined} source
 */
export function canonicalVerifierSelector(source) {
  if (typeof source !== "string" || !source.includes("contract Groth16VerifierV2Production")) return null;
  if (!/function\s+verifyProof\s*\(\s*uint\[2\]\s+calldata\s+_pA\s*,\s*uint\[2\]\[2\]\s+calldata\s+_pB\s*,\s*uint\[2\]\s+calldata\s+_pC\s*,\s*uint\[30\]\s+calldata\s+_pubSignals\s*\)/.test(source)) {
    return null;
  }
  return toFunctionSelector(VERIFY_PROOF_SELECTOR);
}

function bytecodeMatchesVerifier(code, selector) {
  if (!selector || !bytecodePresent(code)) return false;
  const body = selector.startsWith("0x") ? selector.slice(2) : selector;
  const hex = code.startsWith("0x") || code.startsWith("0X") ? code.slice(2) : code;
  return hex.toLowerCase().includes(body.toLowerCase());
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

export async function defaultMainnetConnect({ rpcUrl }) {
  if (typeof rpcUrl !== "string" || !isHttpUrl(rpcUrl)) throw new Error(REASON_RPC_INVALID);
  const { createPublicClient, http } = await import("viem");
  const { mainnet } = await import("viem/chains");
  const client = createPublicClient({
    chain: mainnet,
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

function finish(exitCode, lines) {
  return { ok: exitCode === EXIT_PASS, exitCode, lines };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ connect?: Function, registrySource?: string | null, manifest?: object | null }} [deps]
 */
function registryLabel(binding) {
  if (binding.registry === "CONFIGURED") return "CONFIGURED";
  if (binding.registry === "FAIL") return "FAIL";
  return "NOT CONFIGURED";
}

export async function runMainnetPreflight(env = process.env, deps = {}) {
  const rpcRaw = typeof env?.MAINNET_RPC_URL === "string" ? env.MAINNET_RPC_URL.trim() : "";
  const binding = readMainnetVerifierBinding(loadText(REGISTRY_SOURCE, deps.registrySource));
  const configured = readAddress(env?.AEGIS_MAINNET_CANONICAL_VERIFIER);
  const manifest = manifestVerifier(loadManifest(deps.manifest));
  const registryStatus = registryLabel(binding);
  const verifierFromBinding = binding.registry === "CONFIGURED" ? "CONFIGURED" : "NOT CONFIGURED";

  if (!rpcRaw) {
    return finish(EXIT_NOT_RUN, [
      "Mainnet RPC: NOT RUN",
      "Mainnet chainId: NOT RUN",
      `CanonicalRegistry: ${registryStatus}`,
      `Canonical verifier: ${verifierFromBinding}`,
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_RPC_MISSING}`,
    ]);
  }
  if (!isHttpUrl(rpcRaw)) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: FAIL",
      "Mainnet chainId: NOT RUN",
      `CanonicalRegistry: ${registryStatus}`,
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_RPC_INVALID}`,
    ]);
  }

  let snapshot;
  try {
    snapshot = await (deps.connect ?? defaultMainnetConnect)({ rpcUrl: rpcRaw });
  } catch (err) {
    const reason = err instanceof Error && (err.message === REASON_RPC_INVALID || err.message === REASON_RPC_FAILED)
      ? err.message
      : REASON_RPC_FAILED;
    return finish(EXIT_FAIL, [
      "Mainnet RPC: FAIL",
      "Mainnet chainId: FAIL",
      `CanonicalRegistry: ${registryStatus}`,
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${reason}`,
    ]);
  }

  const chainId = toSafeChainId(snapshot?.chainId);
  if (chainId === null) {
    return finish(EXIT_NOT_RUN, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: NOT RUN",
      `CanonicalRegistry: ${registryStatus}`,
      `Canonical verifier: ${verifierFromBinding}`,
      "Canonical verifier bytecode: NOT RUN",
    ]);
  }
  if (chainId !== MAINNET_CHAIN_ID) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: FAIL",
      "Mainnet chainId: FAIL",
      `CanonicalRegistry: ${registryStatus}`,
      "Canonical verifier bytecode: NOT RUN",
      `FAIL ${REASON_CHAIN}`,
    ]);
  }

  if (binding.registry === "FAIL") {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: FAIL",
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${binding.local ? REASON_LOCALHOST : REASON_SOURCE}`,
    ]);
  }

  if (binding.registry !== "CONFIGURED" || !binding.address) {
    return finish(EXIT_NOT_RUN, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: NOT CONFIGURED",
      "Canonical verifier: NOT CONFIGURED",
      "Canonical verifier bytecode: NOT RUN",
      "Ethereum Mainnet preflight: NOT CONFIGURED",
    ]);
  }

  let address = binding.address;
  const verifierState = "CONFIGURED";
  if (configured.state === "invalid") {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: CONFIGURED",
      "Canonical verifier: FAIL",
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_VERIFIER_INVALID}`,
    ]);
  }
  if (configured.state === "present" && binding.address.toLowerCase() !== configured.address.toLowerCase()) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: CONFIGURED",
      "Canonical verifier: FAIL",
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_MISMATCH}`,
    ]);
  }

  if (address && binding.localAddresses.some((local) => local.toLowerCase() === address.toLowerCase())) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      `CanonicalRegistry: ${registryStatus}`,
      "Canonical verifier: FAIL",
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_LOCALHOST}`,
    ]);
  }

  const registryEnv = readAddress(env?.AEGIS_MAINNET_CANONICAL_REGISTRY);
  if (registryEnv.state === "invalid") {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      `CanonicalRegistry: ${registryStatus}`,
      `Canonical verifier: ${verifierState}`,
      "Canonical verifier bytecode: NOT RUN",
      `Reason: ${REASON_REGISTRY_INVALID}`,
    ]);
  }

  if (!address) {
    return finish(EXIT_NOT_RUN, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: NOT CONFIGURED",
      "Canonical verifier: NOT CONFIGURED",
      "Canonical verifier bytecode: NOT RUN",
      "Ethereum Mainnet preflight: NOT CONFIGURED",
    ]);
  }

  let code;
  try {
    code = await snapshot.getCode(address);
  } catch (err) {
    const reason = err instanceof Error && err.message === REASON_CODE_FAILED ? err.message : REASON_CODE_FAILED;
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      `CanonicalRegistry: ${registryStatus}`,
      `Canonical verifier: ${verifierState}`,
      "Canonical verifier bytecode: FAIL",
      `Reason: ${reason}`,
    ]);
  }

  if (!bytecodePresent(code)) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      `CanonicalRegistry: ${registryStatus}`,
      `Canonical verifier: ${verifierState}`,
      "Canonical verifier bytecode: NOT DEPLOYED",
      `FAIL ${REASON_NO_CODE}`,
    ]);
  }

  if (binding.registry !== "CONFIGURED") {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: NOT CONFIGURED",
      "Canonical verifier: CONFIGURED",
      "Canonical verifier bytecode: PRESENT",
      `Reason: ${REASON_UNBOUND}`,
    ]);
  }

  const selector = canonicalVerifierSelector(loadText(VERIFIER_SOURCE, deps.verifierSource));
  if (!selector || !bytecodeMatchesVerifier(code, selector)) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: CONFIGURED",
      "Canonical verifier: CONFIGURED",
      "Canonical verifier bytecode: PRESENT",
      FAIL_IDENTITY,
      `Reason: ${selector ? REASON_IDENTITY : REASON_IDENTITY_METADATA}`,
    ]);
  }

  if (manifest.address && manifest.address.toLowerCase() !== address.toLowerCase()) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: CONFIGURED",
      "Canonical verifier: CONFIGURED",
      "Canonical verifier identity: VERIFIED",
      "Canonical verifier bytecode: PRESENT",
      FAIL_MANIFEST,
      `Reason: ${REASON_MANIFEST_ADDRESS}`,
    ]);
  }
  if (manifest.hash && bytecodeSha256(code) !== manifest.hash) {
    return finish(EXIT_FAIL, [
      "Mainnet RPC: CONNECTED",
      "Mainnet chainId: 1",
      "CanonicalRegistry: CONFIGURED",
      "Canonical verifier: CONFIGURED",
      "Canonical verifier identity: VERIFIED",
      "Canonical verifier bytecode: PRESENT",
      FAIL_MANIFEST,
      `Reason: ${REASON_HASH}`,
    ]);
  }

  const lines = [
    "Mainnet RPC: CONNECTED",
    "Mainnet RPC: PASS",
    "Mainnet chainId: 1",
    "CanonicalRegistry: CONFIGURED",
    "Canonical verifier: CONFIGURED",
    `Canonical verifier: ${address}`,
    "Canonical verifier: DEPLOYED",
    "Canonical verifier bytecode: PRESENT",
    "Canonical verifier bytecode: DEPLOYED",
    "Canonical verifier identity: VERIFIED",
  ];
  if (manifest.address || manifest.hash) lines.push("deployment manifest: MATCHED");
  lines.push(
    "Mainnet Canonical Verifier: READY",
    "Ethereum Mainnet preflight: PASS",
    "No transaction was created or broadcast.",
  );
  return finish(EXIT_PASS, lines);
}
