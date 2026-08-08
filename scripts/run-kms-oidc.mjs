#!/usr/bin/env node
// Run KMS OIDC / Vault auth security tests (Phase 8.14 Task 4).
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testFile = path.join(ROOT, "tests", "security", "kms-oidc.test.mjs");

const result = spawnSync(process.execPath, [testFile], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, KMS_BACKEND_MODE: process.env.KMS_BACKEND_MODE ?? "stub" },
});

process.exit(result.status ?? 1);
