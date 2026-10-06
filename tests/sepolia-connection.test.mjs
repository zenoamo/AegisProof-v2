// Sepolia connection checks. Ephemeral keys stay in memory and are never written.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  SEPOLIA_CHAIN_ID,
  verifySepoliaConnection,
} = await import("../scripts/lib/sepolia-connection.mjs");

let passed = 0;
function ok(cond, name) {
  assert.equal(Boolean(cond), true, name);
  passed++;
  console.log(`PASS ${name}`);
}

const ephemeralKey = generatePrivateKey();
const rpcUrl = "https://rpc.example.test/sepolia?token=hidden-query";
const signer = "0x1111111111111111111111111111111111111111";

function trackedSnapshot() {
  const out = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  ok(out.status === 0, "git ls-files");
  return out.stdout;
}

const filesBefore = trackedSnapshot();

function linesOf(result) {
  return result.lines.join("\n");
}

function containsSecret(text) {
  return text.includes(ephemeralKey) || text.includes(ephemeralKey.slice(2)) || text.includes("hidden-query") || text.includes(rpcUrl);
}

const pass = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  {
    connect: async ({ rpcUrl: gotUrl, privateKey }) => {
      ok(gotUrl === rpcUrl, "connect receives configured rpc url");
      ok(privateKey === ephemeralKey, "connect receives configured private key");
      return { chainId: SEPOLIA_CHAIN_ID, address: signer, balanceEth: "1.25" };
    },
  },
);
ok(pass.exitCode === 0, "valid connection exits 0");
ok(linesOf(pass).includes("Sepolia connection: PASS"), "valid connection prints PASS");
ok(linesOf(pass).includes("chainId: 11155111"), "valid connection prints chainId");
ok(linesOf(pass).includes("network: Sepolia"), "valid connection prints network");
ok(linesOf(pass).includes(`signer: ${signer}`), "valid connection prints signer");
ok(linesOf(pass).includes("balance: 1.25 ETH"), "valid connection prints balance");
ok(!containsSecret(linesOf(pass)), "valid connection output omits credentials");

const missingUrl = await verifySepoliaConnection({ SEPOLIA_PRIVATE_KEY: ephemeralKey }, { connect: async () => { throw new Error("should not connect"); } });
ok(missingUrl.exitCode === 1, "missing rpc url exits 1");
ok(linesOf(missingUrl).includes("Sepolia connection: FAIL"), "missing rpc url prints FAIL");
ok(linesOf(missingUrl).includes("Reason: SEPOLIA_RPC_URL is not configured"), "missing rpc url reason");
ok(!containsSecret(linesOf(missingUrl)), "missing rpc url output omits key");

const missingKey = await verifySepoliaConnection({ SEPOLIA_RPC_URL: rpcUrl }, { connect: async () => { throw new Error("should not connect"); } });
ok(missingKey.exitCode === 1, "missing private key exits 1");
ok(linesOf(missingKey).includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "missing private key reason");
ok(!containsSecret(linesOf(missingKey)), "missing private key output omits rpc url");

const bothMissing = await verifySepoliaConnection({}, { connect: async () => { throw new Error("should not connect"); } });
ok(linesOf(bothMissing).includes("Reason: SEPOLIA_RPC_URL is not configured"), "missing both reports rpc url first");

const mismatch = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  { connect: async () => ({ chainId: 1, address: signer, balanceEth: "9" }) },
);
ok(mismatch.exitCode === 1, "chainId mismatch exits 1");
ok(linesOf(mismatch).includes("Reason: RPC chainId mismatch"), "chainId mismatch reason");
ok(linesOf(mismatch).includes("Expected: 11155111"), "chainId mismatch expected");
ok(linesOf(mismatch).includes("Actual: 1"), "chainId mismatch actual");
ok(!linesOf(mismatch).includes("Sepolia connection: PASS"), "chainId mismatch is not PASS");
ok(!containsSecret(linesOf(mismatch)), "chainId mismatch output omits credentials");

const leaked = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  { connect: async () => { throw new Error(`dial failed ${rpcUrl} key ${ephemeralKey}`); } },
);
ok(leaked.exitCode === 1, "connection failure exits 1");
ok(linesOf(leaked).includes("Reason: Sepolia RPC connection failed"), "connection failure reason");
ok(!containsSecret(linesOf(leaked)), "connection failure output omits credentials");

const invalidKey = await verifySepoliaConnection({
  SEPOLIA_RPC_URL: rpcUrl,
  SEPOLIA_PRIVATE_KEY: "not-a-key",
});
ok(linesOf(invalidKey).includes("Reason: SEPOLIA_PRIVATE_KEY is invalid"), "invalid private key reason");
ok(!linesOf(invalidKey).includes("not-a-key"), "invalid private key is not echoed");

const bare = ephemeralKey.slice(2);
const barePass = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: bare },
  {
    connect: async ({ privateKey }) => {
      ok(privateKey === ephemeralKey, "bare hex key is normalized in memory");
      return { chainId: 11155111, address: signer, balanceEth: "0" };
    },
  },
);
ok(barePass.exitCode === 0, "bare hex key can connect");
ok(!linesOf(barePass).includes(bare), "bare hex key is absent from output");

const libSrc = fs.readFileSync(path.join(ROOT, "scripts/lib/sepolia-connection.mjs"), "utf8");
const cliSrc = fs.readFileSync(path.join(ROOT, "scripts/verify-sepolia.mjs"), "utf8");
ok(!/writeFile|appendFile|createWriteStream|mkdirSync/.test(libSrc + cliSrc), "connection sources do not write files");
ok(!/0x[0-9a-fA-F]{64}/.test(libSrc + cliSrc), "connection sources contain no key literal");
ok(!libSrc.includes("production provenance") && !libSrc.includes("loadPrivateKey"), "sepolia module does not load provenance keys");

const filesAfter = trackedSnapshot();
ok(filesBefore === filesAfter, "connection check does not change tracked files");

function runCli(extraEnv) {
  const env = { ...process.env, ...extraEnv };
  return spawnSync(process.execPath, ["scripts/verify-sepolia.mjs"], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 20_000,
  });
}

const cliMissing = runCli({ SEPOLIA_RPC_URL: "", SEPOLIA_PRIVATE_KEY: "" });
const cliMissingOut = `${cliMissing.stdout}\n${cliMissing.stderr}`;
ok(cliMissing.status === 1, "cli missing url exits 1");
ok(cliMissingOut.includes("Reason: SEPOLIA_RPC_URL is not configured"), "cli missing url reason");
ok(!cliMissingOut.includes(ephemeralKey), "cli missing url omits ephemeral key");

const cliNoKey = runCli({ SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: "" });
ok(`${cliNoKey.stdout}\n${cliNoKey.stderr}`.includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "cli missing key reason");
ok(!`${cliNoKey.stdout}\n${cliNoKey.stderr}`.includes("hidden-query"), "cli missing key omits rpc query");

const closedUrl = "http://127.0.0.1:9/?token=cli-hidden-token";
const cliClosed = runCli({ SEPOLIA_RPC_URL: closedUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey });
const cliClosedOut = `${cliClosed.stdout}\n${cliClosed.stderr}`;
ok(cliClosed.status === 1, "cli unreachable rpc exits 1");
ok(cliClosedOut.includes("Sepolia connection: FAIL"), "cli unreachable rpc prints FAIL");
ok(cliClosedOut.includes("Reason: Sepolia RPC connection failed"), "cli unreachable rpc reason");
ok(!cliClosedOut.includes(ephemeralKey) && !cliClosedOut.includes(ephemeralKey.slice(2)), "cli unreachable rpc omits private key");
ok(!cliClosedOut.includes("cli-hidden-token") && !cliClosedOut.includes("127.0.0.1"), "cli unreachable rpc omits url");

function workspaceContains(secret, ignored = new Set()) {
  const skip = new Set(["node_modules", ".git", "rapidsnark", "cache"]);
  const needle = Buffer.from(secret);
  const stack = [ROOT];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      if (skip.has(name)) continue;
      const abs = path.join(dir, name);
      if (ignored.has(abs)) continue;
      const st = fs.statSync(abs);
      if (st.isDirectory()) stack.push(abs);
      else if (st.size < 2_000_000 && fs.readFileSync(abs).includes(needle)) return true;
    }
  }
  return false;
}

const selfPath = fileURLToPath(import.meta.url);
ok(!workspaceContains(ephemeralKey) && !workspaceContains(ephemeralKey.slice(2)), "ephemeral key is not stored in the workspace");
ok(
  !workspaceContains("cli-hidden-token", new Set([selfPath])) && !workspaceContains("hidden-query", new Set([selfPath])),
  "rpc query fixtures are not written outside the test",
);

console.log(`\n${passed} PASS`);
