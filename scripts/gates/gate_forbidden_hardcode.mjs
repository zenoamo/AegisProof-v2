// GATE: Forbidden hardcodes (#6).
// Scans v2 circuit artifacts, SSoT, generated code, and v2 contracts for
// forbidden constants: the v1 hand-picked domain separator, and hardcoded
// protocol values that disagree with the SSoT. Generated codegen output is
// exempt ONLY for the NUS-derived domain (it is machine-generated from SSoT).
import fs from "fs";
import path from "path";
import { loadSsot, PATHS, P2, ROOT, check, finish } from "./gate_lib.mjs";

const ssot = loadSsot();
const V1_DOMAIN = "548923749238475923";

const scanTargets = [
  PATHS.sym,
  PATHS.ssot,
  path.join(P2, "tests/input_v2.json"),
  path.join(ROOT, "contracts/AegisShieldV2.sol"),
  path.join(ROOT, "contracts/Groth16VerifierV2.sol"),
  path.join(ROOT, "generated/AegisSignals.ts"),
];
for (const t of scanTargets) {
  if (!fs.existsSync(t)) continue; // v2 contracts/generated not yet produced
  const txt = fs.readFileSync(t, "utf8");
  check(!txt.includes(V1_DOMAIN), `hardcode:no-v1-domain:${path.basename(t)}`, "v1 hand-picked domain absent");
}

// SSoT-derived constants must be consistent everywhere they appear
const genSol = path.join(ROOT, "contracts/generated/AegisSignals.sol");
if (fs.existsSync(genSol)) {
  const txt = fs.readFileSync(genSol, "utf8");
  check(txt.includes("86400"), "hardcode:max-age-consistent", "MAX_AGE=86400 in generated Solidity");
  check(txt.includes("300"), "hardcode:skew-consistent", "CLOCK_SKEW=300 in generated Solidity");
  check(!txt.includes(V1_DOMAIN), "hardcode:no-v1-domain:AegisSignals.sol", "v1 domain absent from generated Solidity");
}

// forbidden: timestamp must not be marked as a commitment/nullifier input
const ts = ssot.publicSignals.find((s) => s.name === "timestamp");
check(ts && ts.binding === "none (untrusted metadata)", "hardcode:timestamp-unbound", "timestamp binding policy intact");

// forbidden: protocol version disagreement
check(ssot.version === 2, "hardcode:protocol-version", "SSoT protocol version = 2");

finish("forbidden-hardcode");
