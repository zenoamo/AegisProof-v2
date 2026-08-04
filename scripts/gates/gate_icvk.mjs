// GATE: IC/VK consistency — standalone CI gate (#3).
// Source priority: committed vkey_v2.json (pinned evidence); if a dev zkey is
// present, the exported key MUST match it (cross-check, never skipped).
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";
import { loadSsot, PATHS, check, finish } from "./gate_lib.mjs";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };
const ssot = loadSsot();

if (!fs.existsSync(PATHS.vkey)) {
  check(false, "icvk:vkey-present", "vkey_v2.json missing");
  finish("icvk");
}
const vkey = JSON.parse(fs.readFileSync(PATHS.vkey, "utf8"));

check(vkey.protocol === "groth16", "icvk:protocol", vkey.protocol);
check(vkey.IC.length === 31, "icvk:ic-length", `IC.length=${vkey.IC.length} (nPublic+1=31)`);
check(vkey.nPublic === 30, "icvk:nPublic", `nPublic=${vkey.nPublic}`);

// curve membership of IC + alpha/beta/delta (Montgomery-form coordinates)
const curve = await snarkjs.curves.getCurveFromName("bn128");
const F1 = curve.G1.F;
const g1Point = (p) => {
  const b = new Uint8Array(F1.n8 * 3);
  b.set(F1.e(BigInt(p[0])), 0);
  b.set(F1.e(BigInt(p[1])), F1.n8);
  b.set(F1.e(1n), 2 * F1.n8);
  return b;
};
const f2e = (c0, c1) => {
  const b = new Uint8Array(F1.n8 * 2);
  b.set(F1.e(c0), 0);
  b.set(F1.e(c1), F1.n8);
  return b;
};
const F2 = curve.G2.F;
const g2Point = (p) => {
  const b = new Uint8Array(F2.n8 * 3);
  b.set(f2e(BigInt(p[0][0]), BigInt(p[0][1])), 0);
  b.set(f2e(BigInt(p[1][0]), BigInt(p[1][1])), F2.n8);
  b.set(f2e(1n, 0n), 2 * F2.n8);
  return b;
};
let onCurve = true;
for (const ic of vkey.IC) if (!curve.G1.isValid(g1Point(ic))) onCurve = false;
if (!curve.G1.isValid(g1Point(vkey.vk_alpha_1))) onCurve = false;
if (!curve.G2.isValid(g2Point(vkey.vk_beta_2))) onCurve = false;
if (!curve.G2.isValid(g2Point(vkey.vk_delta_2))) onCurve = false;
check(onCurve, "icvk:on-curve", "31 IC points + alpha/beta/delta on BN128");

// baseline proof alignment (when present)
if (fs.existsSync(PATHS.proof)) {
  const { publicSignals } = JSON.parse(fs.readFileSync(PATHS.proof, "utf8"));
  check(publicSignals.length === vkey.IC.length - 1, "icvk:signal-alignment", `publicSignals=${publicSignals.length} = IC.length-1`);
  let posOk = true;
  ssot.publicSignals.forEach((s, i) => {
    if (BigInt(publicSignals[i]) !== BigInt(JSON.parse(fs.readFileSync(PATHS.input, "utf8"))[s.name])) posOk = false;
  });
  check(posOk, "icvk:proof-signals-canonical", "baseline proof publicSignals in SSoT order");
} else {
  check(true, "icvk:proof-signals-canonical", "no baseline proof present (dev setup not generated) — alignment deferred to FULL");
}

// cross-check against dev zkey when present (never skipped silently)
if (fs.existsSync(PATHS.zkey)) {
  const exported = await snarkjs.zKey.exportVerificationKey(PATHS.zkey, silentLogger);
  const a = crypto.createHash("sha256").update(JSON.stringify(vkey)).digest("hex");
  const b = crypto.createHash("sha256").update(JSON.stringify(exported)).digest("hex");
  check(a === b, "icvk:zkey-crosscheck", "committed vkey matches dev zkey export");
} else {
  check(true, "icvk:zkey-crosscheck", "dev zkey absent (CI mode) — committed vkey used");
}

finish("icvk");
