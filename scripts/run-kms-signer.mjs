#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(process.execPath, [path.join(ROOT, "tests", "security", "kms-signer.test.mjs")], {
  stdio: "inherit",
  cwd: ROOT,
});
process.exit(r.status ?? 1);
