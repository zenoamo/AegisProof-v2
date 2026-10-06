import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getAddress } from "viem";
import {
  readMainnetVerifierBinding,
  runMainnetPreflight,
} from "../../scripts/lib/mainnet-preflight.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_REGISTRY = fs.readFileSync(path.join(ROOT, "protocol/contracts/AegisCanonicalRegistry.sol"), "utf8");
const RPC = "https://rpc.example.test/mainnet?token=hidden-query";
const VERIFIER = getAddress("0x1111111111111111111111111111111111111111");
const OTHER = getAddress("0x2222222222222222222222222222222222222222");
const HARDHAT = getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
const CODE = "0x6001600c600052";
const CODE_HASH = createHash("sha256").update(Buffer.from(CODE.slice(2), "hex")).digest("hex");

function boundSource(address = VERIFIER) {
  return `
    library AegisCanonicalRegistry {
      uint256 internal constant MAINNET_CHAIN_ID = 1;
      uint256 internal constant HARDHAT_CHAIN_ID = 31337;
      address internal constant HARDHAT_VERIFIER = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
      address internal constant HARDHAT_REGISTRY = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
      address internal constant MAINNET_VERIFIER = ${address};
      function verifierForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
          return HARDHAT_VERIFIER;
        }
        if (chainId == MAINNET_CHAIN_ID) {
          return MAINNET_VERIFIER;
        }
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

test("live CanonicalRegistry does not bind chain id 1", () => {
  const binding = readMainnetVerifierBinding(REAL_REGISTRY);
  assert.equal(binding.registry, "NOT CONFIGURED");
  assert.equal(binding.address, null);
  assert.match(REAL_REGISTRY, /0x014468895DB46636dCEED11A0981c3dB3d8BE146/);
});

test("case A: chain id 1 with a bound deployed verifier passes", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: boundSource(),
      manifest: { deploymentStatus: "not-deployed", chains: {} },
      connect: async ({ rpcUrl }) => {
        assert.equal(rpcUrl, RPC);
        return { chainId: 1, getCode: async (address) => (address === VERIFIER ? CODE : "0x") };
      },
    },
  );
  assert.equal(result.exitCode, 0);
  assert.match(linesOf(result), /Mainnet RPC: CONNECTED/);
  assert.match(linesOf(result), /Mainnet chainId: 1/);
  assert.match(linesOf(result), /CanonicalRegistry: CONFIGURED/);
  assert.match(linesOf(result), /Canonical verifier: CONFIGURED/);
  assert.match(linesOf(result), /Canonical verifier: DEPLOYED/);
  assert.match(linesOf(result), /Canonical verifier bytecode: PRESENT/);
  assert.match(linesOf(result), /Ethereum Mainnet preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /production provenance: VERIFIED/);
  assert.doesNotMatch(linesOf(result), /Groth16 regression: PASS/);
  assert.equal(containsSecret(linesOf(result)), false);
});

test("case B: wrong chain fails closed", async () => {
  for (const chainId of [11155111, 31337]) {
    const result = await runMainnetPreflight(
      {
        MAINNET_RPC_URL: RPC,
        SEPOLIA_RPC_URL: "https://sepolia.example.test/secret",
        SEPOLIA_PRIVATE_KEY: "0x" + "11".repeat(32),
      },
      {
        registrySource: boundSource(),
        connect: async ({ rpcUrl }) => {
          assert.equal(rpcUrl, RPC);
          return { chainId, getCode: async () => CODE };
        },
      },
    );
    assert.equal(result.exitCode, 1);
    assert.match(linesOf(result), /Mainnet RPC: FAIL/);
    assert.match(linesOf(result), /Mainnet chainId: FAIL/);
    assert.match(linesOf(result), /Reason: unexpected chainId/);
    assert.doesNotMatch(linesOf(result), /Mainnet chainId: 1/);
    assert.doesNotMatch(linesOf(result), /Ethereum Mainnet preflight: PASS/);
    assert.doesNotMatch(linesOf(result), /sepolia\.example/);
  }
});

test("case C: address zero is not configured and is not a deployment", async () => {
  let called = false;
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: "0x0000000000000000000000000000000000000000" },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({
        chainId: 1,
        getCode: async () => {
          called = true;
          return CODE;
        },
      }),
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Canonical verifier: NOT CONFIGURED/);
  assert.match(linesOf(result), /CanonicalRegistry: NOT CONFIGURED/);
  assert.doesNotMatch(linesOf(result), /Ethereum Mainnet preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /no deployed bytecode/);
});

test("case D: configured address with empty code fails undeployed", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: REAL_REGISTRY,
      manifest: { deploymentStatus: "not-deployed", chains: {} },
      connect: async () => ({ chainId: 1, getCode: async () => "0x" }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Mainnet RPC: CONNECTED/);
  assert.match(linesOf(result), /Mainnet chainId: 1/);
  assert.match(linesOf(result), /Canonical verifier: CONFIGURED/);
  assert.match(linesOf(result), /Canonical verifier bytecode: NOT DEPLOYED/);
  assert.match(linesOf(result), /FAIL canonical verifier address has no deployed bytecode/);
  assert.doesNotMatch(linesOf(result), /Ethereum Mainnet preflight: PASS/);
  assert.doesNotMatch(linesOf(result), /Mainnet RPC: NOT RUN/);
});

test("case E: deployed bytecode continues into verifier validation", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: {
        deploymentStatus: "not-deployed",
        chains: { "1": { canonicalVerifierAddress: VERIFIER, verifierBytecodeSha256: CODE_HASH } },
      },
      connect: async () => ({ chainId: 1n, getCode: async () => CODE }),
    },
  );
  assert.equal(result.exitCode, 0);
  assert.match(linesOf(result), /Canonical verifier bytecode: PRESENT/);
  assert.match(linesOf(result), /Canonical verifier: DEPLOYED/);
});

test("bytecode hash mismatch does not pass", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC },
    {
      registrySource: boundSource(),
      manifest: {
        chains: { "1": { canonicalVerifierAddress: VERIFIER, verifierBytecodeSha256: "ab".repeat(32) } },
      },
      connect: async () => ({ chainId: 1, getCode: async () => CODE }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Reason: canonical verifier bytecode does not match deployment manifest/);
  assert.doesNotMatch(linesOf(result), /Ethereum Mainnet preflight: PASS/);
});

test("case F: RPC failure is not reported as missing bytecode", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => {
        throw new Error(`dial failed ${RPC} key rpc-secret`);
      },
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Mainnet RPC: FAIL/);
  assert.match(linesOf(result), /Reason: Mainnet RPC connection failed/);
  assert.doesNotMatch(linesOf(result), /no deployed bytecode/);
  assert.equal(containsSecret(linesOf(result)), false);
});

test("bytecode query failure stays distinct from an undeployed address", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({
        chainId: 1,
        getCode: async () => {
          throw new Error(`getCode ${RPC}`);
        },
      }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Canonical verifier bytecode: FAIL/);
  assert.match(linesOf(result), /Reason: Mainnet bytecode query failed/);
  assert.doesNotMatch(linesOf(result), /no deployed bytecode/);
  assert.equal(containsSecret(linesOf(result)), false);
});

test("case G: missing RPC credential is NOT RUN and ignores Sepolia", async () => {
  let called = false;
  const result = await runMainnetPreflight(
    {
      SEPOLIA_RPC_URL: "https://sepolia.example.test/hidden",
      SEPOLIA_PRIVATE_KEY: "0x" + "22".repeat(32),
      AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER,
    },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => {
        called = true;
        return { chainId: 1, getCode: async () => "0x" };
      },
    },
  );
  assert.equal(called, false);
  assert.equal(result.exitCode, 3);
  assert.match(linesOf(result), /Mainnet RPC: NOT RUN/);
  assert.match(linesOf(result), /Mainnet chainId: NOT RUN/);
  assert.match(linesOf(result), /Canonical verifier bytecode: NOT RUN/);
  assert.match(linesOf(result), /Reason: MAINNET_RPC_URL is not configured/);
  assert.doesNotMatch(linesOf(result), /no deployed bytecode/);
  assert.doesNotMatch(linesOf(result), /sepolia\.example/);
});

test("present RPC with an undeployed verifier is not converted to NOT RUN", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: VERIFIER },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({ chainId: 1, getCode: async () => "" }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /FAIL canonical verifier address has no deployed bytecode/);
});

test("localhost and unbound bytecode cannot pass as Mainnet", async () => {
  const localhost = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: HARDHAT },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({ chainId: 1, getCode: async () => CODE }),
    },
  );
  assert.equal(localhost.exitCode, 1);
  assert.match(linesOf(localhost), /Reason: localhost verifier is not a Mainnet deployment/);
  assert.doesNotMatch(linesOf(localhost), /Ethereum Mainnet preflight: PASS/);

  const unbound = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: OTHER },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({ chainId: 1, getCode: async () => CODE }),
    },
  );
  assert.equal(unbound.exitCode, 1);
  assert.match(linesOf(unbound), /Canonical verifier bytecode: PRESENT/);
  assert.match(linesOf(unbound), /Reason: CanonicalRegistry mainnet binding is not active/);
  assert.doesNotMatch(linesOf(unbound), /Ethereum Mainnet preflight: PASS/);
});

test("invalid verifier value is not echoed", async () => {
  const result = await runMainnetPreflight(
    { MAINNET_RPC_URL: RPC, AEGIS_MAINNET_CANONICAL_VERIFIER: "not-a-key" },
    {
      registrySource: REAL_REGISTRY,
      connect: async () => ({ chainId: 1, getCode: async () => CODE }),
    },
  );
  assert.equal(result.exitCode, 1);
  assert.match(linesOf(result), /Reason: AEGIS_MAINNET_CANONICAL_VERIFIER is invalid/);
  assert.equal(linesOf(result).includes("not-a-key"), false);
});

test("workflow wires Mainnet secrets without Sepolia fallback or secret dumps", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/mainnet-preflight.yml"), "utf8");
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /MAINNET_RPC_URL: \$\{\{ secrets\.MAINNET_RPC_URL \}\}/);
  assert.match(workflow, /AEGIS_MAINNET_CANONICAL_VERIFIER: \$\{\{ secrets\.AEGIS_MAINNET_CANONICAL_VERIFIER \}\}/);
  assert.doesNotMatch(workflow, /vars\.MAINNET_RPC_URL|SEPOLIA_RPC_URL|SEPOLIA_PRIVATE_KEY|printenv|set -x|toJSON\(secrets\)/);
  assert.match(workflow, /Mainnet preflight: FAIL/);
  assert.match(workflow, /status=NOT_RUN/);
  const lib = fs.readFileSync(path.join(ROOT, "scripts/lib/mainnet-preflight.mjs"), "utf8");
  assert.equal(lib.includes("SEPOLIA_RPC_URL"), false);
  assert.equal(lib.includes("SEPOLIA_PRIVATE_KEY"), false);
  assert.equal(lib.includes("aegis-provenance-prod-v1"), false);
  assert.equal(lib.includes("production provenance: VERIFIED"), false);
  assert.equal(/writeFile|https?:\/\//.test(lib), false);
});

test("cli missing RPC credential exits NOT RUN", () => {
  const result = spawnSync(process.execPath, ["scripts/mainnet-preflight.mjs"], {
    cwd: ROOT,
    env: { ...process.env, MAINNET_RPC_URL: "" },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 3);
  assert.match(output, /Mainnet RPC: NOT RUN/);
  assert.doesNotMatch(output, /no deployed bytecode/);
  assert.doesNotMatch(output, /Ethereum Mainnet preflight: PASS/);
});
