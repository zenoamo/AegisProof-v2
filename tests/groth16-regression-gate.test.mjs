// Static integrity vs Groth16 regression availability.
// Does not generate proofs and does not modify Frozen Core artifacts.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  classifyGroth16Regression,
  regressionCountsAsPass,
  verifyFrozenCoreArtifactIntegrity,
  EXIT_REGRESSION_FAIL,
  EXIT_REGRESSION_NOT_RUN,
  PRODUCTION_R1CS_SHA256,
  PRODUCTION_WASM_SHA256,
} = await import("../scripts/lib/groth16-regression-gate.mjs");
const { PRODUCTION_VKEY_HASH, resolveArtifacts } = await import("../scripts/lib/resolve-artifacts.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const live = resolveArtifacts();
const savedPath = process.env.AEGIS_PRODUCTION_ZKEY_PATH;
const savedClaim = process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE;
delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
delete process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE;
let tmp;

function restoreEnv() {
  if (savedPath === undefined) delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
  else process.env.AEGIS_PRODUCTION_ZKEY_PATH = savedPath;
  if (savedClaim === undefined) delete process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE;
  else process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE = savedClaim;
}

try {
  const integrity = verifyFrozenCoreArtifactIntegrity(live);
  ok(integrity.ok, "Test 4: Frozen Core hash verification runs without production.zkey");
  ok(integrity.errors.length === 0, "Test 1/4: static integrity PASS on pinned WASM, R1CS, and vkey");

  const absent = classifyGroth16Regression({ paths: live, claimed: null });
  ok(absent.status === "NOT_RUN", "Test 1: missing production.zkey is Groth16 regression NOT RUN");
  ok(absent.exitCode === EXIT_REGRESSION_NOT_RUN, "Test 1: NOT RUN uses exit 2");
  ok(absent.countsAsPass === false, "Test 1: NOT RUN does not count as pass");
  ok(regressionCountsAsPass(absent.status) === false, "Test 1: NOT RUN != PASS");
  ok(regressionCountsAsPass("PASS") === true, "PASS status is the only regression pass");
  ok(!fs.existsSync(live.zkey), "this workspace has no production.zkey file");

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-zkey-"));
  const fakeZkey = path.join(tmp, "production.zkey");
  fs.writeFileSync(fakeZkey, "not-a-real-proving-key");
  const withZkey = {
    ...live,
    zkey: fakeZkey,
  };
  const ready = classifyGroth16Regression({ paths: withZkey, claimed: null });
  ok(ready.status === "RUN", "Test 2: resolvable production.zkey selects T1–T9 execution");
  ok(ready.exitCode === null, "Test 2: RUN is not a finished PASS exit");
  ok(ready.countsAsPass === false, "Test 2: deciding to run is not regression PASS");

  const claimedAndPresent = classifyGroth16Regression({ paths: withZkey, claimed: true });
  ok(claimedAndPresent.status === "RUN", "Test 5: available=true plus a resolvable zkey runs regression");

  const claimedFalseButPresent = classifyGroth16Regression({ paths: withZkey, claimed: false });
  ok(
    claimedFalseButPresent.status === "RUN",
    "Test 5: available=false does not hide a resolvable production.zkey"
  );

  const claimedButMissing = classifyGroth16Regression({ paths: live, claimed: true });
  ok(claimedButMissing.status === "FAIL", "Test 5: available=true without a zkey file fails closed");
  ok(claimedButMissing.exitCode === EXIT_REGRESSION_FAIL, "Test 5: contradiction is exit 1, not NOT RUN");
  ok(claimedButMissing.countsAsPass === false, "Test 5: contradiction is not PASS");

  const invalidClaim = classifyGroth16Regression({ paths: live, claimed: "invalid" });
  ok(invalidClaim.status === "FAIL", "Test 5: unrecognized availability flag fails closed");

  process.env.AEGIS_PRODUCTION_ZKEY_PATH = "relative/production.zkey";
  process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE = "true";
  const relative = classifyGroth16Regression();
  ok(relative.status === "FAIL", "Test 5: relative AEGIS_PRODUCTION_ZKEY_PATH fails closed");
  ok(relative.countsAsPass === false, "Test 5: relative path is not regression PASS");
  delete process.env.AEGIS_PRODUCTION_ZKEY_PATH;
  delete process.env.AEGIS_PRODUCTION_ZKEY_AVAILABLE;

  const brokenVkey = path.join(tmp, "production-vkey.json");
  fs.writeFileSync(brokenVkey, '{"protocol":"groth16","nPublic":30,"tampered":true}\n');
  const badIntegrity = verifyFrozenCoreArtifactIntegrity({ ...live, vkey: brokenVkey });
  ok(!badIntegrity.ok, "Test 3: changed vkey is static integrity FAIL");
  ok(
    badIntegrity.errors.some((error) => error.includes("vkey")),
    "Test 3: vkey mismatch is reported as an integrity error"
  );

  const brokenWasm = path.join(tmp, "aegis_commit_core_v2.wasm");
  fs.writeFileSync(brokenWasm, "not-wasm");
  const badWasm = verifyFrozenCoreArtifactIntegrity({ ...live, wasm: brokenWasm });
  ok(!badWasm.ok, "Test 3: changed WASM is static integrity FAIL");

  const brokenR1cs = path.join(tmp, "aegis_commit_core_v2.r1cs");
  fs.writeFileSync(brokenR1cs, "not-r1cs");
  const badR1cs = verifyFrozenCoreArtifactIntegrity({ ...live, r1cs: brokenR1cs });
  ok(!badR1cs.ok, "Test 3: changed R1CS is static integrity FAIL");

  ok(PRODUCTION_WASM_SHA256.startsWith("a0d3c53f3cdce624"), "WASM pin prefix unchanged");
  ok(PRODUCTION_R1CS_SHA256.startsWith("3d47226b06d707b1"), "R1CS pin prefix unchanged");
  ok(PRODUCTION_VKEY_HASH.startsWith("d012bd29ff6e4c44"), "vkey pin unchanged");

  const cli = spawnSync(process.execPath, ["scripts/verify-frozen-core-integrity.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  ok(cli.status === 0, "static integrity CLI exits 0 when pins match");
  ok(cli.stdout.includes("Frozen Core artifact integrity: PASS"), "CLI prints integrity PASS");
  ok(!cli.stdout.includes("Groth16 regression: PASS"), "integrity CLI does not claim regression PASS");

  const suite = spawnSync(process.execPath, ["scripts/run-prover-compat.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
  const suiteOut = `${suite.stdout ?? ""}\n${suite.stderr ?? ""}`;
  ok(suite.status === EXIT_REGRESSION_NOT_RUN, "Test 1: prover-compat process exits 2 without production.zkey");
  ok(suiteOut.includes("Groth16 regression: NOT RUN"), "Test 1: prover-compat prints Groth16 regression NOT RUN");
  ok(suiteOut.includes("Reason: production.zkey unavailable"), "Test 1: prover-compat names the missing zkey");
  ok(!suiteOut.includes("Groth16 regression: PASS"), "Test 1: prover-compat does not print Groth16 regression PASS");
  ok(!suiteOut.includes("T1:"), "Test 1: T1 does not execute when production.zkey is absent");

  const npmSuite = spawnSync("npm", ["run", "test:prover-compat"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
  ok(
    npmSuite.status === EXIT_REGRESSION_NOT_RUN,
    "Test 1: npm run test:prover-compat preserves exit 2"
  );

  const executed = spawnSync(process.execPath, ["scripts/run-prover-compat.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      AEGIS_PRODUCTION_ZKEY_PATH: fakeZkey,
    },
  });
  const executedOut = `${executed.stdout ?? ""}\n${executed.stderr ?? ""}`;
  ok(executed.status === EXIT_REGRESSION_FAIL, "Test 2: a present but unusable zkey is regression FAIL, not exit 0");
  ok(executedOut.includes("Groth16 regression: RUN"), "Test 2: T1–T9 execution starts when the zkey file exists");
  ok(executedOut.includes("Invalid File format"), "Test 2: T1 prove runs against the supplied zkey");
  ok(executedOut.includes("Groth16 regression: FAIL"), "Test 2: proof failure stays Groth16 regression FAIL");
  ok(!executedOut.includes("Groth16 regression: NOT RUN"), "Test 2: a resolvable zkey is not NOT RUN");
  ok(!executedOut.includes("Groth16 regression: PASS"), "Test 2: a failed proof is not Groth16 regression PASS");

  console.log(`\nGROTH16 REGRESSION GATE: ${passed} checks PASS`);
} finally {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  restoreEnv();
}
