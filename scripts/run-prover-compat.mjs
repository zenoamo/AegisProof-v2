#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.HARDHAT_CONFIG = path.join(ROOT, "scripts", "hardhat-prover.config.ts");

const result = spawnSync(
  path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx"),
  [path.join(ROOT, "tests", "prover-compatibility.test.ts"), ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env, cwd: ROOT, shell: process.platform === "win32" }
);
process.exit(result.status ?? 1);
