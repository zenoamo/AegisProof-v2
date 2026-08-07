#!/usr/bin/env node
// ============================================================================
// Generate development ML-DSA keypair (Phase 8.13 Task 5)
// Writes gitignored private key + optional committable public registry entry.
// NEVER use for production.
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_PRIVATE_KEYS_DIR,
  PQC_ALGORITHM,
  generateKeypair,
} from "./lib/pqc-signature.mjs";
import { writeRegistryPublicKey } from "./lib/public-key-registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyId = process.argv[2] ?? "dev-test-1";
const writePublic = process.argv.includes("--write-public");

const { publicKeyHex, secretKeyHex } = generateKeypair();

fs.mkdirSync(DEFAULT_PRIVATE_KEYS_DIR, { recursive: true });

const privatePath = path.join(DEFAULT_PRIVATE_KEYS_DIR, `${keyId}.key.json`);

fs.writeFileSync(
  privatePath,
  JSON.stringify(
    {
      keyId,
      publicKeyId: keyId,
      algorithm: PQC_ALGORITHM,
      secretKeyHex,
      publicKeyHex,
      purpose: "development-only — never commit",
      createdAt: new Date().toISOString(),
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Private key (gitignored): ${path.relative(ROOT, privatePath)}`);
console.log(`keyId: ${keyId}`);

if (writePublic) {
  const publicPath = writeRegistryPublicKey({
    keyId,
    publicKeyHex,
    purpose: "development registry entry",
  });
  console.log(`Public key registry:      ${path.relative(ROOT, publicPath)}`);
} else {
  console.log("Public registry not written (use --write-public to export committable key)");
}
