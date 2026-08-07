#!/usr/bin/env node
// ============================================================================
// Export committable public key registry entry (Phase 8.13 Task 5)
// Usage: node scripts/export-pqc-public-key.mjs [keyId]
// Reads gitignored private key file and writes/updates public registry entry.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { DEFAULT_PRIVATE_KEYS_DIR, bytesToHex, hexToBytes } from "./lib/pqc-signature.mjs";
import { writeRegistryPublicKey, loadRegistryPublicKey } from "./lib/public-key-registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyId = process.argv[2] ?? "aegis-ci-mldsa87-v1";
const privatePath = path.join(DEFAULT_PRIVATE_KEYS_DIR, `${keyId}.key.json`);

if (!fs.existsSync(privatePath)) {
  console.error(`FAIL private key not found: ${path.relative(ROOT, privatePath)}`);
  console.error("Run: npm run generate:pqc-dev-keys -- aegis-ci-mldsa87-v1");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(privatePath, "utf8"));
const secretKey = hexToBytes(raw.secretKeyHex);
const publicKeyHex = raw.publicKeyHex ?? bytesToHex(ml_dsa87.getPublicKey(secretKey));

const out = writeRegistryPublicKey({
  keyId,
  publicKeyHex,
  purpose: raw.purpose ?? "CI verification registry — public key only",
});

console.log(`Public key registry written: ${path.relative(ROOT, out)}`);
console.log(`keyId: ${keyId}`);
const existing = loadRegistryPublicKey(keyId);
console.log(`algorithm: ${existing?.algorithm} version: ${existing?.version}`);
