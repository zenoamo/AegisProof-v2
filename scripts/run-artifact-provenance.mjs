#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  process.execPath,
  [path.join(ROOT, "tests", "artifact-provenance.test.mjs"), ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env, cwd: ROOT }
);
process.exit(result.status ?? 1);
