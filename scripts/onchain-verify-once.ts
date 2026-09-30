// ============================================================================
// One-shot on-chain Groth16 proof verification (Phase 8.11)
// Usage: tsx scripts/onchain-verify-once.ts <proof.json> <publicSignals.json>
// Exit 0 = valid, 1 = invalid or error
// ============================================================================
import fs from "node:fs";
import { getContract } from "viem";
import { network } from "hardhat";

interface ProofBundle {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
}

function calldata(b: ProofBundle) {
  const pA = [b.proof.pi_a[0], b.proof.pi_a[1]] as unknown as readonly [bigint, bigint];
  const pB = [
    [b.proof.pi_b[0][1], b.proof.pi_b[0][0]],
    [b.proof.pi_b[1][1], b.proof.pi_b[1][0]],
  ] as unknown as readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  const pC = [b.proof.pi_c[0], b.proof.pi_c[1]] as unknown as readonly [bigint, bigint];
  return { pA, pB, pC };
}

async function main() {
  const proofPath = process.argv[2];
  const publicPath = process.argv[3];
  if (!proofPath || !publicPath) {
    console.error("usage: tsx scripts/onchain-verify-once.ts <proof.json> <public.json>");
    process.exit(1);
  }

  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf8"));
  const bundle: ProofBundle = { proof, publicSignals };

  const { viem } = await network.connect();
  const artifactPath =
    "artifacts/hardhat/scripts/prover-contracts/Groth16VerifierV2Production.sol/Groth16VerifierV2Production.json";
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Missing verifier artifact: " +
        artifactPath +
        ". Run hardhat compile with scripts/hardhat-prover.config.ts first."
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const [walletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const deploymentHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deploymentHash,
  });
  if (!receipt.contractAddress) {
    throw new Error("Verifier deployment returned no contract address.");
  }
  const verifier = getContract({
    address: receipt.contractAddress,
    abi: artifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });
  const { pA, pB, pC } = calldata(bundle);
  const ok = await verifier.read.verifyProof([
    pA,
    pB,
    pC,
    publicSignals.map((s: string) => BigInt(s)) as readonly bigint[],
  ]);

  process.exit(ok === true ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
