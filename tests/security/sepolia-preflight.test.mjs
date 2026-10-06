import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getAddress } from "viem";
import { canonicalVerifierSelector } from "../../scripts/lib/mainnet-preflight.mjs";
import { readSepoliaVerifierBinding, runSepoliaPreflight } from "../../scripts/lib/sepolia-preflight.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_REGISTRY = fs.readFileSync(path.join(ROOT, "protocol/contracts/AegisCanonicalRegistry.sol"), "utf8");
const RPC = "https://rpc.example.test/sepolia?token=hidden-query";
const VERIFIER = getAddress("0x2222222222222222222222222222222222222222");
const HARDHAT = getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
const MAINNET = getAddress("0x014468895DB46636dCEED11A0981c3dB3d8BE146");
const CODE = "0x6001600c600052";
const VERIFIER_SOL = fs.readFileSync(path.join(ROOT, "protocol/contracts/Groth16VerifierV2Production.sol"), "utf8");
const SELECTOR = canonicalVerifierSelector(VERIFIER_SOL);
const IDENTITY_CODE = `0x${SELECTOR.slice(2)}6001`;
const IDENTITY_HASH = createHash("sha256").update(Buffer.from(IDENTITY_CODE.slice(2), "hex")).digest("hex");

function boundSource(address = VERIFIER) {
  return `
    library AegisCanonicalRegistry {
      uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
      uint256 internal constant HARDHAT_CHAIN_ID = 31337;
      uint256 internal constant MAINNET_CHAIN_ID = 1;
      address internal constant HARDHAT_VERIFIER = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
      address internal constant MAINNET_VERIFIER = 0x014468895DB46636dCEED11A0981c3dB3d8BE146;
      address internal constant SEPOLIA_VERIFIER = ${address};
      function verifierForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) return HARDHAT_VERIFIER;
        if (chainId == SEPOLIA_CHAIN_ID) return SEPOLIA_VERIFIER;
        return address(0);
      }
      function registryForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == SEPOLIA_CHAIN_ID) return 0x3333333333333333333333333333333333333333;
        return address(0);
      }
    }
  `;
}

function linesOf(result) {
  return result.lines.join("\n");
}

function containsSecret(text) {
  return text.includes(RPC) || text.includes("hidden-query") || text.includes("not-a-key") || text.includes("rpc-secret");
}

test("live CanonicalRegistry does not bind Sepolia", () => {
  const binding = readSepoliaVerifierBinding(REAL_REGISTRY);
  assert.equal(binding.registry, "NOT CONFIGURED");
  assert.equal(binding.address, null);
  assert.match(REAL_REGISTRY, /0x014468895DB46636dCEED11A0981c3dB3d8BE146/);
  assert.equal(REAL_REGISTRY.includes("11155111"), false);
});

test("registryForChain is not the verifier binding", () => {
  const source = `
    library AegisCanonicalRegistry {
      function verifierForChain(uint256 chainId) internal pure returns (address) {
        return address(0);
      }
      function registryForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == 11155111) return 0x3333333333333333333333333333333333333333;
        return address(0);
      }
    }
  `;
  const binding = readSepoliaVerifierBinding(source);
  assert.equal(binding.registry, "NOT CONFIGURED");
  assert.equal(binding.address, null);
});

test("case A: no Sepolia RPC stays NOT RUN and unconfigured", async () => {
  let called = false;
  const result = await runSepoliaPreflight(
    {
      MAINNET_RPC_URL: "https://mainnet.example.test/hidden",
      SEPOLIA_CANONICAL_VERIFIER: VERIFIER,
      AEGIS_MAINNET_CANONICAL_VERIFIER: MAINNET,
    },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => {
        called = true;
        return { chainId: 11155111, getCode: async () => IDENTITY_CODE };
      },
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 3);
  assert.match(linesOf(result), /Sepolia RPC: NOT RUN/);
  assert.match(linesOf(result), /Sepolia chainId: NOT RUN/);
  assert.match(linesOf(result), /Sepolia CanonicalRegistry: NOT CONFIGURED/);
  assert.match(linesOf(result), /Sepolia Canonical verifier: NOT CONFIGURED/);
  assert.match(linesOf(result), /Sepolia Canonical verifier bytecode: NOT RUN/);
  assert.doesNotMatch(linesOf(result), /Sepolia Canonical Verifier: READY/);
  assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /production provenance: VERIFIED/);
  assert.doesNotMatch(linesOf(result), /Groth16 regression: PASS/);
  assert.equal(containsSecret(linesOf(result)), false);
});

test("case B: wrong chain fails closed", async () => {
  for (const chainId of [1, 31337]) {
    let called = false;
    const result = await runSepoliaPreflight(
      { SEPOLIA_RPC_URL: RPC, MAINNET_RPC_URL: "https://mainnet.example.test/hidden" },
      {
        registrySource: boundSource(),
        connect: async ({ rpcUrl }) => {
          assert.equal(rpcUrl, RPC);
          return {
            chainId,
            getCode: async () => {
              called = true;
              return IDENTITY_CODE;
            },
          };
        },
      },
    );
    assert.equal(called, false);
    assert.equal(result.exitCode, 1);
    assert.match(linesOf(result), /FAIL unexpected chainId/);
    assert.doesNotMatch(linesOf(result), /Sepolia chainId: 11155111/);
    assert.doesNotMatch(linesOf(result), /Sepolia Canonical Verifier: READY/);
    assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
    assert.equal(containsSecret(linesOf(result)), false);
  }
});

test("case C: address zero is not configured and does not query bytecode", async () => {
  let called = false;
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC, SEPOLIA_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({
        chainId: 11155111,
        getCode: async () => {
          called = true;
          return IDENTITY_CODE;
        },
      }),
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 3);
  assert.match(linesOf(result), /Sepolia RPC: CONNECTED/);
  assert.match(linesOf(result), /Sepolia chainId: 11155111/);
  assert.match(linesOf(result), /Sepolia CanonicalRegistry: NOT CONFIGURED/);
  assert.match(linesOf(result), /Sepolia Canonical verifier: NOT CONFIGURED/);
  assert.match(linesOf(result), /Sepolia Canonical verifier bytecode: NOT RUN/);
  assert.doesNotMatch(linesOf(result), /Sepolia Canonical Verifier: READY/);
  assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /no deployed bytecode/);
});

test("case D: configured address with empty code fails undeployed", async () => {
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: { deploymentStatus: "not-deployed", chains: {} },
      connect: async () => ({ chainId: 11155111, getCode: async () => "0x" }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), new RegExp(`Sepolia Canonical verifier: ${VERIFIER}`));
  assert.match(linesOf(result), /Sepolia Canonical verifier bytecode: NOT DEPLOYED/);
  assert.match(linesOf(result), /FAIL canonical verifier address has no deployed bytecode/);
  assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /Sepolia RPC: NOT RUN/);
});

test("case E: arbitrary bytecode is not the canonical verifier", async () => {
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: { deploymentStatus: "not-deployed", chains: {} },
      connect: async () => ({ chainId: 11155111, getCode: async () => CODE }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /FAIL canonical verifier identity mismatch/);
  assert.doesNotMatch(linesOf(result), /Sepolia Canonical Verifier: READY/);
  assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /production provenance: VERIFIED/);
  assert.doesNotMatch(linesOf(result), /Groth16 regression: PASS/);
});

test("case F: manifest address or hash mismatch fails", async () => {
  const other = getAddress("0x4444444444444444444444444444444444444444");
  const addressMismatch = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: {
        chains: { "11155111": { canonicalVerifierAddress: other, verifierBytecodeSha256: IDENTITY_HASH } },
      },
      connect: async () => ({ chainId: 11155111, getCode: async () => IDENTITY_CODE }),
    },
  );
  assert.equal(addressMismatch.exitCode, 1);
  assert.match(linesOf(addressMismatch), /FAIL deployment manifest mismatch/);
  assert.doesNotMatch(linesOf(addressMismatch), /Sepolia preflight: PASS/);

  const hashMismatch = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: {
        chains: { "11155111": { canonicalVerifierAddress: VERIFIER, verifierBytecodeSha256: "ab".repeat(32) } },
      },
      connect: async () => ({ chainId: 11155111, getCode: async () => IDENTITY_CODE }),
    },
  );
  assert.equal(hashMismatch.exitCode, 1);
  assert.match(linesOf(hashMismatch), /FAIL deployment manifest mismatch/);
  assert.doesNotMatch(linesOf(hashMismatch), /deployment manifest: MATCHED/);
});

test("case G: valid deployment reaches READY without a production provenance claim", async () => {
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: {
        deploymentStatus: "not-deployed",
        chains: { "11155111": { chainId: 11155111, canonicalVerifierAddress: VERIFIER, verifierBytecodeSha256: IDENTITY_HASH } },
      },
      connect: async () => ({ chainId: 11155111n, getCode: async (address) => (address === VERIFIER ? IDENTITY_CODE : "0x") }),
    },
  );
  assert.equal(result.exitCode, 0);
  assert.match(linesOf(result), /Sepolia RPC: CONNECTED/);
  assert.match(linesOf(result), /Sepolia chainId: 11155111/);
  assert.match(linesOf(result), /Sepolia CanonicalRegistry: CONFIGURED/);
  assert.match(linesOf(result), new RegExp(`Sepolia Canonical verifier: ${VERIFIER}`));
  assert.match(linesOf(result), /Sepolia Canonical verifier bytecode: DEPLOYED/);
  assert.match(linesOf(result), /Sepolia Canonical verifier identity: VERIFIED/);
  assert.match(linesOf(result), /deployment manifest: MATCHED/);
  assert.match(linesOf(result), /Sepolia Canonical Verifier: READY/);
  assert.match(linesOf(result), /Sepolia preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /production provenance: VERIFIED/);
  assert.doesNotMatch(linesOf(result), /Groth16 regression: PASS/);
  assert.equal(containsSecret(linesOf(result)), false);
});

test("localhost and mainnet addresses are not a Sepolia verifier", async () => {
  for (const [address, reason] of [
    [HARDHAT, /localhost verifier is not a Sepolia deployment/],
    [MAINNET, /mainnet verifier is not a Sepolia deployment/],
  ]) {
    let called = false;
    const result = await runSepoliaPreflight(
      { SEPOLIA_RPC_URL: RPC },
      {
        registrySource: boundSource(address),
        connect: async () => ({
          chainId: 11155111,
          getCode: async () => {
            called = true;
            return IDENTITY_CODE;
          },
        }),
      },
    );
    assert.equal(called, false);
    assert.equal(result.exitCode, 1);
    assert.match(linesOf(result), reason);
    assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
  }
});

test("invalid signer value is not echoed and does not become the verifier", async () => {
  let called = false;
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC, SEPOLIA_PRIVATE_KEY: "not-a-key" },
    {
      registrySource: boundSource(),
      connect: async () => ({
        chainId: 11155111,
        getCode: async () => {
          called = true;
          return IDENTITY_CODE;
        },
      }),
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Sepolia signer: FAIL/);
  assert.match(linesOf(result), /Reason: SEPOLIA_PRIVATE_KEY is invalid/);
  assert.equal(linesOf(result).includes("not-a-key"), false);
  assert.doesNotMatch(linesOf(result), /Sepolia Canonical Verifier: READY/);
});

test("unreadable chain id is NOT RUN and does not query bytecode", async () => {
  let called = false;
  const result = await runSepoliaPreflight(
    { SEPOLIA_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      connect: async () => ({
        chainId: undefined,
        getCode: async () => {
          called = true;
          return IDENTITY_CODE;
        },
      }),
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 3);
  assert.match(linesOf(result), /Sepolia RPC: NOT RUN/);
  assert.match(linesOf(result), /Sepolia chainId: NOT RUN/);
  assert.doesNotMatch(linesOf(result), /FAIL unexpected chainId/);
  assert.doesNotMatch(linesOf(result), /Sepolia preflight: PASS/);
});

test("workflow keeps Sepolia secrets on the production environment job", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/aegis_repro_ci.yml"), "utf8");
  assert.match(workflow, /node scripts\/sepolia-preflight\.mjs/);
  assert.match(workflow, /SEPOLIA_RPC_URL: \$\{\{ secrets\.SEPOLIA_RPC_URL \}\}/);
  assert.match(workflow, /SEPOLIA_PRIVATE_KEY: \$\{\{ secrets\.SEPOLIA_PRIVATE_KEY \}\}/);
  assert.match(workflow, /npm run test:sepolia-preflight/);
  const lib = fs.readFileSync(path.join(ROOT, "scripts/lib/sepolia-preflight.mjs"), "utf8");
  assert.equal(lib.includes("aegis-provenance-prod-v1"), false);
  assert.equal(lib.includes("production provenance: VERIFIED"), false);
  assert.equal(lib.includes("Groth16 regression: PASS"), false);
  assert.equal(/writeFile|https?:\/\//.test(lib), false);
  assert.equal(/0x[0-9a-fA-F]{40}/.test(lib), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/manifest.json"), "utf8"));
  assert.equal(manifest.chains["11155111"], undefined);
});

test("cli missing RPC credential exits NOT RUN", () => {
  const result = spawnSync(process.execPath, ["scripts/sepolia-preflight.mjs"], {
    cwd: ROOT,
    env: { ...process.env, SEPOLIA_RPC_URL: "", SEPOLIA_PRIVATE_KEY: "" },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 3);
  assert.match(output, /Sepolia RPC: NOT RUN/);
  assert.match(output, /Sepolia chainId: NOT RUN/);
  assert.match(output, /Sepolia CanonicalRegistry: NOT CONFIGURED/);
  assert.match(output, /Sepolia Canonical verifier: NOT CONFIGURED/);
  assert.match(output, /Sepolia Canonical verifier bytecode: NOT RUN/);
  assert.doesNotMatch(output, /Sepolia Canonical Verifier: READY/);
  assert.doesNotMatch(output, /Sepolia preflight: PASS/);
});
