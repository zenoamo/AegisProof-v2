import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";
import { getAddress, isAddress, zeroAddress, type Hash } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

/**
 * 正規表現を使わず安全に行単位で .env を更新・追記する関数
 */
function upsertEnvValue(content: string, key: string, value: string): string {
  const lines = content.split(/\r?\n/);
  const targetPrefix = `${key}=`;
  let found = false;

  const updatedLines = lines.map((line) => {
    if (line.trim().startsWith(targetPrefix)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") {
      updatedLines[updatedLines.length - 1] = `${key}=${value}`;
      updatedLines.push("");
    } else {
      updatedLines.push(`${key}=${value}`);
    }
  }

  return updatedLines.join("\n");
}

/**
 * 一時ファイルを経由したアトミックな .env 更新（破損防止）
 */
function syncEnvAddresses(
  verifierAddress: string,
  shieldAddress: string,
  registryAddress: string
) {
  let existing = "";
  try {
    existing = fs.readFileSync(ENV_PATH, "utf8");
  } catch (error: unknown) {
    if ((error as { code?: string })?.code !== "ENOENT") {
      throw error;
    }
  }

  let updated = existing;
  updated = upsertEnvValue(updated, "VERIFIER_ADDRESS", verifierAddress);
  updated = upsertEnvValue(updated, "SHIELD_ADDRESS", shieldAddress);
  updated = upsertEnvValue(updated, "NULLIFIER_REGISTRY_ADDRESS", registryAddress);

  const tmpPath = `${ENV_PATH}.tmp`;
  fs.writeFileSync(tmpPath, updated, { mode: 0o600 });
  fs.renameSync(tmpPath, ENV_PATH);
}

/**
 * コントラクトインスタンスからデプロイトランザクションハッシュを安全に抽出
 */
function getDeploymentTxHash(contractInstance: any): Hash {
  const hash =
    contractInstance.deploymentTransaction?.()?.hash ||
    contractInstance.transactionHash ||
    contractInstance.deployTransaction?.hash;

  if (!hash || typeof hash !== "string") {
    throw new Error(`Failed to retrieve deployment transaction hash for ${contractInstance.address}`);
  }
  return hash as Hash;
}

/**
 * アドレスの構文およびゼロアドレス検証
 */
function validateValidAddress(addr: string, label: string) {
  if (!isAddress(addr) || getAddress(addr) === zeroAddress) {
    throw new Error(`Invalid address for ${label}: got "${addr}"`);
  }
}

/**
 * 既存の .env から特定キーのアドレスを取得
 */
function getPreviousEnvAddress(key: string): string | null {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf8");
    const match = content.match(new RegExp(`^${key}=(0x[a-fA-F0-9]{40})`, "m"));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const { viem } = await network.connect();

  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const networkName = network.name || "sepolia";

  const deploymentInfoPath = path.join(
    PROJECT_ROOT,
    "deployments",
    `${networkName}.json`
  );

  // 権限剥奪用に古い Shield アドレスを取得しておく
  const previousShieldAddress = getPreviousEnvAddress("SHIELD_ADDRESS");

  console.log("");
  console.log("==========================================");
  console.log(`AegisProof ${networkName} Deployment`);
  console.log("==========================================");
  console.log("Deployer:", deployer.account.address);
  console.log("Chain ID:", chainId);

  validateValidAddress(deployer.account.address, "Deployer");

  // 1. Deploy Groth16VerifierV2
  console.log("\n[1] Deploying Groth16VerifierV2...");
  const verifier = await viem.deployContract(
    "protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2"
  );
  validateValidAddress(verifier.address, "Verifier Contract");
  console.log("Verifier Contract Address:", verifier.address);

  console.log("Waiting for Verifier deployment confirmation (2 blocks)...");
  const verifierTxHash = getDeploymentTxHash(verifier);
  await publicClient.waitForTransactionReceipt({ 
    hash: verifierTxHash, 
    confirmations: 2, 
    timeout: 180_000 
  });

  // Verify Bytecode
  const verifierCode = await publicClient.getBytecode({
    address: verifier.address,
  });
  if (!verifierCode || verifierCode === "0x") {
    throw new Error("Verifier deployment failed: no bytecode found on chain");
  }
  console.log("Verifier bytecode: OK");

  // 2. Deploy AegisNullifierRegistry
  console.log("\n[2] Deploying AegisNullifierRegistry...");
  const registry = await viem.deployContract("AegisNullifierRegistry", [
    deployer.account.address,
  ]);
  validateValidAddress(registry.address, "Registry Contract");
  console.log("Registry Contract Address:", registry.address);

  console.log("Waiting for Registry deployment confirmation (2 blocks)...");
  const registryTxHash = getDeploymentTxHash(registry);
  await publicClient.waitForTransactionReceipt({ 
    hash: registryTxHash, 
    confirmations: 2, 
    timeout: 180_000 
  });

  // 3. Deploy AegisShieldV2
  console.log("\n[3] Deploying AegisShieldV2...");
  const shield = await viem.deployContract("AegisShieldV2", [
    verifier.address,
    deployer.account.address,
    registry.address,
  ]);
  validateValidAddress(shield.address, "Shield Contract");
  console.log("Shield Contract Address:", shield.address);

  console.log("Waiting for Shield deployment confirmation (2 blocks)...");
  const shieldTxHash = getDeploymentTxHash(shield);
  await publicClient.waitForTransactionReceipt({ 
    hash: shieldTxHash, 
    confirmations: 2, 
    timeout: 180_000 
  });

  // 4. Authorize AegisShieldV2 on AegisNullifierRegistry
  console.log("\n[4] Configuring Registry Authorizations...");
  console.log(`Authorizing new Shield (${shield.address})...`);
  const setAuthHash = await registry.write.setConsumerAuthorized([
    shield.address,
    true,
  ]);
  await publicClient.waitForTransactionReceipt({ 
    hash: setAuthHash, 
    confirmations: 2, 
    timeout: 180_000 
  });

  const authorized = await registry.read.authorizedConsumers([
    shield.address,
  ]);
  if (!authorized) {
    throw new Error("Registry authorization failed for AegisShieldV2");
  }

  // 古い Shield が存在し、今回のアドレスと異なる場合は旧権限を剥奪
  if (
    previousShieldAddress &&
    isAddress(previousShieldAddress) &&
    getAddress(previousShieldAddress) !== getAddress(shield.address)
  ) {
    console.log(`Revoking authorization for previous Shield (${previousShieldAddress})...`);
    try {
      const revokeHash = await registry.write.setConsumerAuthorized([
        previousShieldAddress,
        false,
      ]);
      await publicClient.waitForTransactionReceipt({ 
        hash: revokeHash, 
        confirmations: 2, 
        timeout: 180_000 
      });
      console.log("Previous Shield authorization revoked: OK");
    } catch (revokeErr) {
      console.warn("Warning: Failed to revoke previous Shield authorization:", revokeErr);
    }
  }

  // Verify Shield Bytecode
  const shieldCode = await publicClient.getBytecode({
    address: shield.address,
  });
  if (!shieldCode || shieldCode === "0x") {
    throw new Error("AegisShield deployment failed: no bytecode found on chain");
  }
  console.log("Shield bytecode: OK");

  // 5. Verify Constructor State
  console.log("\n[5] Verifying AegisShield state...");
  const storedVerifier = await shield.read.verifier();
  const storedOperator = await shield.read.operator();
  const storedRegistry = await shield.read.nullifierRegistry();

  console.log("Stored verifier:", storedVerifier);
  console.log("Stored operator:", storedOperator);
  console.log("Stored registry:", storedRegistry);

  if (getAddress(String(storedVerifier)) !== getAddress(verifier.address)) {
    throw new Error(`Verifier mismatch: expected ${verifier.address}, got ${storedVerifier}`);
  }
  if (getAddress(String(storedOperator)) !== getAddress(deployer.account.address)) {
    throw new Error(`Operator mismatch: expected ${deployer.account.address}, got ${storedOperator}`);
  }
  if (getAddress(String(storedRegistry)) !== getAddress(registry.address)) {
    throw new Error(`Nullifier registry mismatch: expected ${registry.address}, got ${storedRegistry}`);
  }

  console.log("AegisShield constructor state: OK");

  // 6. Save Deployment Information (Atomic Write)
  fs.mkdirSync(path.dirname(deploymentInfoPath), { recursive: true });
  const jsonTmpPath = `${deploymentInfoPath}.tmp`;
  fs.writeFileSync(
    jsonTmpPath,
    JSON.stringify(
      {
        network: networkName,
        chainId,
        deployer: deployer.account.address,
        verifierAddress: verifier.address,
        nullifierRegistryAddress: registry.address,
        shieldAddress: shield.address,
      },
      null,
      2
    ) + "\n",
    { mode: 0o600 }
  );
  fs.renameSync(jsonTmpPath, deploymentInfoPath);

  // 7. Sync .env
  syncEnvAddresses(verifier.address, shield.address, registry.address);

  console.log("\n==========================================");
  console.log("Deployment completed successfully");
  console.log("==========================================");
}

main().catch((error) => {
  console.error("\nDEPLOYMENT FAILED");
  console.error(error);
  process.exitCode = 1;
});
