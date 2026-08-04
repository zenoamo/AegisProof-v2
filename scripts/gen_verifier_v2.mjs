// ============================================================================
// Dev verifier generator (Phase 3, #4).
// ----------------------------------------------------------------------------
// Generates contracts/Groth16VerifierV2.sol from the DEV zkey via the snarkjs
// library API (the npx CLI form misbehaves under PowerShell). The DEV zkey is
// a single-contribution development setup ONLY; the production verifier is a
// Phase 4 deliverable generated from the production trusted setup.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZKEY = path.join(ROOT, "artifacts/phase2/setup/aegis_v2_0000.zkey");
const TEMPLATE = path.join(ROOT, "node_modules/snarkjs/templates/verifier_groth16.sol.ejs");
const OUT = path.join(ROOT, "contracts/Groth16VerifierV2.sol");

if (!fs.existsSync(ZKEY)) {
  console.error(`FATAL: dev zkey missing: ${ZKEY}`);
  process.exit(1);
}

const templates = {
  groth16: fs.readFileSync(TEMPLATE, "utf8"),
};

const code = await snarkjs.zKey.exportSolidityVerifier(ZKEY, templates);

const banner = [
  "// ============================================================================" ,
  "// DEVELOPMENT VERIFIER ONLY — generated from a single-contribution dev zkey.",
  "// NEVER deploy against real value. Production verifier is a Phase 4 output",
  "// derived from the production multi-contributor + beacon trusted setup.",
  "// Source zkey: artifacts/phase2/setup/aegis_v2_0000.zkey (hash-pinned in",
  "// specs/artifact-manifest.json). nPublic = 30 (AegisProof v2).",
  "// ============================================================================",
  "",
].join("\n");

// Rename the contract so it can coexist with the v1 verifier in the same tree.
const renamed = code.replace(/\bcontract Groth16Verifier\b/, "contract Groth16VerifierV2");
if (renamed === code) {
  console.error("FATAL: could not locate 'contract Groth16Verifier' declaration to rename");
  process.exit(1);
}

// Insert the dev-only banner after the upstream license block.
const licenseEnd = renamed.indexOf("*/");
if (licenseEnd === -1) {
  console.error("FATAL: could not locate license block end in verifier template output");
  process.exit(1);
}
const out = renamed.slice(0, licenseEnd + 2) + "\n" + banner + renamed.slice(licenseEnd + 2);

fs.writeFileSync(OUT, out, "utf8");

const vk = await snarkjs.zKey.exportVerificationKey(ZKEY);
console.log(`verifier: ${path.relative(ROOT, OUT)} written (${fs.statSync(OUT).size} bytes)`);
console.log(`verifier: protocol=${vk.protocol} nPublic=${vk.nPublic} IC.length=${vk.IC.length}`);
process.exit(0); // snarkjs keeps the wasm curve alive otherwise
