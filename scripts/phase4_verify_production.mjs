// ============================================================================
// Phase 4 production VK verification (post-ceremony, post-contract-generation).
// ----------------------------------------------------------------------------
// 1. Generates a baseline proof from the canonical witness input using the
//    PRODUCTION zkey (never the dev zkey).
// 2. Verifies it with snarkjs against production-vkey.json.
// 3. Cross-checks the generated PRODUCTION verifier contract's embedded IC
//    constants against the production vkey (contract/VK alignment).
// 4. Persists artifacts/phase4/reports/production_proof_baseline.json for the
//    on-chain verifier test (test/Groth16VerifierV2Production.ts).
// The input vector is the already-committed public evidence vector; nothing
// secret is disclosed. Failure at any step => exit 1 (never treated as pass).
// ============================================================================
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(ROOT, p);
const P4 = R("artifacts/phase4");
const ZKEY = path.join(P4, "final", "production.zkey");
const VKEY_JSON = path.join(P4, "final", "production-vkey.json");
const WITNESS_DIR = path.join(P4, "reports", "scratch");
const INPUT = R("artifacts/phase2/tests/input_v2.json");
const WASM = R("artifacts/phase2/r1cs/aegis_commit_core_v2_js/aegis_commit_core_v2.wasm");
const CALC_SRC = R("artifacts/phase2/r1cs/aegis_commit_core_v2_js/witness_calculator.js");
const SOL = R("contracts/Groth16VerifierV2Production.sol");
const OUT_PROOF = path.join(P4, "reports", "production_proof_baseline.json");

const fail = (m) => {
  console.error(`FAIL: ${m}`);
  process.exit(1);
};
const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

if (!fs.existsSync(ZKEY) || !fs.existsSync(VKEY_JSON)) fail("production ceremony artifacts missing");
if (fs.existsSync(SOL) === false) fail("production verifier contract missing — run scripts/gen_verifier_production.mjs first");

const vkey = JSON.parse(fs.readFileSync(VKEY_JSON, "utf8"));
const input = JSON.parse(fs.readFileSync(INPUT, "utf8"));

// witness via the CANONICAL wasm (frozen v2 circuit)
fs.mkdirSync(WITNESS_DIR, { recursive: true });
const calcCjs = path.join(WITNESS_DIR, "witness_calculator.cjs");
fs.copyFileSync(CALC_SRC, calcCjs);
const wc = await require(calcCjs)(fs.readFileSync(WASM));
const witBin = await wc.calculateBinWitness(input, 1);

// .wtns container (same layout as phase2 suite)
const n8 = 32;
const PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const nVars = witBin.length / n8;
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
s2head.writeBigUInt64LE(BigInt(witBin.length), 4);
const wtnsPath = path.join(WITNESS_DIR, "production_smoke.wtns");
fs.writeFileSync(wtnsPath, Buffer.concat([head, s1, s2head, Buffer.from(witBin)]));

// PROVE with the PRODUCTION zkey (dev zkey never touched)
const { proof, publicSignals } = await snarkjs.groth16.prove(ZKEY, wtnsPath, silent);
fs.rmSync(wtnsPath, { force: true });

// canonical signal order + values
if (publicSignals.length !== 30) fail(`publicSignals.length=${publicSignals.length}`);
for (const s of JSON.parse(fs.readFileSync(R("specs/aegis-protocol.v2.json"), "utf8")).publicSignals) {
  if (BigInt(publicSignals[s.index]) !== BigInt(input[s.name]))
    fail(`signal ${s.index} (${s.name}) deviates from canonical input value`);
}
console.log("PASS production proof publicSignals match canonical 30-signal layout");

// snarkjs verification against the production vkey
const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof, silent);
if (ok !== true) fail("production proof FAILED verification against production vkey");
console.log("PASS production proof verifies against production-vkey.json (snarkjs)");

// negative: tampered signal must fail
const tampered = [...publicSignals];
tampered[22] = (BigInt(tampered[22]) + 1n).toString();
const okTampered = await snarkjs.groth16.verify(vkey, tampered, proof, silent);
if (okTampered === true) fail("tampered signal accepted — IC binding broken");
console.log("PASS tampered signal rejected (IC linear-combination binding)");

// contract/VK alignment: IC x-coordinates embedded in the production verifier
const sol = fs.readFileSync(SOL, "utf8");
const icMatches = [...sol.matchAll(/uint256 constant IC(\d+)x = (\d+);/g)].sort((a, b) => +a[1] - +b[1]);
if (icMatches.length !== 31) fail(`contract IC constant count = ${icMatches.length} (expected 31)`);
for (let i = 0; i < 31; i++) {
  if (BigInt(icMatches[i][2]) !== BigInt(vkey.IC[i][0])) fail(`contract IC${i}x != vkey IC[${i}][0]`);
}
console.log("PASS contract IC constants == production vkey IC (31/31)");

// persist the proof for the on-chain test
fs.writeFileSync(OUT_PROOF, JSON.stringify({ proof, publicSignals }, null, 2), "utf8");
console.log(`wrote ${path.relative(ROOT, OUT_PROOF)}`);
console.log(`production zkey hash: ${sha256File(ZKEY)}`);
console.log("PRODUCTION VK VERIFICATION: PASS");
process.exit(0);
