// ============================================================================
// On-chain verification of the PHASE 4 PRODUCTION verifier.
// ----------------------------------------------------------------------------
// Run: npx hardhat run test/Groth16VerifierV2Production.ts
// Pre-requisites (enforced by the scripts that produce the inputs):
//   * artifacts/phase4/ ceremony completed (scripts/phase4_ceremony.mjs)
//   * contracts/Groth16VerifierV2Production.sol generated from the production
//     zkey (scripts/gen_verifier_production.mjs)
//   * artifacts/phase4/reports/production_proof_baseline.json produced by
//     scripts/phase4_verify_production.mjs (proof from the PRODUCTION zkey)
// Checks:
//   1. production verifier deploys
//   2. production proof verifies on-chain                       (true)
//   3. tampered public signal rejected                          (false)
//   4. wrong chainId signal rejected                            (false)
//   5. DEV baseline proof rejected by the PRODUCTION verifier   (false)
//      — dev/production key separation, end-to-end on-chain
// ============================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface ProofBundle {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
}

const prod: ProofBundle = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/phase4/reports/production_proof_baseline.json"), "utf8")
);
const dev: ProofBundle = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/phase2/proofs/proof_v2_baseline.json"), "utf8")
);

// snarkjs proof -> Solidity calldata (G2 coordinate order swapped)
function calldata(b: ProofBundle) {
  const pA = [b.proof.pi_a[0], b.proof.pi_a[1]] as unknown as readonly [bigint, bigint];
  const pB = [
    [b.proof.pi_b[0][1], b.proof.pi_b[0][0]],
    [b.proof.pi_b[1][1], b.proof.pi_b[1][0]],
  ] as unknown as readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  const pC = [b.proof.pi_c[0], b.proof.pi_c[1]] as unknown as readonly [bigint, bigint];
  return { pA, pB, pC };
}

let passed = 0;
function ok(cond: boolean, name: string) {
  assert.ok(cond, name);
  passed++;
  console.log(`PASS ${name}`);
}

async function main() {
  const { viem } = await network.connect(); // in-process "default" network (Hardhat 3)
  const publicClient = await viem.getPublicClient();

  const verifier = await viem.deployContract(
    "contracts/Groth16VerifierV2Production.sol:Groth16VerifierV2Production"
  );
  ok(
    (await publicClient.getBytecode({ address: verifier.address })) !== undefined,
    "production verifier bytecode deployed"
  );

  const verify = async (b: ProofBundle, signals?: string[]) =>
    verifier.read.verifyProof([
      calldata(b).pA,
      calldata(b).pB,
      calldata(b).pC,
      (signals ?? b.publicSignals).map((s) => BigInt(s)) as readonly bigint[],
    ]);

  ok((await verify(prod)) === true, "production proof verifies on-chain against production VK");

  const tampered = [...prod.publicSignals];
  tampered[28] = (BigInt(tampered[28]) + 1n).toString(); // commitment
  ok((await verify(prod, tampered)) === false, "tampered commitment signal rejected on-chain");

  const wrongChain = [...prod.publicSignals];
  wrongChain[22] = "1"; // chainId
  ok((await verify(prod, wrongChain)) === false, "wrong chainId signal rejected on-chain");

  ok((await verify(dev)) === false, "DEV proof rejected by PRODUCTION verifier (dev/prod separation)");

  console.log(`PRODUCTION VERIFIER ON-CHAIN TEST: ${passed}/5 PASS`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
