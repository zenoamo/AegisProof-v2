#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress } from "viem";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(ROOT, "deployments", "manifest.json");
const verifierSource = path.join(ROOT, "protocol", "contracts", "Groth16VerifierV2Production.sol");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const rpcUrl = process.env.MAINNET_RPC_URL;
const privateKey = process.env.MAINNET_PRIVATE_KEY;
const verifier = process.env.AEGIS_MAINNET_CANONICAL_VERIFIER;
const registry = process.env.AEGIS_MAINNET_CANONICAL_REGISTRY;
const deployer = process.env.AEGIS_MAINNET_EXPECTED_DEPLOYER;

if (!rpcUrl) fail("MAINNET_RPC_URL is required");
if (privateKey) fail("MAINNET_PRIVATE_KEY must not be used by the pre-deployment readiness check");
for (const [name, value] of [
  ["AEGIS_MAINNET_CANONICAL_VERIFIER", verifier],
  ["AEGIS_MAINNET_CANONICAL_REGISTRY", registry],
  ["AEGIS_MAINNET_EXPECTED_DEPLOYER", deployer],
]) {
  if (!value || !isAddress(value)) fail(`${name} must be a valid Ethereum address`);
}

if (!fs.existsSync(verifierSource)) fail("Production verifier source is missing");
const source = fs.readFileSync(verifierSource, "utf8");
if (!source.includes("contract Groth16VerifierV2Production")) {
  fail("Production verifier source does not contain the expected contract");
}
if (!source.includes("uint[30] calldata _pubSignals")) {
  fail("Production verifier must accept exactly 30 public signals");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entry = manifest?.chains?.["1"];
if (entry?.deployable === true || manifest?.deploymentStatus === "production") {
  fail("committed manifest must remain fail-closed before on-chain deployment evidence exists");
}

console.log("Ethereum Mainnet deployment configuration: PASS");
console.log("RPC configured: yes");
console.log("Canonical verifier address: syntactically valid");
console.log("Canonical registry address: syntactically valid");
console.log("Expected deployer address: syntactically valid");
console.log("Production verifier source: present");
console.log("Manifest: fail-closed");
console.log("No transaction was created or broadcast.");
