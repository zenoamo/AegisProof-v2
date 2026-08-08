#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suites = [
  path.join(ROOT, "tests", "security", "kms-signer.test.mjs"),
  path.join(ROOT, "tests", "security", "kms-backend-hardening.test.mjs"),
];

let failed = false;
for (const suite of suites) {
  const r = spawnSync(process.execPath, [suite], {
    stdio: "inherit",
    cwd: ROOT,
    env: { ...process.env, KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE ?? "stub" },
  });
  if ((r.status ?? 1) !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
