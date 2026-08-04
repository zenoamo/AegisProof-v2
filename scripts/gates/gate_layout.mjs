// GATE: Layout (C-1 canonical signal layout) — standalone CI gate (#1).
// Static: SSoT vs .sym wire names vs R1CS header.
// Measured: baseline witness publicSignals carry inputs at SSoT indices.
import { createRequire } from "module";
import fs from "fs";
import { loadSsot, PATHS, genWitness, check, finish } from "./gate_lib.mjs";

const require = createRequire(import.meta.url);
const ssot = loadSsot();

// --- static: SSoT schema ------------------------------------------------------
check(ssot.publicSignals.length === 30, "layout:ssot-signal-count", `publicSignals=${ssot.publicSignals.length}`);
let contiguous = true;
ssot.publicSignals.forEach((s, i) => {
  if (s.index !== i) contiguous = false;
});
check(contiguous, "layout:ssot-indices-contiguous", "0..29");

// --- static: .sym wire order --------------------------------------------------
const sym = fs.readFileSync(PATHS.sym, "utf8").split(/\r?\n/).filter((l) => l.trim());
const nameByWire = {};
for (const l of sym) {
  const p = l.split(",");
  nameByWire[+p[0]] = p[3].trim().replace("main.", "");
}
let symOk = true;
const mism = [];
ssot.publicSignals.forEach((s, i) => {
  if (nameByWire[i + 1] !== s.name) {
    symOk = false;
    mism.push(`wire ${i + 1}: sym=${nameByWire[i + 1]} ssot=${s.name}`);
  }
});
check(symOk, "layout:sym-vs-ssot", symOk ? "wires 1..30 = SSoT order" : mism.join("; "));
check(nameByWire[31] === "secretKey" && nameByWire[32] === "deviceId", "layout:private-wires", "wires 31/32");

// --- static: R1CS header ------------------------------------------------------
const { readR1cs } = require("r1csfile");
const fd = await readR1cs(PATHS.r1cs, {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  loadConstraints: false,
});
check(fd.nPubInputs === 30, "layout:r1cs-nPublic", `nPubInputs=${fd.nPubInputs}`);
check(fd.nPrvInputs === 2, "layout:r1cs-nPrivate", `nPrvInputs=${fd.nPrvInputs}`);
check(fd.nOutputs === 0, "layout:r1cs-nOutputs", `nOutputs=${fd.nOutputs} (input-flip)`);
check(fd.nConstraints > 0, "layout:r1cs-constraints", `nConstraints=${fd.nConstraints}`);

// --- measured: witness publicSignals at canonical positions --------------------
const input = JSON.parse(fs.readFileSync(PATHS.input, "utf8"));
const witness = await genWitness(input);
const ps = witness.slice(1, 31);
let measuredOk = true;
ssot.publicSignals.forEach((s, i) => {
  if (BigInt(ps[i]) !== BigInt(input[s.name])) measuredOk = false;
});
check(measuredOk, "layout:measured-publicSignals", "30 signals in canonical SSoT order (witness-measured)");

finish("layout");
