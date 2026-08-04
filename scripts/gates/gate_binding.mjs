// GATE: Binding (C-4 computed == provided) — standalone CI gate (#2).
// Includes C-2 Poseidon(6)/(8) real-operation evidence: independent JS
// recomputation of commitment & nullifier must equal the provided public
// values, DOMAIN must re-derive via NUS, and publicSignals must carry the
// provided values at SSoT indices.
import fs from "fs";
import { loadSsot, PATHS, initPoseidon, H, utf8BE, genWitness, check, finish } from "./gate_lib.mjs";

const ssot = loadSsot();
await initPoseidon();
const input = JSON.parse(fs.readFileSync(PATHS.input, "utf8"));
const v = (n) => BigInt(input[n]);

// DOMAIN re-derivation via NUS rule
const DOMAIN = H([utf8BE(ssot.domainSeparation.domainNullifierV2Label)]);
check(DOMAIN.toString() === ssot.domainSeparation.domainNullifierV2, "binding:domain-nus", "DOMAIN_NULLIFIER_V2 re-derived from label");

// C-2: Poseidon(6) commitment real operation
const c6 = H(ssot.commitment.inputs.map((n) => v(n)));
check(c6 === v("commitment"), "binding:poseidon6-commitment", "Poseidon(6) over SSoT inputs equals provided commitment");

// C-2: Poseidon(8) nullifier real operation
const n8 = H(ssot.nullifier.inputs.map((n) => (n === "DOMAIN_NULLIFIER_V2" ? DOMAIN : v(n))));
check(n8 === v("nullifier"), "binding:poseidon8-nullifier", "Poseidon(8) over SSoT inputs equals provided nullifier");

// C-4: witness publicSignals carry provided values at canonical positions
const witness = await genWitness(input);
const ps = witness.slice(1, 31);
let ok = true;
ssot.publicSignals.forEach((s, i) => {
  if (BigInt(ps[i]) !== v(s.name)) ok = false;
});
check(ok, "binding:publicSignals-position", "all 30 publicSignals equal provided inputs at SSoT indices");

finish("binding");
