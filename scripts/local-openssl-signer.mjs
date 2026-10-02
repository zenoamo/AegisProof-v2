#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const PORT = Number(process.env.LOCAL_OPENSSL_SIGNER_PORT ?? 8787);
const VAULT_ADDR = (process.env.VAULT_ADDR ?? "").trim().replace(/\/$/, "");
const KEY_ID = (process.env.LOCAL_OPENSSL_KEY_ID ?? "aegis-ci-mldsa87-v1").trim();
const REQUIRED_VAULT_POLICY = (process.env.LOCAL_OPENSSL_REQUIRED_VAULT_POLICY ?? "ci-provenance-signer").trim();
if (!REQUIRED_VAULT_POLICY) throw new Error("LOCAL_OPENSSL_REQUIRED_VAULT_POLICY must not be empty");
const PRIVATE_KEY = (process.env.LOCAL_OPENSSL_PRIVATE_KEY_PATH ?? "").trim();
const OPENSSL = process.env.OPENSSL_BIN?.trim() || "/opt/openssl-3.5/bin/openssl";
if (!VAULT_ADDR || !PRIVATE_KEY) throw new Error("VAULT_ADDR and LOCAL_OPENSSL_PRIVATE_KEY_PATH are required");
if (!fs.existsSync(PRIVATE_KEY)) throw new Error("private key not found: " + PRIVATE_KEY);
if (!fs.existsSync(OPENSSL)) throw new Error("OpenSSL binary not found: " + OPENSSL);
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-local-openssl-"));
const publicKeyPath = path.join(workDir, "public.pem");
execFileSync(OPENSSL, ["pkey", "-in", PRIVATE_KEY, "-pubout", "-out", publicKeyPath], { env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || "/opt/openssl-3.5/lib64" }, stdio: "ignore" });
function json(res, status, body) { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
async function vaultTokenIsAuthorized(token) {
  if (!token) {
    console.error("Vault authorization rejected: bearer token missing");
    return false;
  }
  const res = await fetch(VAULT_ADDR + "/v1/auth/token/lookup-self", { method: "GET", headers: { "X-Vault-Token": token } });
  if (!res.ok) {
    console.error("Vault token lookup rejected: HTTP " + res.status);
    return false;
  }
  const body = await res.json();
  const policies = new Set([
    ...(Array.isArray(body?.data?.policies) ? body.data.policies : []),
    ...(Array.isArray(body?.data?.token_policies) ? body.data.token_policies : []),
  ]);
  if (!policies.has(REQUIRED_VAULT_POLICY)) {
    console.error("Vault token missing required policy: " + REQUIRED_VAULT_POLICY);
    return false;
  }
  return true;
}
function readBody(req) {
  return new Promise((resolve, reject) => { let raw = ""; req.on("data", c => { raw += c; }); req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("invalid JSON")); } }); req.on("error", reject); });
}
function runPkeyUtl(args) { return execFileSync(OPENSSL, ["pkeyutl", ...args], { env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || "/opt/openssl-3.5/lib64" }, stdio: "pipe" }); }
function sign(message) {
  const dir = fs.mkdtempSync(path.join(workDir, "op-"));
  try { const msg=path.join(dir,"message.bin"), sig=path.join(dir,"signature.bin"); fs.writeFileSync(msg,message); runPkeyUtl(["-sign","-inkey",PRIVATE_KEY,"-rawin","-in",msg,"-out",sig]); return fs.readFileSync(sig).toString("base64"); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
function verify(message, signatureB64) {
  const dir = fs.mkdtempSync(path.join(workDir, "op-"));
  try { const msg=path.join(dir,"message.bin"), sig=path.join(dir,"signature.bin"); fs.writeFileSync(msg,message); fs.writeFileSync(sig,Buffer.from(signatureB64,"base64")); try { runPkeyUtl(["-verify","-pubin","-inkey",publicKeyPath,"-rawin","-in",msg,"-sigfile",sig]); return true; } catch { return false; } }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
const server=http.createServer(async (req,res)=>{
  try {
    if(req.method==="GET"&&req.url==="/healthz") return json(res,200,{ok:true,backend:"local-openssl",algorithm:"ML-DSA-87"});
    if(req.method!=="POST"||!["/sign","/verify"].includes(req.url)) return json(res,404,{error:"not found"});
    const auth=req.headers.authorization??""; const token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
    if(!(await vaultTokenIsAuthorized(token))) return json(res,403,{error:"Vault authorization rejected"});
    const body=await readBody(req);
    if(body.keyId!==KEY_ID||body.algorithm!=="ML-DSA-87") return json(res,400,{error:"keyId/algorithm mismatch"});
    const message=Buffer.from(body.message??"","base64"); if(message.length===0) return json(res,400,{error:"message missing"});
    if(req.url==="/sign") return json(res,200,{signature:sign(message),encoding:"base64",algorithm:"ML-DSA-87",keyId:KEY_ID});
    if(typeof body.signature!=="string") return json(res,400,{error:"signature missing"});
    return json(res,200,{valid:verify(message,body.signature),algorithm:"ML-DSA-87",keyId:KEY_ID});
  } catch(err) { console.error("local-openssl signer error: "+(err instanceof Error?err.message:String(err))); return json(res,500,{error:"signer internal error"}); }
});
server.listen(PORT,"127.0.0.1",()=>console.log("local-openssl signer listening on 127.0.0.1:"+PORT));
process.on("SIGINT",()=>{server.close();fs.rmSync(workDir,{recursive:true,force:true});});
process.on("SIGTERM",()=>{server.close();fs.rmSync(workDir,{recursive:true,force:true});});