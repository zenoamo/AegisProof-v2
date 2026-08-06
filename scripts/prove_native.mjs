#!/usr/bin/env node
// Windows/cross-platform rapidsnark wrapper (same semantics as prove_native.sh)
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.AEGIS_PROVER = "rapidsnark";

const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "prove.js"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
