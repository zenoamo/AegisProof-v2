// GATE: Domain separation (#5).
// Verifies the nullifier domain is NUS-derived exactly per the SSoT encoding
// rule, is not hand-picked, and that timestamp remains excluded from both
// hashes (approved timestamp policy).
import { loadSsot, initPoseidon, H, utf8BE, check, finish } from "./gate_lib.mjs";

const ssot = loadSsot();
await initPoseidon();

const label = ssot.domainSeparation.domainNullifierV2Label;
const labelBytes = Buffer.from(label, "utf8");
check(labelBytes.length <= 31, "domain:label-fits-field", `label="${label}" (${labelBytes.length} bytes <= 31)`);

// exact SSoT encoding rule: utf8 -> BE integer -> Poseidon([fieldElement])
const derived = H([utf8BE(label)]);
check(derived.toString() === ssot.domainSeparation.domainNullifierV2, "domain:nus-derivation", "Poseidon([utf8BE(label)]) matches SSoT value");

// anti-hand-pick heuristic: a hand-picked constant would be small/round;
// a real Poseidon output is ~254-bit uniform.
const d = BigInt(ssot.domainSeparation.domainNullifierV2);
check(d.toString(2).length >= 250, "domain:not-hand-picked", `domain bit-length=${d.toString(2).length}`);

// v1 hand-picked domain must not reappear anywhere in the protocol spec
check(!JSON.stringify(ssot).includes("548923749238475923"), "domain:no-v1-literal", "v1 domain separator absent from SSoT");

// timestamp policy: excluded from commitment and nullifier inputs
check(!ssot.commitment.inputs.includes("timestamp"), "domain:timestamp-not-in-commitment", "commitment inputs exclude timestamp");
check(!ssot.nullifier.inputs.includes("timestamp"), "domain:timestamp-not-in-nullifier", "nullifier inputs exclude timestamp");

// structural specs from authorization
check(ssot.commitment.inputs.length === 6, "domain:poseidon6-spec", "commitment = Poseidon(6)");
check(ssot.nullifier.inputs.length === 8, "domain:poseidon8-spec", "nullifier = Poseidon(8)");
check(ssot.nullifier.inputs[0] === "DOMAIN_NULLIFIER_V2", "domain:domain-first-input", "domain is nullifier input[0]");
check(ssot.nullifier.inputs.includes("chainId"), "domain:chainId-in-nullifier", "chainId bound via nullifier (Option X)");
check(ssot.nullifier.inputs.includes("sessionId"), "domain:sessionId-in-nullifier", "sessionId bound via nullifier (Option A)");

finish("domain");
