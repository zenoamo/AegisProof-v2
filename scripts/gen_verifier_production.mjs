// ============================================================================
// PRODUCTION verifier generator (Phase 4).
// ----------------------------------------------------------------------------
// Runs ONLY after the production trusted setup completed and the production
// VK was finalized + verified (see scripts/phase4_ceremony.mjs). Generates
// contracts/Groth16VerifierV2Production.sol from artifacts/phase4/final/
// production.zkey.
//
// Guards (abort otherwise):
//   * production zkey hash MUST match artifacts/phase4/hashes/hashes.json
//   * vkey re-exported from the zkey MUST hash-match production-vkey.json
//   * the dev zkey/vkey hashes must NOT match any production artifact
//     (dev artifacts are NEVER promoted to production)
// ============================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P4 = path.join(ROOT, "artifacts", "phase4");
const ZKEY = path.join(P4, "final", "production.zkey");
const VKEY_JSON = path.join(P4, "final", "production-vkey.json");
const HASHES = path.join(P4, "hashes", "hashes.json");
const TEMPLATE = path.join(ROOT, "node_modules/snarkjs/templates/verifier_groth16.sol.ejs");
const OUT = path.join(ROOT, "protocol", "contracts", "Groth16VerifierV2Production.sol");

const DEV = { zkey: "c80f004e9f6b26fa", vkey: "6193351af0892493" };

const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const fatal = (m) => {
  console.error(`FATAL: ${m}`);
  process.exit(1);
};

if (!fs.existsSync(ZKEY) || !fs.existsSync(VKEY_JSON) || !fs.existsSync(HASHES))
  fatal("production ceremony artifacts missing — run scripts/phase4_ceremony.mjs first (AUTHORIZATION required)");

const zkeyHash = sha256File(ZKEY);
const vkeyHash = sha256File(VKEY_JSON);

// guard 1: zkey hash must match the ceremony hash record
const record = JSON.parse(fs.readFileSync(HASHES, "utf8"));
const zkeyStep = record.steps.find((s) => s.step === "zkey:0004:beacon=FINAL");
if (!zkeyStep || zkeyStep.sha256 !== zkeyHash) fatal(`production zkey hash mismatch vs ceremony record: ${zkeyHash}`);

// guard 2: dev/prod separation
if (zkeyHash.startsWith(DEV.zkey) || vkeyHash.startsWith(DEV.vkey)) fatal("dev artifact hash detected in production path");

// guard 3: re-exported vkey must match the finalized one byte-for-byte
const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const reexported = await snarkjs.zKey.exportVerificationKey(ZKEY, silent);
const reHash = crypto.createHash("sha256").update(JSON.stringify(reexported, null, 2)).digest("hex");
if (reHash !== vkeyHash) fatal(`vkey re-export hash mismatch: ${reHash} vs ${vkeyHash}`);
if (reexported.protocol !== "groth16" || reexported.nPublic !== 30 || reexported.IC.length !== 31)
  fatal(`unexpected vkey shape: ${reexported.protocol}/${reexported.nPublic}/${reexported.IC.length}`);

const code = await snarkjs.zKey.exportSolidityVerifier(ZKEY, { groth16: fs.readFileSync(TEMPLATE, "utf8") });

const banner = [
  "// ============================================================================",
  "// PRODUCTION VERIFIER — AegisProof v2 (30 public signals).",
  "// Generated from the Phase 4 multi-contributor + beacon trusted setup.",
  `// production.zkey SHA-256: ${zkeyHash}`,
  `// production-vkey SHA-256: ${vkeyHash}`,
  "// Ceremony records: artifacts/phase4/ (transcripts, hashes, beacon record).",
  "// Pair ONLY with an AegisShieldV2 deployment intended for production use.",
  "// ============================================================================",
  "",
].join("\n");

const renamed = code.replace(/\bcontract Groth16Verifier\b/, "contract Groth16VerifierV2Production");
if (renamed === code) fatal("could not locate 'contract Groth16Verifier' declaration to rename");

const licenseEnd = renamed.indexOf("*/");
if (licenseEnd === -1) fatal("could not locate license block end in verifier template output");
const out = renamed.slice(0, licenseEnd + 2) + "\n" + banner + renamed.slice(licenseEnd + 2);

fs.writeFileSync(OUT, out, "utf8");
console.log(`verifier: ${path.relative(ROOT, OUT)} written (${fs.statSync(OUT).size} bytes)`);
console.log(`verifier: protocol=${reexported.protocol} nPublic=${reexported.nPublic} IC.length=${reexported.IC.length}`);
console.log(`verifier: production zkey hash ${zkeyHash}`);
process.exit(0); // snarkjs keeps the wasm curve alive otherwise
