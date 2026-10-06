// Canonical v2 proving path rejects a 29-signal legacy circuit.
// Does not modify Frozen Core artifacts and does not generate a proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY_R1CS = path.join(ROOT, "circuits/aegis_commit_core.r1cs");
const LEGACY_CIRCOM = path.join(ROOT, "protocol/circuits/aegis_commit_core.circom");

const { resolveArtifacts } = await import("../scripts/lib/resolve-artifacts.mjs");
const { EXPECTED_PUBLIC_SIGNALS, proveCanonical } = await import("../scripts/lib/provers.mjs");
const {
  CANONICAL_V2_PUBLIC_SIGNALS,
  CanonicalV2ArtifactError,
  assertCanonicalV2ProvingArtifacts,
  readR1csPublicSignalCount,
} = await import("../scripts/lib/canonical-v2-guard.mjs");

let passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

const canonical = resolveArtifacts();
const accepted = assertCanonicalV2ProvingArtifacts({
  r1cs: canonical.r1cs,
  vkey: canonical.vkey,
});
ok(accepted.nPublic === 30, "Test A: canonical 30-signal R1CS and vkey are accepted");
ok(accepted.r1csNPublic === 30 && accepted.vkeyNPublic === 30, "Test A: artifact and vkey counts are both 30");
ok(accepted.icLength === 31, "Test A: verification key IC length is 31");
ok(EXPECTED_PUBLIC_SIGNALS === CANONICAL_V2_PUBLIC_SIGNALS, "Test A: proveCanonical still expects 30 signals");

const legacyCount = readR1csPublicSignalCount(LEGACY_R1CS);
ok(legacyCount.nPublic === 29, "legacy R1CS remains readable as 29 signals outside the canonical assert");
ok(legacyCount.nPubOut === 5 && legacyCount.nPubIn === 24, "legacy R1CS keeps 5 outputs and 24 public inputs");
ok(fs.readFileSync(LEGACY_CIRCOM, "utf8").includes("signal output nullifier"), "legacy circom source is still present");

let rejected = null;
try {
  assertCanonicalV2ProvingArtifacts({
    r1cs: LEGACY_R1CS,
    vkey: canonical.vkey,
  });
} catch (error) {
  rejected = error;
}
ok(rejected instanceof CanonicalV2ArtifactError, "Test B: 29-signal R1CS is rejected against the 30-signal vkey");
ok(
  /canonical v2 requires 30 public signals/.test(rejected?.message ?? "") && /nPublic=29/.test(rejected?.message ?? ""),
  "Test B: rejection names the 29-signal artifact mismatch"
);

const missingWasm = path.join(os.tmpdir(), "aegis-canonical-guard-not-created.wasm");
fs.rmSync(missingWasm, { force: true });
let proveError = null;
try {
  await proveCanonical(
    {},
    {
      paths: {
        ...canonical,
        r1cs: LEGACY_R1CS,
        wasm: missingWasm,
        zkey: path.join(os.tmpdir(), "aegis-canonical-guard-not-created.zkey"),
      },
      verify: false,
    }
  );
} catch (error) {
  proveError = error;
}
ok(proveError instanceof CanonicalV2ArtifactError, "Test B: proveCanonical rejects before proof generation");
ok(!fs.existsSync(missingWasm), "Test B: witness and proof files are not created");

const padded = Array.from({ length: 30 }, () => "1");
let padError = null;
try {
  assertCanonicalV2ProvingArtifacts({
    r1cs: LEGACY_R1CS,
    vkey: canonical.vkey,
    publicSignals: padded,
  });
} catch (error) {
  padError = error;
}
ok(padError instanceof CanonicalV2ArtifactError, "Test C: padded 30-element array is rejected");
ok(/padded publicSignals\[30\]/.test(padError?.message ?? ""), "Test C: rejection says padding is not canonical");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-canonical-guard-"));
const missingR1cs = path.join(tmp, "missing.r1cs");
let missingError = null;
try {
  assertCanonicalV2ProvingArtifacts({ r1cs: missingR1cs, vkey: canonical.vkey });
} catch (error) {
  missingError = error;
}
ok(missingError instanceof CanonicalV2ArtifactError, "Test D: missing R1CS is rejected");
ok(/cannot confirm public signal count/.test(missingError?.message ?? ""), "Test D: missing metadata is not assumed to be 30");

const opaqueVkey = path.join(tmp, "no-npublic.json");
fs.writeFileSync(opaqueVkey, '{"protocol":"groth16"}\n');
let opaqueError = null;
try {
  assertCanonicalV2ProvingArtifacts({ r1cs: canonical.r1cs, vkey: opaqueVkey });
} catch (error) {
  opaqueError = error;
}
ok(opaqueError instanceof CanonicalV2ArtifactError, "Test D: vkey without nPublic is rejected");
ok(/cannot confirm verification key public signal count/.test(opaqueError?.message ?? ""), "Test D: absent vkey count is fail closed");

const truncated = path.join(tmp, "truncated.r1cs");
fs.writeFileSync(truncated, Buffer.from("r1cs"));
let truncatedError = null;
try {
  assertCanonicalV2ProvingArtifacts({ r1cs: truncated, vkey: canonical.vkey });
} catch (error) {
  truncatedError = error;
}
ok(truncatedError instanceof CanonicalV2ArtifactError, "Test D: unreadable R1CS header is rejected");
ok(/cannot confirm public signal count/.test(truncatedError?.message ?? ""), "Test D: unreadable header is not treated as 30");

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nCANONICAL V2 SIGNAL GUARD: ${passed} checks PASS`);
