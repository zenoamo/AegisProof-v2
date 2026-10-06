// Sepolia connection checks. Ephemeral keys stay in memory and are never written.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { isProductionProvenanceVerified, PRODUCTION_PROVENANCE_KEY_ID } from "../scripts/lib/external-provenance-signer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_NETWORK,
  SEPOLIA_CREDENTIAL_ROLE,
  classifySepoliaCanonicalRegistry,
  verifySepoliaConnection,
} = await import("../scripts/lib/sepolia-connection.mjs");

let passed = 0;
function ok(cond, name) {
  assert.equal(Boolean(cond), true, name);
  passed++;
  console.log(`PASS ${name}`);
}

const ephemeralKey = generatePrivateKey();
const ephemeralAccount = privateKeyToAccount(ephemeralKey);
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
  const body = ephemeralKey.slice(2);
  return text.includes(ephemeralKey)
    || text.includes(body)
    || text.includes(body.slice(0, 8))
    || text.includes(body.slice(-8))
    || text.includes("hidden-query")
    || text.includes(rpcUrl);
}

function successConnect(input) {
  ok(!Object.prototype.hasOwnProperty.call(input, "privateKey"), "rpc connect receives no private key");
  ok(input.rpcUrl === rpcUrl, "rpc connect receives configured url");
  return { chainId: SEPOLIA_CHAIN_ID };
}

function successDerive(input) {
  ok(!Object.prototype.hasOwnProperty.call(input, "rpcUrl"), "signer derive receives no rpc url");
  ok(input.privateKey === ephemeralKey, "signer derive receives configured key");
  return { address: signer };
}

ok(SEPOLIA_CHAIN_ID === 11155111, "sepolia chain id is 11155111");
ok(SEPOLIA_NETWORK === "sepolia", "sepolia network name");
ok(SEPOLIA_CREDENTIAL_ROLE === "evm-connectivity", "sepolia credential role is evm connectivity");
ok(SEPOLIA_CREDENTIAL_ROLE !== "production-provenance", "sepolia role is not production provenance");
ok(PRODUCTION_PROVENANCE_KEY_ID === "aegis-provenance-prod-v1", "production identity stays distinct");

const pass = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  { connect: successConnect, deriveSigner: successDerive },
);
ok(pass.exitCode === 0 && pass.ok === true, "valid configuration exits 0");
ok(linesOf(pass).includes("Sepolia RPC: CONNECTED"), "valid configuration prints RPC CONNECTED");
ok(linesOf(pass).includes("Sepolia chainId: 11155111"), "valid configuration prints chainId");
ok(linesOf(pass).includes("Sepolia signer: AVAILABLE"), "valid configuration prints signer AVAILABLE");
ok(linesOf(pass).includes(`Signer address: ${signer}`), "valid configuration prints signer address");
ok(linesOf(pass).includes("Sepolia CanonicalRegistry: NOT CONFIGURED"), "live registry source is not configured");
ok(!linesOf(pass).includes("production provenance: VERIFIED"), "sepolia success is not production provenance");
ok(!linesOf(pass).includes("Groth16 regression: PASS"), "sepolia success is not groth16 regression");
ok(!linesOf(pass).includes(PRODUCTION_PROVENANCE_KEY_ID), "sepolia output is not the production identity");
ok(!containsSecret(linesOf(pass)), "valid configuration output omits credentials");

const generated = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  { connect: async () => ({ chainId: 11155111 }) },
);
ok(generated.exitCode === 0, "real signer derivation exits 0");
ok(generated.address === ephemeralAccount.address, "signer address matches the ephemeral key");
ok(linesOf(generated).includes(`Signer address: ${ephemeralAccount.address}`), "generated address is printed");
ok(!containsSecret(linesOf(generated)), "generated address output omits the private key");

const missingUrl = await verifySepoliaConnection(
  { SEPOLIA_PRIVATE_KEY: ephemeralKey },
  {
    connect: async () => { throw new Error("should not connect"); },
    deriveSigner: successDerive,
  },
);
ok(missingUrl.exitCode === 3 && missingUrl.ok === false, "missing rpc url is NOT RUN");
ok(missingUrl.rpc === "NOT RUN" && missingUrl.chainId === "NOT RUN", "missing rpc url leaves chain unchecked");
ok(missingUrl.signer === "AVAILABLE", "missing rpc url still derives a signer");
ok(linesOf(missingUrl).includes("Sepolia RPC: NOT RUN"), "missing rpc url prints NOT RUN");
ok(linesOf(missingUrl).includes("Reason: SEPOLIA_RPC_URL is not configured"), "missing rpc url reason");
ok(!linesOf(missingUrl).includes("Sepolia RPC: CONNECTED"), "missing rpc url is not CONNECTED");
ok(!containsSecret(linesOf(missingUrl)), "missing rpc url output omits key");

const missingKey = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl },
  {
    connect: async () => ({ chainId: SEPOLIA_CHAIN_ID }),
    deriveSigner: async () => { throw new Error("should not derive"); },
  },
);
ok(missingKey.exitCode === 3 && missingKey.ok === false, "missing private key is NOT RUN");
ok(missingKey.rpc === "CONNECTED" && missingKey.chainId === "11155111", "missing key can still validate rpc");
ok(missingKey.signer === "NOT RUN", "missing key does not invent a signer");
ok(linesOf(missingKey).includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "missing private key reason");
ok(!linesOf(missingKey).includes("Signer address:"), "missing key does not print an address");
ok(!containsSecret(linesOf(missingKey)), "missing private key output omits rpc url");

const bothMissing = await verifySepoliaConnection({}, {
  connect: async () => { throw new Error("should not connect"); },
  deriveSigner: async () => { throw new Error("should not derive"); },
});
ok(bothMissing.exitCode === 3, "missing both credentials is NOT RUN");
ok(linesOf(bothMissing).includes("Reason: SEPOLIA_RPC_URL is not configured"), "missing both reports rpc url");
ok(linesOf(bothMissing).includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "missing both reports private key");
ok(linesOf(bothMissing).indexOf("SEPOLIA_RPC_URL") < linesOf(bothMissing).indexOf("SEPOLIA_PRIVATE_KEY"), "missing both reports rpc url first");

const mismatch = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  {
    connect: async () => ({ chainId: 1 }),
    deriveSigner: successDerive,
  },
);
ok(mismatch.exitCode === 1 && mismatch.ok === false, "unexpected chain id exits 1");
ok(linesOf(mismatch).includes("Sepolia RPC: FAIL"), "unexpected chain id prints RPC FAIL");
ok(linesOf(mismatch).includes("Sepolia chainId: FAIL"), "unexpected chain id prints chain FAIL");
ok(linesOf(mismatch).includes("Reason: unexpected chainId"), "unexpected chain id reason");
ok(mismatch.signer === "AVAILABLE", "unexpected chain id still reports the signer");
ok(!linesOf(mismatch).includes("Sepolia RPC: CONNECTED"), "unexpected chain id is not CONNECTED");
ok(!linesOf(mismatch).includes("Sepolia chainId: 11155111"), "unexpected chain id does not claim 11155111");
ok(!containsSecret(linesOf(mismatch)), "unexpected chain id output omits credentials");

const leaked = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey },
  {
    connect: async () => { throw new Error(`dial failed ${rpcUrl} key ${ephemeralKey}`); },
    deriveSigner: successDerive,
  },
);
ok(leaked.exitCode === 1, "rpc failure exits 1");
ok(linesOf(leaked).includes("Sepolia RPC: FAIL"), "rpc failure prints RPC FAIL");
ok(linesOf(leaked).includes("Reason: Sepolia RPC connection failed"), "rpc failure reason");
ok(!containsSecret(linesOf(leaked)), "rpc failure output omits credentials");

const invalidKey = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: "not-a-key" },
  {
    connect: async () => ({ chainId: SEPOLIA_CHAIN_ID }),
    deriveSigner: async () => { throw new Error("should not derive"); },
  },
);
ok(invalidKey.exitCode === 1, "invalid private key exits 1");
ok(invalidKey.signer === "FAIL", "invalid private key fails the signer");
ok(invalidKey.rpc === "CONNECTED", "invalid private key does not hide a good rpc");
ok(linesOf(invalidKey).includes("Reason: SEPOLIA_PRIVATE_KEY is invalid"), "invalid private key reason");
ok(!linesOf(invalidKey).includes("not-a-key"), "invalid private key is not echoed");
ok(!/length|prefix|suffix/i.test(linesOf(invalidKey)), "invalid private key output has no key metadata");

const overflow = `0x${"f".repeat(64)}`;
const overflowResult = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: overflow },
  { connect: async () => ({ chainId: SEPOLIA_CHAIN_ID }) },
);
ok(overflowResult.exitCode === 1 && overflowResult.signer === "FAIL", "out-of-range private key fails closed");
ok(linesOf(overflowResult).includes("Reason: SEPOLIA_PRIVATE_KEY is invalid"), "out-of-range private key reason");
ok(!linesOf(overflowResult).includes(overflow) && !linesOf(overflowResult).includes("f".repeat(16)), "out-of-range private key is not echoed");

const invalidUrl = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: "ftp://secret-host.example/hidden", SEPOLIA_PRIVATE_KEY: ephemeralKey },
  {
    connect: async () => { throw new Error("should not connect"); },
    deriveSigner: successDerive,
  },
);
ok(invalidUrl.exitCode === 1 && invalidUrl.rpc === "FAIL", "invalid rpc url fails closed");
ok(linesOf(invalidUrl).includes("Reason: SEPOLIA_RPC_URL is invalid"), "invalid rpc url reason");
ok(!linesOf(invalidUrl).includes("secret-host") && !linesOf(invalidUrl).includes("ftp://"), "invalid rpc url is not echoed");

const bare = ephemeralKey.slice(2).toUpperCase();
const barePass = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: rpcUrl, SEPOLIA_PRIVATE_KEY: bare },
  {
    connect: async () => ({ chainId: "11155111" }),
    deriveSigner: async ({ privateKey }) => {
      ok(privateKey === ephemeralKey, "bare hex key is normalized in memory");
      return { address: signer };
    },
  },
);
ok(barePass.exitCode === 0, "bare hex key can connect");
ok(!linesOf(barePass).includes(bare), "bare hex key is absent from output");

const whitespace = await verifySepoliaConnection(
  { SEPOLIA_RPC_URL: "   ", SEPOLIA_PRIVATE_KEY: "\n" },
  {
    connect: async () => { throw new Error("should not connect"); },
    deriveSigner: async () => { throw new Error("should not derive"); },
  },
);
ok(whitespace.exitCode === 3, "blank credentials are not configured");

const productionEnv = await verifySepoliaConnection(
  {
    AEGIS_PQC_PRIVATE_KEY_HEX: "ab".repeat(32),
    AEGIS_PROVENANCE_KEY_ID: PRODUCTION_PROVENANCE_KEY_ID,
    AEGIS_PROVENANCE_SIGNING: "kms",
  },
  {
    connect: async () => { throw new Error("should not connect"); },
    deriveSigner: async () => { throw new Error("should not derive"); },
  },
);
ok(productionEnv.exitCode === 3 && productionEnv.signer === "NOT RUN", "production env is not a sepolia credential");
ok(isProductionProvenanceVerified({
  sepoliaSigner: "AVAILABLE",
  signerAddress: ephemeralAccount.address,
  productionKeyProvisioned: false,
  manifestSignedByProductionKeyId: false,
  manifestSignatureStatus: "NOT_VERIFIED",
}) === false, "sepolia signer presence is not production provenance VERIFIED");
ok(isProductionProvenanceVerified({
  provisioningState: "UNPROVISIONED",
  productionKeyProvisioned: true,
  manifestSignedByProductionKeyId: true,
  manifestSignatureStatus: "VERIFIED",
}) === false, "unprovisioned production key stays unverified");

const registrySource = fs.readFileSync(path.join(ROOT, "protocol/contracts/AegisCanonicalRegistry.sol"), "utf8");
ok(classifySepoliaCanonicalRegistry(registrySource) === "NOT CONFIGURED", "canonical registry has no sepolia deployment");
ok(!registrySource.includes("11155111"), "canonical registry source does not name sepolia chain id");
ok(classifySepoliaCanonicalRegistry(null) === "NOT RUN", "unreadable registry source is NOT RUN");
ok(classifySepoliaCanonicalRegistry(`
  function registryForChain(uint256 chainId) internal pure returns (address) {
    if (chainId == 11155111) return address(0);
    return address(0);
  }
`) === "NOT CONFIGURED", "address zero is not a sepolia deployment");
ok(classifySepoliaCanonicalRegistry(`
  uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
  function registryForChain(uint256 chainId) internal pure returns (address) {
    if (chainId == SEPOLIA_CHAIN_ID) return 0x1111111111111111111111111111111111111111;
    return address(0);
  }
`) === "CONFIGURED", "explicit non-zero sepolia return is configured");

const libSrc = fs.readFileSync(path.join(ROOT, "scripts/lib/sepolia-connection.mjs"), "utf8");
const cliSrc = fs.readFileSync(path.join(ROOT, "scripts/verify-sepolia.mjs"), "utf8");
ok(!/writeFile|appendFile|createWriteStream|mkdirSync/.test(libSrc + cliSrc), "connection sources do not write files");
ok(!/0x[0-9a-fA-F]{64}/.test(libSrc + cliSrc), "connection sources contain no key literal");
ok(!/0x[0-9a-fA-F]{40}/.test(libSrc), "connection source invents no registry address");
ok(!/https?:\/\//.test(libSrc), "connection source contains no hardcoded rpc url");
ok(!libSrc.includes(PRODUCTION_PROVENANCE_KEY_ID), "sepolia module does not name the production key");
ok(!libSrc.includes("loadPrivateKey") && !libSrc.includes("ml_dsa"), "sepolia module does not load provenance keys");
ok(!libSrc.includes("production provenance: VERIFIED"), "sepolia module cannot emit production verified");

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
ok(cliMissing.status === 3, "cli missing credentials exits 3");
ok(cliMissingOut.includes("Sepolia RPC: NOT RUN"), "cli missing url prints NOT RUN");
ok(cliMissingOut.includes("Sepolia signer: NOT RUN"), "cli missing key prints NOT RUN");
ok(cliMissingOut.includes("Reason: SEPOLIA_RPC_URL is not configured"), "cli missing url reason");
ok(cliMissingOut.includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "cli missing key reason");
ok(cliMissingOut.includes("Sepolia CanonicalRegistry: NOT CONFIGURED"), "cli missing credentials still reports registry");
ok(!cliMissingOut.includes(ephemeralKey), "cli missing url omits ephemeral key");

const closedUrl = "http://127.0.0.1:9/?token=cli-hidden-token";
const cliNoKey = runCli({ SEPOLIA_RPC_URL: closedUrl, SEPOLIA_PRIVATE_KEY: "" });
const cliNoKeyOut = `${cliNoKey.stdout}\n${cliNoKey.stderr}`;
ok(cliNoKey.status === 1, "cli unreachable rpc with a missing key fails closed");
ok(cliNoKeyOut.includes("Sepolia RPC: FAIL"), "cli missing key still fails a present rpc");
ok(cliNoKeyOut.includes("Sepolia signer: NOT RUN"), "cli missing key prints signer NOT RUN");
ok(cliNoKeyOut.includes("Reason: SEPOLIA_PRIVATE_KEY is not configured"), "cli missing key reason");
ok(!cliNoKeyOut.includes("cli-hidden-token") && !cliNoKeyOut.includes("127.0.0.1"), "cli missing key omits rpc url");

const cliClosed = runCli({ SEPOLIA_RPC_URL: closedUrl, SEPOLIA_PRIVATE_KEY: ephemeralKey });
const cliClosedOut = `${cliClosed.stdout}\n${cliClosed.stderr}`;
ok(cliClosed.status === 1, "cli unreachable rpc exits 1");
ok(cliClosedOut.includes("Sepolia RPC: FAIL"), "cli unreachable rpc prints FAIL");
ok(cliClosedOut.includes("Reason: Sepolia RPC connection failed"), "cli unreachable rpc reason");
ok(cliClosedOut.includes("Sepolia signer: AVAILABLE"), "cli unreachable rpc still reports the signer");
ok(cliClosedOut.includes(`Signer address: ${ephemeralAccount.address}`), "cli unreachable rpc prints the address only");
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

function workflowJob(yaml, name) {
  const marker = `\n  ${name}:\n`;
  const start = yaml.indexOf(marker);
  ok(start >= 0, `workflow job ${name} exists`);
  const rest = yaml.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/aegis_repro_ci.yml"), "utf8");
const fastJob = workflowJob(workflow, "fast");
const sepoliaJob = workflowJob(workflow, "sepolia-connection");
const gateJob = workflowJob(workflow, "required-gate");
ok(fastJob.includes("npm run test:sepolia-connection"), "fast job runs sepolia unit tests");
ok(!fastJob.includes("environment:"), "fast job does not attach an environment");
ok(!fastJob.includes("secrets.SEPOLIA_") && !fastJob.includes("vars.SEPOLIA_"), "fast job does not receive sepolia credentials");
ok(sepoliaJob.includes("environment: production"), "sepolia job uses the production environment");
ok(sepoliaJob.includes("SEPOLIA_RPC_URL: ${{ secrets.SEPOLIA_RPC_URL }}"), "sepolia rpc url comes from environment secrets");
ok(sepoliaJob.includes("SEPOLIA_PRIVATE_KEY: ${{ secrets.SEPOLIA_PRIVATE_KEY }}"), "sepolia private key comes from environment secrets");
ok(!sepoliaJob.includes("vars.SEPOLIA_"), "sepolia credentials are not read from vars");
ok(!/echo .*(SEPOLIA_PRIVATE_KEY|SEPOLIA_RPC_URL)|printenv|env \|+|set -x|toJSON\(secrets\)/.test(sepoliaJob), "sepolia job does not dump credentials");
ok(!sepoliaJob.includes(".env") && !sepoliaJob.includes("upload-artifact"), "sepolia job does not write or upload secrets");
ok(!sepoliaJob.includes(PRODUCTION_PROVENANCE_KEY_ID) && !sepoliaJob.includes("AEGIS_PQC_PRIVATE_KEY"), "sepolia job does not use provenance credentials");
ok(gateJob.includes("needs.sepolia-connection.result"), "required gate observes the sepolia job");
ok(gateJob.includes('"$SEPOLIA_STATUS" == "CONNECTED"') && gateJob.includes('"$SEPOLIA_STATUS" == "NOT_RUN"'), "required gate accepts only connected or not run");

console.log(`\n${passed} PASS`);
