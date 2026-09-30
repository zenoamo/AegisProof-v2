// Shared library for the standalone Phase 3 CI gates (#1,2,3,5,6).

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { buildPoseidon } = require("circomlibjs");

import {
  resolveArtifacts,
  ROOT,
} from "../lib/resolve-artifacts.mjs";

export { ROOT };

export const P2 = path.join(ROOT, "artifacts", "phase2");
export const R = (p) => path.join(ROOT, p);

// Canonical protocol SSoT.
// This is a FILE, not a directory.
export const PATHS = {
  ssot: R("protocol/specs"),

  // Resolve phase-2 artifacts through the canonical resolver.
  ...resolveArtifacts({ profile: "phase2" }),

  // Gate-specific baseline proof.
  proof: path.join(
    ROOT,
    "artifacts",
    "phase2",
    "proofs",
    "proof_v2_baseline.json"
  ),
};

// Fail early with useful diagnostics instead of raw ENOENT errors.
export function assertGateArtifacts() {
  const required = [
    ["r1cs", PATHS.r1cs],
    ["sym", PATHS.sym],
    ["wasm", PATHS.wasm],
    ["witCalc", PATHS.witCalc],
    ["input", PATHS.input],
    ["vkey", PATHS.vkey],
  ];

  const missing = required.filter(([, p]) => !fs.existsSync(p));

  if (missing.length > 0) {
    throw new Error(
      [
        "Missing required Phase-2 gate artifacts:",
        ...missing.map(
          ([name, p]) =>
            `  ${name}: ${path.relative(ROOT, p)}`
        ),
        "",
        "Artifact resolution:",
        `  r1cs source: ${PATHS.sources?.r1cs ?? "unknown"}`,
        `  sym source: ${PATHS.sources?.sym ?? "unknown"}`,
        `  input source: ${PATHS.sources?.input ?? "unknown"}`,
        `  vkey source: ${PATHS.sources?.vkey ?? "unknown"}`,
      ].join("\n")
    );
  }
}

export function resolveSsot() {
  if (!fs.existsSync(PATHS.ssot)) {
    throw new Error(
      `Canonical SSoT missing: ${path.relative(ROOT, PATHS.ssot)}`
    );
  }

  const stat = fs.statSync(PATHS.ssot);

  if (!stat.isFile()) {
    throw new Error(
      `Canonical SSoT must be a file: ${path.relative(ROOT, PATHS.ssot)}`
    );
  }

  return PATHS.ssot;
}

export function loadSsot() {
  const ssotPath = resolveSsot();

  try {
    return JSON.parse(fs.readFileSync(ssotPath, "utf8"));
  } catch (err) {
    throw new Error(
      `Failed to parse canonical SSoT ${path.relative(ROOT, ssotPath)}: ${err.message}`
    );
  }
}

// --- Poseidon ---------------------------------------------------------------

let poseidon = null;

export async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

export const H = (arr) =>
  BigInt(poseidon.F.toObject(poseidon(arr)).toString());

export const utf8BE = (s) => {
  let e = 0n;

  for (const b of Buffer.from(s, "utf8")) {
    e = (e << 8n) | BigInt(b);
  }

  return e;
};

// --- witness ----------------------------------------------------------------

let wcFactory = null;

export async function getCalculator() {
  if (wcFactory) return wcFactory;

  fs.mkdirSync(PATHS.cacheDir, { recursive: true });

  const cjsPath = path.join(
    PATHS.cacheDir,
    "witness_calculator.cjs"
  );

  fs.copyFileSync(PATHS.witCalc, cjsPath);

  wcFactory = await require(cjsPath)(
    fs.readFileSync(PATHS.wasm)
  );

  return wcFactory;
}

export async function genWitness(inputObj) {
  const wc = await getCalculator();

  // sanityCheck=1: assert every R1CS constraint.
  return wc.calculateWitness(inputObj, 1);
}

// --- gate result helpers -----------------------------------------------------

const results = [];

export function check(ok, name, detail) {
  results.push({ ok, name, detail });

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${
      detail ? " — " + detail : ""
    }`
  );
}

export function finish(gateName) {
  const failed = results.filter((r) => !r.ok);

  console.log(
    `[GATE ${gateName}] ${
      failed.length === 0 ? "PASS" : "FAIL"
    } — ${results.length - failed.length}/${results.length} checks`
  );

  process.exit(failed.length === 0 ? 0 : 1);
}
