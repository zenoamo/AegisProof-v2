// Shared library for the standalone Phase 3 CI gates (#1,2,3,5,6).
// Each gate is self-contained, prints "[GATE <name>] PASS/FAIL — detail"
// lines, and exits 1 on any failure (never treated as success).

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { buildPoseidon } = require("circomlibjs");

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export const P2 = path.join(ROOT, "artifacts", "phase2");
export const R = (p) => path.join(ROOT, p);

/*
 * Canonical SSoT:
 *
 *   protocol/specs
 *
 * The former:
 *
 *   specs/aegis-protocol.v2.json
 *
 * is intentionally NOT supported. The repository security invariant
 * SEM-BIND-002 requires exactly one canonical SSoT.
 */
const SSOT_DIR = path.join(ROOT, "protocol", "specs");

/**
 * Resolve the canonical protocol SSoT.
 *
 * The current repository uses protocol/specs as the single source of truth.
 * Fail explicitly if it is missing rather than silently falling back to a
 * competing legacy copy.
 */
function resolveSsot() {
  if (!fs.existsSync(SSOT_DIR)) {
    throw new Error(
      `Canonical SSoT directory is missing: ${SSOT_DIR}`
    );
  }

  const candidates = fs
    .readdirSync(SSOT_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  if (candidates.length === 0) {
    throw new Error(
      `No canonical SSoT JSON found in: ${SSOT_DIR}`
    );
  }

  if (candidates.length > 1) {
    throw new Error(
      [
        "Multiple SSoT JSON files found.",
        "The repository requires exactly one canonical protocol SSoT.",
        `Directory: ${SSOT_DIR}`,
        `Candidates: ${candidates.join(", ")}`,
      ].join("\n")
    );
  }

  return path.join(SSOT_DIR, candidates[0]);
}

export const PATHS = {
  ssot: resolveSsot(),

  r1cs: path.join(
    P2,
    "r1cs",
    "aegis_commit_core_v2.r1cs"
  ),

  sym: path.join(
    P2,
    "r1cs",
    "aegis_commit_core_v2.sym"
  ),

  wasm: path.join(
    P2,
    "r1cs",
    "aegis_commit_core_v2_js",
    "aegis_commit_core_v2.wasm"
  ),

  witCalc: path.join(
    P2,
    "r1cs",
    "aegis_commit_core_v2_js",
    "witness_calculator.js"
  ),

  input: path.join(
    P2,
    "tests",
    "input_v2.json"
  ),

  zkey: path.join(
    P2,
    "setup",
    "aegis_v2_0000.zkey"
  ),

  vkey: path.join(
    P2,
    "vkey",
    "vkey_v2.json"
  ),

  proof: path.join(
    P2,
    "proofs",
    "proof_v2_baseline.json"
  ),

  cacheDir: path.join(
    P2,
    "cache"
  ),
};

export function loadSsot() {
  return JSON.parse(
    fs.readFileSync(PATHS.ssot, "utf8")
  );
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
  BigInt(
    poseidon.F
      .toObject(poseidon(arr))
      .toString()
  );

export const utf8BE = (s) => {
  let e = 0n;

  for (const b of Buffer.from(s, "utf8")) {
    e = (e << 8n) | BigInt(b);
  }

  return e;
};

// --- witness ---------------------------------------------------------------

let wcFactory = null;

export async function getCalculator() {
  if (wcFactory) {
    return wcFactory;
  }

  fs.mkdirSync(PATHS.cacheDir, {
    recursive: true,
  });

  const cjsPath = path.join(
    PATHS.cacheDir,
    "witness_calculator.cjs"
  );

  fs.copyFileSync(
    PATHS.witCalc,
    cjsPath
  );

  wcFactory = await require(cjsPath)(
    fs.readFileSync(PATHS.wasm)
  );

  return wcFactory;
}

export async function genWitness(inputObj) {
  const wc = await getCalculator();

  return wc.calculateWitness(
    inputObj,
    1
  );
}

// --- gate result helpers ----------------------------------------------------

const results = [];

export function check(ok, name, detail) {
  results.push({
    ok,
    name,
    detail,
  });

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${
      detail ? " — " + detail : ""
    }`
  );
}

export function finish(gateName) {
  const failed = results.filter(
    (r) => !r.ok
  );

  console.log(
    `[GATE ${gateName}] ${
      failed.length === 0 ? "PASS" : "FAIL"
    } — ${
      results.length - failed.length
    }/${results.length} checks`
  );

  process.exit(
    failed.length === 0 ? 0 : 1
  );
}
