import "dotenv/config";
import hre from "hardhat";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import fs from "node:fs";
import path from "node:path";

const VERIFIER_FQN =
  "protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2";

const REGISTRY_FQN =
  "protocol/contracts/AegisNullifierRegistry.sol:AegisNullifierRegistry";

const SHIELD_FQN =
  "protocol/contracts/AegisShieldV2.sol:AegisShieldV2";

const REQUIRED_CONFIRMATIONS = 2;
const RECEIPT_TIMEOUT = 180_000;

type Address = `0x${string}`;

type DeploymentResult = {
  address: Address;
  txHash: `0x${string}`;
  receipt: any;
  contract: any;
};

function validateAddress(
  value: string | undefined,
  name: string,
): Address {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} is missing or invalid: ${value ?? "<empty>"}`);
  }

  return value as Address;
}

async function deployAndConfirm(
  viem: any,
  publicClient: any,
  contractName: string,
  constructorArgs: readonly unknown[] = [],
): Promise<DeploymentResult> {
  console.log(`\nDeploying ${contractName}...`);

  const deploymentTransaction =
    await viem.sendDeploymentTransaction(
      contractName,
      [...constructorArgs],
    );

  const txHash = deploymentTransaction.hash as `0x${string}`;

  console.log(`Deployment Tx: ${txHash}`);
  console.log(
    `Waiting for deployment confirmation (${REQUIRED_CONFIRMATIONS} blocks)...`,
  );

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: REQUIRED_CONFIRMATIONS,
    timeout: RECEIPT_TIMEOUT,
  });

  if (!receipt.contractAddress) {
    throw new Error(
      `Deployment transaction ${txHash} was mined but did not return a contract address`,
    );
  }

  const address = receipt.contractAddress as Address;

  const contract = await viem.getContractAt(
    contractName,
    address,
  );

  return {
    address,
    txHash,
    receipt,
    contract,
  };
}

async function getExistingContract(
  viem: any,
  publicClient: any,
  address: string | undefined,
  contractName: string,
): Promise<DeploymentResult | null> {
  if (!address) {
    return null;
  }

  const validatedAddress = validateAddress(
    address,
    `${contractName} address`,
  );

  const bytecode = await publicClient.getBytecode({
    address: validatedAddress,
  });

  if (!bytecode || bytecode === "0x") {
    return null;
  }

  console.log(`\nReusing existing ${contractName}`);
  console.log(`Address: ${validatedAddress}`);

  const contract = await viem.getContractAt(
    contractName,
    validatedAddress,
  );

  return {
    address: validatedAddress,
    txHash: "0x" as `0x${string}`,
    receipt: null,
    contract,
  };
}

function upsertEnvValue(
  envPath: string,
  key: string,
  value: string,
): void {
  let content = "";

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  const line = `${key}=${value}`;

  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  fs.writeFileSync(envPath, content);
}

function syncEnvAddresses(
  networkName: string,
  verifierAddress: Address,
  registryAddress: Address,
  shieldAddress: Address,
): void {
  const envPath = path.resolve(".env");

  upsertEnvValue(
    envPath,
    `${networkName.toUpperCase()}_VERIFIER_ADDRESS`,
    verifierAddress,
  );

  upsertEnvValue(
    envPath,
    `${networkName.toUpperCase()}_REGISTRY_ADDRESS`,
    registryAddress,
  );

  upsertEnvValue(
    envPath,
    `${networkName.toUpperCase()}_SHIELD_ADDRESS`,
    shieldAddress,
  );
}

async function main(): Promise<void> {
  const networkConnection = await hre.network.create();
  const viem = networkConnection.viem;
  const publicClient = await viem.getPublicClient();

  const [deployer] = await viem.getWalletClients();

  if (!deployer?.account) {
    throw new Error("No deployment wallet is configured");
  }

  const deployerAddress = deployer.account.address as Address;
  const chainId = await publicClient.getChainId();

  const networkName =
    networkConnection.networkName ??
    process.env.HARDHAT_NETWORK ??
    "unknown";

  console.log("==========================================");
  console.log(`AegisProof ${networkName} Deployment`);
  console.log("==========================================");
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Chain ID: ${chainId}`);

  if (networkName !== "sepolia") {
    throw new Error(
      `This deployment script is restricted to Sepolia. Current network: ${networkName}`,
    );
  }

  if (chainId !== 11155111) {
    throw new Error(
      `Unexpected chain ID. Expected 11155111, received ${chainId}`,
    );
  }

  /*
   * The previous deployment already produced bytecode at:
   *
   *   0x444fcb9b1fb3cec13a11b6be2b40d5d43700df86
   *
   * If SEPOLIA_VERIFIER_ADDRESS is present in .env, reuse it.
   *
   * This prevents the failed post-deployment bookkeeping from causing
   * another Verifier deployment on the next run.
   */
  const existingVerifierAddress =
    process.env.SEPOLIA_VERIFIER_ADDRESS;

  let verifierDeployment =
    await getExistingContract(
      viem,
      publicClient,
      existingVerifierAddress,
      VERIFIER_FQN,
    );

  if (!verifierDeployment) {
    console.log("\n[1] Deploying Groth16VerifierV2...");

    verifierDeployment = await deployAndConfirm(
      viem,
      publicClient,
      VERIFIER_FQN,
    );

    console.log(
      `Verifier Contract Address: ${verifierDeployment.address}`,
    );
    console.log(
      `Verifier Deployment Tx: ${verifierDeployment.txHash}`,
    );
  }

  const verifierAddress = verifierDeployment.address;

  /*
   * Registry
   */
  let registryDeployment =
    await getExistingContract(
      viem,
      publicClient,
      process.env.SEPOLIA_REGISTRY_ADDRESS,
      REGISTRY_FQN,
    );

  if (!registryDeployment) {
    console.log("\n[2] Deploying AegisNullifierRegistry...");

    registryDeployment = await deployAndConfirm(
      viem,
      publicClient,
      REGISTRY_FQN,
      [deployerAddress],
    );

    console.log(
      `Registry Contract Address: ${registryDeployment.address}`,
    );
    console.log(
      `Registry Deployment Tx: ${registryDeployment.txHash}`,
    );
  }

  const registryAddress = registryDeployment.address;

  /*
   * Shield
   */
  let shieldDeployment =
    await getExistingContract(
      viem,
      publicClient,
      process.env.SEPOLIA_SHIELD_ADDRESS,
      SHIELD_FQN,
    );

  if (!shieldDeployment) {
    console.log("\n[3] Deploying AegisShieldV2...");

    shieldDeployment = await deployAndConfirm(
      viem,
      publicClient,
      SHIELD_FQN,
      [verifierAddress, registryAddress],
    );

    console.log(
      `Shield Contract Address: ${shieldDeployment.address}`,
    );
    console.log(
      `Shield Deployment Tx: ${shieldDeployment.txHash}`,
    );
  }

  const shieldAddress = shieldDeployment.address;

  /*
   * Authorize Shield in Registry.
   */
  console.log("\n[4] Authorizing Shield in Registry...");

  const authorized =
    await registryDeployment.contract.read.authorizedShields([
      shieldAddress,
    ]);

  if (!authorized) {
    const authorizationTx =
      await registryDeployment.contract.write.authorizeShield([
        shieldAddress,
      ]);

    console.log(`Authorization Tx: ${authorizationTx}`);

    await publicClient.waitForTransactionReceipt({
      hash: authorizationTx,
      confirmations: REQUIRED_CONFIRMATIONS,
      timeout: RECEIPT_TIMEOUT,
    });

    console.log("Shield authorization confirmed.");
  } else {
    console.log("Shield is already authorized.");
  }

  /*
   * Basic bytecode validation.
   */
  console.log("\n[5] Verifying deployed bytecode...");

  for (const [name, address] of [
    ["Verifier", verifierAddress],
    ["Registry", registryAddress],
    ["Shield", shieldAddress],
  ] as const) {
    const bytecode = await publicClient.getBytecode({
      address,
    });

    if (!bytecode || bytecode === "0x") {
      throw new Error(
        `${name} has no bytecode at ${address}`,
      );
    }

    console.log(
      `${name}: bytecode present at ${address}`,
    );
  }

  /*
   * Persist deployment metadata.
   *
   * deployments/ is ignored by git, so this remains local deployment
   * state and must not be committed as production deployment evidence.
   */
  const deploymentDir = path.resolve("deployments");

  fs.mkdirSync(deploymentDir, {
    recursive: true,
  });

  const deploymentPath = path.join(
    deploymentDir,
    `${networkName}.json`,
  );

  const deployment = {
    network: networkName,
    chainId,
    deployer: deployerAddress,
    verifier: {
      address: verifierAddress,
      transactionHash:
        verifierDeployment.txHash === "0x"
          ? null
          : verifierDeployment.txHash,
    },
    registry: {
      address: registryAddress,
      transactionHash:
        registryDeployment.txHash === "0x"
          ? null
          : registryDeployment.txHash,
    },
    shield: {
      address: shieldAddress,
      transactionHash:
        shieldDeployment.txHash === "0x"
          ? null
          : shieldDeployment.txHash,
    },
    shieldAuthorized: true,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deployment, null, 2) + "\n",
  );

  syncEnvAddresses(
    networkName,
    verifierAddress,
    registryAddress,
    shieldAddress,
  );

  console.log("\n==========================================");
  console.log("Deployment completed successfully");
  console.log("==========================================");
  console.log(`Verifier: ${verifierAddress}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`Shield:   ${shieldAddress}`);
  console.log(`Metadata: ${deploymentPath}`);
}

main().catch((error) => {
  console.error("\nDEPLOYMENT FAILED");
  console.error(error);
  process.exitCode = 1;
});