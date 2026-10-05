import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAddress, getContractAddress } from "viem";
import { network } from "hardhat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const LOCAL_DEPLOYMENT_INFO_PATH = path.join(PROJECT_ROOT, "deployments", "localhost.json");
const SEPOLIA_DEPLOYMENT_INFO_PATH = path.join(PROJECT_ROOT, "deployments", "sepolia.json");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

function upsertEnvValue(content: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, line);
  const normalized = content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
  return `${normalized}${line}\n`;
}

function syncLocalhostAddresses(verifierAddress: string, shieldAddress: string, registryAddress: string) {
  let existing = "";
  try {
    existing = fs.readFileSync(ENV_PATH, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let updated = existing;
  updated = upsertEnvValue(updated, "VERIFIER_ADDRESS", verifierAddress);
  updated = upsertEnvValue(updated, "SHIELD_ADDRESS", shieldAddress);
  updated = upsertEnvValue(updated, "NULLIFIER_REGISTRY_ADDRESS", registryAddress);
  fs.writeFileSync(ENV_PATH, updated);
}

async function deployLocalhost() {
  const { viem } = await network.connect({ network: "localhost" });
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  if (chainId !== 31337) throw new Error(`Expected localhost chain ID 31337, got ${chainId}`);

  console.log("AegisProof Localhost Deployment");
  console.log("Deployer:", deployer.account.address);
  console.log("Chain ID:", chainId);

  const verifier = await viem.deployContract("protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2");
  const canonicalVerifierAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
  if (verifier.address.toLowerCase() !== canonicalVerifierAddress) {
    throw new Error(`Canonical verifier mismatch on localhost: expected ${canonicalVerifierAddress}, got ${verifier.address}`);
  }

  const verifierCode = await publicClient.getBytecode({ address: verifier.address });
  if (!verifierCode || verifierCode === "0x") throw new Error("Verifier deployment failed: no bytecode found");

  const registry = await viem.deployContract("AegisNullifierRegistry", [deployer.account.address]);
  const canonicalRegistryAddress = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  if (registry.address.toLowerCase() !== canonicalRegistryAddress) {
    throw new Error(`Canonical registry mismatch on localhost: expected ${canonicalRegistryAddress}, got ${registry.address}`);
  }

  const shield = await viem.deployContract("AegisShieldV2", [
    verifier.address,
    deployer.account.address,
    registry.address,
  ]);
  await registry.write.setConsumerAuthorized([shield.address, true]);

  if (!(await registry.read.authorizedConsumers([shield.address]))) {
    throw new Error("Registry authorization failed for AegisShieldV2");
  }

  const shieldCode = await publicClient.getBytecode({ address: shield.address });
  if (!shieldCode || shieldCode === "0x") throw new Error("AegisShield deployment failed: no bytecode found");

  const storedVerifier = String(await shield.read.verifier());
  const storedOperator = String(await shield.read.operator());
  const storedRegistry = String(await shield.read.nullifierRegistry());

  if (storedVerifier.toLowerCase() !== verifier.address.toLowerCase()) throw new Error("Verifier mismatch");
  if (storedOperator.toLowerCase() !== deployer.account.address.toLowerCase()) throw new Error("Operator mismatch");
  if (storedRegistry.toLowerCase() !== registry.address.toLowerCase()) throw new Error("Nullifier registry mismatch");

  fs.mkdirSync(path.dirname(LOCAL_DEPLOYMENT_INFO_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_DEPLOYMENT_INFO_PATH, JSON.stringify({
    network: "localhost",
    chainId,
    deployer: deployer.account.address,
    verifierAddress,
    verifierDeploymentTx: verifierTxHash,
    nullifierRegistryAddress: registryAddress,
    registryDeploymentTx,
    shieldAddress,
    shieldDeploymentTx,
  }, null, 2) + "\n");

  syncLocalhostAddresses(verifier.address, shield.address, registry.address);

  console.log("Deployment completed successfully");
  console.log("Groth16VerifierV2:", verifierAddress);
  console.log("AegisNullifierRegistry:", registryAddress);
  console.log("AegisShieldV2:", shieldAddress);
  console.log("Verifier deployment tx:", verifierTxHash ?? "reused existing deployment");
  console.log("Registry deployment tx:", registryDeploymentTx);
  console.log("Shield deployment tx:", shieldDeploymentTx);
}

async function deploySepolia() {
  const expectedDeployer = process.env.SEPOLIA_EXPECTED_DEPLOYER;
  if (!expectedDeployer) {
    throw new Error("SEPOLIA_EXPECTED_DEPLOYER is required for Sepolia deployment");
  }

  const { viem } = await network.connect({ network: "sepolia" });
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  if (chainId !== 11155111) {
    throw new Error(`Expected Sepolia chain ID 11155111, got ${chainId}`);
  }

  const deployerAddress = getAddress(deployer.account.address);
  if (deployerAddress !== getAddress(expectedDeployer)) {
    throw new Error(`Configured deployer mismatch: expected ${getAddress(expectedDeployer)}, got ${deployerAddress}`);
  }

  const latestNonce = await publicClient.getTransactionCount({
    address: deployerAddress,
    blockTag: "latest",
  });
  const pendingNonce = await publicClient.getTransactionCount({
    address: deployerAddress,
    blockTag: "pending",
  });

  if (pendingNonce !== latestNonce) {
    throw new Error(`Pending nonce ${pendingNonce} differs from latest nonce ${latestNonce}; do not deploy until the nonce range is clear.`);
  }

  const existingVerifierAddress = process.env.SEPOLIA_VERIFIER_ADDRESS;

  const registryNonce = existingVerifierAddress ? latestNonce : latestNonce + 1;
  const shieldNonce = registryNonce + 1;

  const expectedVerifier = existingVerifierAddress
    ? getAddress(existingVerifierAddress)
    : getContractAddress({
        from: deployerAddress,
        nonce: BigInt(latestNonce),
      });

  const expectedRegistry = getContractAddress({
    from: deployerAddress,
    nonce: BigInt(registryNonce),
  });

  const expectedShield = getContractAddress({
    from: deployerAddress,
    nonce: BigInt(shieldNonce),
  });

  console.log("AegisProof Sepolia Deployment");
  console.log("Deployer:", deployerAddress);
  console.log("Chain ID:", chainId);
  console.log("Starting nonce:", latestNonce);
  console.log("Expected verifier:", expectedVerifier);
  console.log("Expected registry:", expectedRegistry);
  console.log("Expected shield:", expectedShield);

  let verifierAddress: string;
  let verifierTxHash: string | null = null;

  if (existingVerifierAddress) {
    verifierAddress = getAddress(existingVerifierAddress);

    const verifierCode = await publicClient.getBytecode({
      address: verifierAddress,
    });

    if (!verifierCode || verifierCode === "0x") {
      throw new Error(
        `SEPOLIA_VERIFIER_ADDRESS has no bytecode: ${verifierAddress}`,
      );
    }

    console.log("Reusing existing Groth16VerifierV2:");
    console.log("Verifier:", verifierAddress);
  } else {
    console.log("[1] Deploying Groth16VerifierV2...");

    const verifierDeployment = await viem.sendDeploymentTransaction(
      "protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2",
    );

    verifierTxHash = verifierDeployment.deploymentTransaction.hash;

    console.log("Verifier deployment tx:", verifierTxHash);

    const verifierReceipt = await publicClient.waitForTransactionReceipt({
      hash: verifierTxHash,
      confirmations: 2,
      timeout: 180_000,
    });

    if (!verifierReceipt.contractAddress) {
      throw new Error(
        `Verifier deployment ${verifierTxHash} did not produce a contract address`,
      );
    }

    verifierAddress = getAddress(verifierReceipt.contractAddress);

    if (verifierAddress !== getAddress(expectedVerifier)) {
      throw new Error(
        `Verifier address mismatch: expected ${expectedVerifier}, got ${verifierAddress}`,
      );
    }

    console.log("Verifier Contract Address:", verifierAddress);
  }

  const registryDeployment = await viem.sendDeploymentTransaction(
    "AegisNullifierRegistry",
    [deployerAddress],
  );

  const registryDeploymentTx = registryDeployment.deploymentTransaction.hash;

  console.log("Registry deployment tx:", registryDeploymentTx);

  const registryReceipt = await publicClient.waitForTransactionReceipt({
    hash: registryDeploymentTx,
    confirmations: 2,
    timeout: 180_000,
  });

  if (!registryReceipt.contractAddress) {
    throw new Error(
      `Registry deployment ${registryDeploymentTx} did not produce a contract address`,
    );
  }

  const registryAddress = getAddress(registryReceipt.contractAddress);

  if (registryAddress !== getAddress(expectedRegistry)) {
    throw new Error(
      `Registry address mismatch: expected ${expectedRegistry}, got ${registryAddress}`,
    );
  }

  const registry = await viem.getContractAt(
    "AegisNullifierRegistry",
    registryAddress,
  );

  console.log("Registry Contract Address:", registryAddress);

  const shieldDeployment = await viem.sendDeploymentTransaction(
    "AegisShieldV2",
    [verifierAddress, deployerAddress, registryAddress],
  );

  const shieldDeploymentTx = shieldDeployment.deploymentTransaction.hash;

  console.log("Shield deployment tx:", shieldDeploymentTx);

  const shieldReceipt = await publicClient.waitForTransactionReceipt({
    hash: shieldDeploymentTx,
    confirmations: 2,
    timeout: 180_000,
  });

  if (!shieldReceipt.contractAddress) {
    throw new Error(
      `Shield deployment ${shieldDeploymentTx} did not produce a contract address`,
    );
  }

  const shieldAddress = getAddress(shieldReceipt.contractAddress);

  if (shieldAddress !== getAddress(expectedShield)) {
    throw new Error(
      `Shield address mismatch: expected ${expectedShield}, got ${shieldAddress}`,
    );
  }

  const shield = await viem.getContractAt(
    "AegisShieldV2",
    shieldAddress,
  );

  console.log("Shield Contract Address:", shieldAddress);

  await registry.write.setConsumerAuthorized([shield.address, true]);
  if (!(await registry.read.authorizedConsumers([shield.address]))) {
    throw new Error("Registry authorization failed for AegisShieldV2");
  }

  for (const [name, address] of [
    ["verifier", verifierAddress],
    ["registry", registryAddress],
    ["shield", shieldAddress],
  ]) {
    const code = await publicClient.getBytecode({ address });
    if (!code || code === "0x") throw new Error(`${name} deployment failed: no bytecode found`);
  }

  const storedVerifier = String(await shield.read.verifier());
  const storedOperator = String(await shield.read.operator());
  const storedRegistry = String(await shield.read.nullifierRegistry());

  if (getAddress(storedVerifier) !== getAddress(verifierAddress)) throw new Error("Shield verifier state mismatch");
  if (getAddress(storedOperator) !== deployerAddress) throw new Error("Shield operator state mismatch");
  if (getAddress(storedRegistry) !== getAddress(registryAddress)) throw new Error("Shield registry state mismatch");

  fs.mkdirSync(path.dirname(SEPOLIA_DEPLOYMENT_INFO_PATH), { recursive: true });
  fs.writeFileSync(SEPOLIA_DEPLOYMENT_INFO_PATH, JSON.stringify({
    network: "sepolia",
    chainId,
    deployer: deployerAddress,
    startingNonce: latestNonce,
    verifierAddress: verifier.address,
    nullifierRegistryAddress: registry.address,
    shieldAddress: shield.address,
  }, null, 2) + "\n");

  console.log("Sepolia deployment completed successfully");
  console.log("Groth16VerifierV2:", verifier.address);
  console.log("AegisNullifierRegistry:", registry.address);
  console.log("AegisShieldV2:", shield.address);
  console.log("Deployment file:", SEPOLIA_DEPLOYMENT_INFO_PATH);
}

async function main() {
  const target = process.env.AEGIS_DEPLOY_TARGET ?? "localhost";

  if (target === "localhost") {
    await deployLocalhost();
    return;
  }

  if (target === "sepolia") {
    await deploySepolia();
    return;
  }

  throw new Error(`Unsupported AEGIS_DEPLOY_TARGET: ${target}. Use localhost or sepolia.`);
}

main().catch((error) => {
  console.error("");
  console.error("DEPLOYMENT FAILED");
  console.error(error);
  process.exitCode = 1;
});
