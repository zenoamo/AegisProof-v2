#!/usr/bin/env node
// Fail-closed preflight for an externally provisioned production.zkey.
// Artifact retrieval is deliberately outside this script: the secure-storage
// backend and credential contract must be configured by repository operators.
import fs from "node:fs";
import path from "node:path";
import {
  PRODUCTION_ZKEY_HASH,
  sha256File,
} from "./lib/resolve-artifacts.mjs";

const configuredPath = process.env.AEGIS_PRODUCTION_ZKEY_PATH;

function fail(message, blocked = false) {
  console.error(`${blocked ? "BLOCKED" : "FAIL"} ${message}`);
  process.exit(1);
}

if (!configuredPath) {
  fail(
    "AEGIS_PRODUCTION_ZKEY_PATH is not set; provision production.zkey from the approved secure storage before strict verification",
    true
  );
}

if (!path.isAbsolute(configuredPath)) {
  fail("AEGIS_PRODUCTION_ZKEY_PATH must be an absolute path");
}

if (!fs.existsSync(configuredPath)) {
  fail("the externally provisioned production.zkey is missing", true);
}

const stat = fs.statSync(configuredPath);
if (!stat.isFile()) {
  fail("AEGIS_PRODUCTION_ZKEY_PATH must identify a regular file");
}

const actualHash = sha256File(configuredPath);
if (actualHash !== PRODUCTION_ZKEY_HASH) {
  fail(`production.zkey hash mismatch: expected ${PRODUCTION_ZKEY_HASH}, got ${actualHash}`);
}

console.log(`PASS externally provisioned production.zkey SHA-256 ${actualHash}`);
