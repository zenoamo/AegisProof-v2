#!/usr/bin/env node
// Live KMS smoke: OIDC → Vault auth → sign → verify (Phase 8.14 Task 4).
// Intended for workflow_dispatch with protected environment only.
import {
  fetchGitHubOidcJwt,
  resolveVaultAuthToken,
  validateOidcClaimBindings,
  decodeJwtPayload,
  VaultAuthError,
  diagnoseOidcContext,
  reportOidcEnvPresence,
} from "./lib/kms-backends/vault-auth.mjs";
import {
  createProvenanceKmsSigner,
  signEntryWithKms,
  verifyEntryKms,
} from "./lib/kms-provenance.mjs";
import { entrySignPayload } from "./lib/pqc-signature.mjs";
import { isExplicitLiveMode } from "./lib/kms-backends/env.mjs";

function printOidcPresence() {
  const presence = reportOidcEnvPresence();
  for (const [key, state] of Object.entries(presence)) {
    console.log(`  ${key}: ${state}`);
  }
}

async function main() {
  if (!isExplicitLiveMode()) {
    console.error("FAIL KMS_BACKEND_MODE must be live for smoke test");
    process.exit(1);
  }

  console.log("OIDC context (presence only):");
  printOidcPresence();

  const diagnosis = diagnoseOidcContext();
  if (!diagnosis.ok && diagnosis.code === "LOCAL_OIDC_CONTEXT") {
    console.error(`FAIL ${diagnosis.message}`);
    console.error(`Hint: ${diagnosis.hint}`);
    process.exit(2);
  }

  const testEntry = {
    artifact: "kms-live-smoke-test",
    path: "artifacts/kms-live-smoke-test.bin",
    sha256: "b".repeat(64),
    size: 1,
    version: "smoke",
    source: "workflow_dispatch",
    present: true,
    classicalHash: { algorithm: "SHA-256", digest: "b".repeat(64) },
    pqcSignatureEnvelope: { status: "unsigned" },
  };

  console.log("Step 1: OIDC JWT acquisition");
  const jwt = await fetchGitHubOidcJwt();
  validateOidcClaimBindings(decodeJwtPayload(jwt));
  console.log("PASS OIDC JWT acquired and claim bindings validated");

  console.log("Step 2: Vault JWT login");
  const auth = await resolveVaultAuthToken();
  if (!auth.token) {
    throw new VaultAuthError("VAULT_AUTH_FAILED", "Vault token missing after login");
  }
  console.log(`PASS Vault auth (${auth.source})`);

  console.log("Step 3: local OpenSSL signer reachability");
  const signerUrl = (process.env.LOCAL_OPENSSL_SIGNER_URL ?? "").trim();
  if (!signerUrl) {
    console.error("FAIL LOCAL_OPENSSL_SIGNER_URL is required");
    process.exit(1);
  }
  let healthUrl;
  try {
    healthUrl = new URL("/healthz", signerUrl).toString();
  } catch {
    console.error("FAIL LOCAL_OPENSSL_SIGNER_URL is invalid");
    process.exit(1);
  }
  try {
    const health = await fetch(healthUrl, { method: "GET" });
    if (!health.ok) {
      console.error(`FAIL local signer healthz HTTP ${health.status}`);
      process.exit(1);
    }
    const body = await health.json();
    if (body?.backend !== "local-openssl" || body?.algorithm !== "ML-DSA-87") {
      console.error("FAIL local signer healthz identity mismatch");
      process.exit(1);
    }
    console.log("PASS local OpenSSL signer reachable");
  } catch (err) {
    console.error("FAIL local OpenSSL signer unreachable");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log("Step 4: KMS sign + verify");
  console.log("  backend: local-openssl");
  console.log("  algorithm: ML-DSA-87");
  console.log("  keyId: " + (process.env.LOCAL_OPENSSL_KEY_ID ?? "aegis-ci-mldsa87-v1"));
  const signer = createProvenanceKmsSigner();
  const signed = await signEntryWithKms(testEntry, signer);
  const verify = await verifyEntryKms(signed, signer);
  if (!verify.ok) {
    console.error(`FAIL verify: ${verify.error}`);
    process.exit(1);
  }

  const payload = entrySignPayload(testEntry);
  console.log(`PASS KMS live smoke — signed artifact=${payload.artifact}`);
}

main().catch((err) => {
  if (err instanceof VaultAuthError && err.code === "LOCAL_OIDC_CONTEXT") {
    console.error(`FAIL ${err.message}`);
    process.exit(2);
  }
  console.error(`FAIL ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
