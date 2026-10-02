#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST_PATH = path.join(ROOT, "deployments", "manifest.json");

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function validateManifest(manifest) {
  const errors = [];

  if (manifest?.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (manifest?.protocol !== "AegisProof") {
    errors.push("protocol must be AegisProof");
  }
  if (!["not-deployed", "testnet", "production"].includes(manifest?.deploymentStatus)) {
    errors.push("deploymentStatus must be not-deployed, testnet, or production");
  }

  const chains = manifest?.chains;
  if (!chains || typeof chains !== "object" || Array.isArray(chains)) {
    errors.push("chains must be an object");
    return errors;
  }

  for (const [chainId, entry] of Object.entries(chains)) {
    if (!/^[0-9]+$/.test(chainId)) {
      errors.push(`invalid chain ID key: ${chainId}`);
      continue;
    }
    if (!entry || typeof entry !== "object") {
      errors.push(`chain ${chainId}: entry must be an object`);
      continue;
    }
    if (!ADDRESS_RE.test(entry.canonicalVerifierAddress ?? "")) {
      errors.push(`chain ${chainId}: canonicalVerifierAddress must be a 20-byte address`);
    }
    if (!ADDRESS_RE.test(entry.canonicalRegistryAddress ?? "")) {
      errors.push(`chain ${chainId}: canonicalRegistryAddress must be a 20-byte address`);
    }

    for (const field of ["productionVerifierAddress", "productionShieldAddress"]) {
      const value = entry[field];
      if (value !== null && !ADDRESS_RE.test(value ?? "")) {
        errors.push(`chain ${chainId}: ${field} must be null or a 20-byte address`);
      }
    }

    for (const field of ["verifierBytecodeSha256", "registryBytecodeSha256"]) {
      const value = entry[field];
      if (value !== null && !SHA256_RE.test(value ?? "")) {
        errors.push(`chain ${chainId}: ${field} must be null or a lowercase SHA-256 digest`);
      }
    }

    if (entry.deployable === true) {
      if (!entry.productionVerifierAddress) {
        errors.push(`chain ${chainId}: deployable entry requires productionVerifierAddress`);
      }
      if (!entry.productionShieldAddress) {
        errors.push(`chain ${chainId}: deployable entry requires productionShieldAddress`);
      }
      if (!entry.verifierBytecodeSha256) {
        errors.push(`chain ${chainId}: deployable entry requires verifierBytecodeSha256`);
      }
      if (!entry.registryBytecodeSha256) {
        errors.push(`chain ${chainId}: deployable entry requires registryBytecodeSha256`);
      }
    }
  }

  if (manifest.deploymentStatus === "production") {
    const productionChains = Object.values(chains).filter((entry) => entry?.deployable === true);
    if (productionChains.length === 0) {
      errors.push("production deploymentStatus requires at least one deployable chain");
    }
  }

  return errors;
}

export function validateCanonicalRegistrySource(manifest, source) {
  const errors = [];
  const match = source.match(/HARDHAT_CHAIN_ID = (\d+);[\s\S]*?HARDHAT_VERIFIER =\s*([0-9a-fx]+);[\s\S]*?HARDHAT_REGISTRY =\s*([0-9a-fx]+);/);
  if (!match) {
    return ["could not read Hardhat canonical registry constants"];
  }

  const chainId = match[1];
  const verifierAddress = match[2];
  const address = match[3];
  const entry = manifest.chains?.[chainId];
  if (!entry) {
    errors.push(`manifest is missing canonical registry entry for chain ${chainId}`);
  } else {
    if (entry.canonicalVerifierAddress.toLowerCase() !== verifierAddress.toLowerCase()) {
      errors.push(`chain ${chainId}: manifest verifier does not match AegisCanonicalRegistry.sol`);
    }
    if (entry.canonicalRegistryAddress.toLowerCase() !== address.toLowerCase()) {
      errors.push(`chain ${chainId}: manifest registry does not match AegisCanonicalRegistry.sol`);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const source = fs.readFileSync(
    path.join(ROOT, "protocol", "contracts", "AegisCanonicalRegistry.sol"),
    "utf8",
  );

  const errors = [
    ...validateManifest(manifest),
    ...validateCanonicalRegistrySource(manifest, source),
  ];

  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }

  console.log("Deployment manifest integrity: PASS");
  console.log(`Chains: ${Object.keys(manifest.chains).join(", ")}`);
}
