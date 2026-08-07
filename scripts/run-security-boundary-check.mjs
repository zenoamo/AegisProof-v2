#!/usr/bin/env node
// ============================================================================
// Combined security boundary gate for CI
// 1. Sensitive file scan
// 2. Artifact provenance verification (hash required)
// ============================================================================
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, scriptRel, extraArgs = []) {
  console.log(`\n=== ${label} ===`);
  const script = path.join(ROOT, scriptRel);
  const r = spawnSync(process.execPath, [script, ...extraArgs], { stdio: "inherit", cwd: ROOT });
  if (r.status !== 0) {
    console.error(`\nFAIL ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`PASS ${label}`);
}

run("Sensitive file boundary", "scripts/check-sensitive-files.mjs");
run("Artifact provenance (live)", "scripts/verify-provenance-manifest.mjs", ["--live"]);

console.log("\nPASS security boundary check (sensitive files + provenance)");
