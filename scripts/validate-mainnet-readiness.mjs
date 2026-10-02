#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "deployments", "manifest.json");

const MAINNET_CHAIN_ID = 1;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function validateMainnetReadiness(manifest) {
  const errors = [];
  const entry = manifest?.chains?.[String(MAINNET_CHAIN_ID)];

  if (!entry) {
    errors.push("manifest.chains[1] is required for Ethereum Mainnet readiness");
    return errors;
  }

  if (entry.environment !== "production") {
    errors.push("chain 1 environment must be production");
  }

  if (entry.deployable !== true) {
    errors.push("chain 1 deployable must be true before a production deployment can be enabled");
  }

  for (const field of ["canonicalVerifierAddress", "canonicalRegistryAddress", "productionVerifierAddress", "productionShieldAddress"]) {
    if (!ADDRESS_RE.test(entry[field] ?? "")) {
      errors.push(`chain 1: ${field} must be a valid 20-byte address`);
    }
  }

  for (const field of ["verifierBytecodeSha256", "registryBytecodeSha256"]) {
    if (!SHA256_RE.test(entry[field] ?? "")) {
      errors.push(`chain 1: ${field} must be a lowercase SHA-256 digest`);
    }
  }

  if (manifest.deploymentStatus !== "production") {
    errors.push("deploymentStatus must be production before mainnet deployment is enabled");
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const errors = validateMainnetReadiness(manifest);

  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }

  console.log("Ethereum Mainnet readiness: PASS");
  console.log("Chain ID: 1");
}
