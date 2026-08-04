// ============================================================================
// SSoT-driven code generation (#7)
// ----------------------------------------------------------------------------
// Reads specs/aegis-protocol.v2.json (the ONLY source of truth) and emits:
//   generated/AegisSignals.ts              — TypeScript constants
//   contracts/generated/AegisSignals.sol   — Solidity library constants
//     (under contracts/ so hardhat compiles it together with AegisShieldV2)
// Output is deterministic (no timestamps) so CI can verify regeneration
// produces zero diff. NEVER edit the generated files by hand.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ssot = JSON.parse(fs.readFileSync(path.join(ROOT, "specs/aegis-protocol.v2.json"), "utf8"));
const outDir = path.join(ROOT, "generated");
const solOutDir = path.join(ROOT, "contracts/generated");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(solOutDir, { recursive: true });

const upper = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
const MAX_AGE = ssot.contractPolicy.timestampWindow.MAX_AGE_seconds;
const SKEW = ssot.contractPolicy.timestampWindow.CLOCK_SKEW_seconds;
const DOMAIN = ssot.domainSeparation.domainNullifierV2;

// ---------------------------- TypeScript ------------------------------------
const tsLines = [
  "// GENERATED FILE — do not edit. Source: specs/aegis-protocol.v2.json",
  "// Regenerate: node scripts/codegen_signals.mjs",
  "",
  `export const PROTOCOL_VERSION = ${ssot.version} as const;`,
  `export const DOMAIN_NULLIFIER_V2 = ${DOMAIN}n; // NUS-derived; see SSoT domainSeparation`,
  `export const MAX_AGE_SECONDS = ${MAX_AGE} as const;`,
  `export const CLOCK_SKEW_SECONDS = ${SKEW} as const;`,
  "",
  "// Canonical public-signal indices (Groth16 publicSignals array positions)",
  "export const SIGNAL_INDEX = {",
  ...ssot.publicSignals.map((s) => `  ${s.name}: ${s.index},`),
  "} as const;",
  "",
  `export const N_PUBLIC_SIGNALS = ${ssot.publicSignals.length} as const;`,
  "",
  "export const COMMITMENT_INPUTS = [",
  ...ssot.commitment.inputs.map((n) => `  "${n}",`),
  "] as const;",
  "",
  "export const NULLIFIER_INPUTS = [",
  ...ssot.nullifier.inputs.map((n) => `  "${n}",`),
  "] as const;",
  "",
];
fs.writeFileSync(path.join(outDir, "AegisSignals.ts"), tsLines.join("\n"), "utf8");

// ---------------------------- Solidity --------------------------------------
const solLines = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.28;",
  "",
  "// GENERATED FILE — do not edit. Source: specs/aegis-protocol.v2.json",
  "// Regenerate: node scripts/codegen_signals.mjs",
  "library AegisSignals {",
  `    uint256 internal constant PROTOCOL_VERSION = ${ssot.version};`,
  `    uint256 internal constant DOMAIN_NULLIFIER_V2 = ${DOMAIN}; // NUS-derived`,
  `    uint256 internal constant MAX_AGE_SECONDS = ${MAX_AGE};`,
  `    uint256 internal constant CLOCK_SKEW_SECONDS = ${SKEW};`,
  `    uint256 internal constant N_PUBLIC_SIGNALS = ${ssot.publicSignals.length};`,
  "",
  "    // Canonical public-signal indices (pubSignals array positions)",
  ...ssot.publicSignals.map((s) => `    uint256 internal constant SIGNAL_${upper(s.name)} = ${s.index};`),
  "}",
  "",
];
fs.writeFileSync(path.join(solOutDir, "AegisSignals.sol"), solLines.join("\n"), "utf8");

console.log("codegen: generated/AegisSignals.ts written");
console.log("codegen: contracts/generated/AegisSignals.sol written");
console.log(`codegen: ${ssot.publicSignals.length} signals, protocol v${ssot.version}, MAX_AGE=${MAX_AGE}, SKEW=${SKEW}`);
