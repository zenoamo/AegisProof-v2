import { kmsFetch, redactKmsSecrets } from "./http-fetch.mjs";
import { resolveVaultAuthToken } from "./vault-auth.mjs";
export class LocalOpenSslError extends Error {
  constructor(code, message) { super(redactKmsSecrets(message)); this.name = "LocalOpenSslError"; this.code = code; }
}
export function isLocalOpenSslConfigured() { return Boolean(process.env.LOCAL_OPENSSL_SIGNER_URL?.trim()); }
function signerUrl(path) {
  const base = process.env.LOCAL_OPENSSL_SIGNER_URL?.trim();
  if (!base) throw new LocalOpenSslError("LOCAL_OPENSSL_NOT_CONFIGURED", "LOCAL_OPENSSL_SIGNER_URL is required");
  return new URL(path, base.endsWith("/") ? base : base + "/").toString();
}
function expectedKeyId() { return process.env.LOCAL_OPENSSL_KEY_ID?.trim() || "aegis-ci-mldsa87-v1"; }
async function request(path, body) {
  const auth = await resolveVaultAuthToken();
  if (!auth?.token) throw new LocalOpenSslError("VAULT_AUTH_FAILED", "Vault token missing for local signer authorization");
  let res;
  try { res = await kmsFetch(signerUrl(path), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + auth.token }, body: JSON.stringify(body) }); }
  catch (err) { throw new LocalOpenSslError("LOCAL_OPENSSL_UNAVAILABLE", err instanceof Error ? err.message : String(err)); }
  const text = await res.text(); let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new LocalOpenSslError("LOCAL_OPENSSL_ERROR", data.error ?? data.message ?? "HTTP " + res.status);
  return data;
}
export async function localOpenSslSign({ message, keyId }) {
  const id = keyId ?? expectedKeyId();
  if (id !== expectedKeyId()) throw new LocalOpenSslError("KEY_ID_MISMATCH", "unexpected keyId: " + id);
  const data = await request("/sign", { keyId: id, message: Buffer.from(message).toString("base64"), algorithm: "ML-DSA-87" });
  if (typeof data.signature !== "string" || !data.signature) throw new LocalOpenSslError("BAD_RESPONSE", "local signer response missing signature");
  return { signature: data.signature, encoding: "base64", backend: "local-openssl", live: true };
}
export async function localOpenSslVerify({ message, signature, keyId }) {
  const id = keyId ?? expectedKeyId();
  if (id !== expectedKeyId()) return { ok: false, error: "unexpected keyId: " + id };
  try { const data = await request("/verify", { keyId: id, message: Buffer.from(message).toString("base64"), signature, algorithm: "ML-DSA-87" }); return data.valid ? { ok: true } : { ok: false, error: "local OpenSSL verify rejected signature" }; }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
}