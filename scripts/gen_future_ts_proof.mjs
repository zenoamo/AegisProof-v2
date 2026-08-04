// ============================================================================
// Dev test artifact generator: proof with an out-of-window timestamp.
// ----------------------------------------------------------------------------
// The v2 circuit intentionally does NOT constrain `timestamp` (SSoT: "none
// (untrusted metadata)"), so a proof can be produced with ANY timestamp.
// AegisShieldV2's window check must reject it at the contract layer. This
// script proves that property end-to-end by generating a valid proof whose
// declared timestamp lies far outside [now - MAX_AGE - SKEW, now + SKEW].
//
// Output: artifacts/phase2/tests/proof_v2_future_ts.json (DEV test artifact;
// produced from the dev zkey; also asserts that changing the timestamp does
// NOT change the nullifier — timestamp excluded from the nullifier input set).
// ============================================================================
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P2 = path.join(ROOT, "artifacts", "phase2");
const CACHE = path.join(P2, "cache");

const input = JSON.parse(fs.readFileSync(path.join(P2, "tests/input_v2.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(P2, "proofs/proof_v2_baseline.json"), "utf8"));

// timestamp far beyond MAX_AGE(86400)+SKEW(300) relative to the test clock
const futureInput = { ...input, timestamp: (BigInt(input.timestamp) + 1000000n).toString() };

// witness calculator (CJS module copied into the phase2 cache, as in the suite)
fs.mkdirSync(CACHE, { recursive: true });
const calcCjs = path.join(CACHE, "witness_calculator.cjs");
fs.copyFileSync(path.join(P2, "r1cs/aegis_commit_core_v2_js/witness_calculator.js"), calcCjs);
const wc = await require(calcCjs)(
  fs.readFileSync(path.join(P2, "r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm"))
);
// sanityCheck=1: circuit must accept the future timestamp (proves it is unbound)
const rawBin = await wc.calculateBinWitness(futureInput, 1);

// .wtns container (same layout as scripts/phase2_verify.mjs writeWtnsFile)
const n8 = 32;
const PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const nVars = rawBin.length / n8;
const head = Buffer.alloc(12);
head.write("wtns", 0, "ascii");
head.writeUInt32LE(2, 4);
head.writeUInt32LE(2, 8);
const s1 = Buffer.alloc(12 + 8 + n8);
s1.writeUInt32LE(1, 0);
s1.writeBigUInt64LE(BigInt(8 + n8), 4);
s1.writeUInt32LE(n8, 12);
let prime = PRIME;
for (let i = 0; i < n8; i++) {
  s1[16 + i] = Number(prime & 0xffn);
  prime >>= 8n;
}
s1.writeUInt32LE(nVars, 16 + n8);
const s2head = Buffer.alloc(12);
s2head.writeUInt32LE(2, 0);
s2head.writeBigUInt64LE(BigInt(rawBin.length), 4);
const wtnsPath = path.join(CACHE, "witness_future_ts.wtns");
fs.writeFileSync(wtnsPath, Buffer.concat([head, s1, s2head, Buffer.from(rawBin)]));

const zkey = path.join(P2, "setup/aegis_v2_0000.zkey");
const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, wtnsPath);
fs.rmSync(wtnsPath, { force: true });

// consistency assertions against the baseline vector
if (publicSignals[29] !== baseline.publicSignals[29]) {
  throw new Error("nullifier changed when only timestamp changed — timestamp must be excluded from nullifier");
}
if (publicSignals[28] !== baseline.publicSignals[28]) {
  throw new Error("commitment changed when only timestamp changed — timestamp must be excluded from commitment");
}
if (publicSignals[24] !== futureInput.timestamp) {
  throw new Error("timestamp signal does not carry the declared value");
}
const vkey = JSON.parse(fs.readFileSync(path.join(P2, "vkey/vkey_v2.json"), "utf8"));
const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
if (ok !== true) throw new Error("future-timestamp proof failed snarkjs verification");

fs.writeFileSync(
  path.join(P2, "tests/proof_v2_future_ts.json"),
  JSON.stringify({ proof, publicSignals }, null, 2),
  "utf8"
);
console.log("wrote artifacts/phase2/tests/proof_v2_future_ts.json");
console.log("nullifier identical to baseline:", publicSignals[29] === baseline.publicSignals[29]);
console.log("proof verifies against dev vkey:", ok);
process.exit(0);
