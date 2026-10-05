import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import {
  getAddress,
  getContractAddress,
  isAddress,
  zeroAddress,
  type Hash,
} from "viem";

const ROOT = path.resolve(".");
const DEPLOYMENTS_DIR = path.join(ROOT, "deployments");
const CANONICAL_REGISTRY = path.join(
  ROOT,
  "protocol",
  "contracts",
  "AegisCanonicalRegistry.sol",
);

const SEPOLIA_CHAIN_ID = 11155111;
const CONFIRMATIONS = 2;
const RECEIPT_TIMEOUT = 180_000;

type Address = `0x${string}`;

type Deployment = {
  address: Address;
  txHash: Hash | null;
};

function address(value: string | undefined, name: string): Address {
  if (!value || !isAddress(value) || getAddress(value) === zeroAddress) {
    throw new Error(`${name} is missing or invalid`);
  }
  return getAddress(value) as Address;
}

function sameAddress(a: string, b: string): boolean {
  return getAddress(a) === getAddress(b);
}

function previousEnvAddress(key: string): Address | null {
  const value = process.env[key];
  return value ? address(value, key) : null;
}

function deploymentHash(result: any): Hash {
  const hash =
    (typeof result === "string" && result) ||
    result?.hash ||
    result?.transactionHash ||
    result?.deploymentTransaction?.hash ||
    result?.deploymentTransaction?.transactionHash;

  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(
      `Deployment transaction hash was not returned by Hardhat Viem: ${JSON.stringify(result)}`,
    );
  }

  return hash as Hash;
}

async function waitForDeployment(publicClient: any, hash: Hash) {
  return publicClient.waitForTransactionReceipt({
    hash,
    confirmations: CONFIRMATIONS,
    timeout: RECEIPT_TIMEOUT,
  });
}

function canonicalAddress(name: "SEPOLIA_VERIFIER" | "SEPOLIA_REGISTRY") {
  if (!fs.existsSync(CANONICAL_REGISTRY)) {
    throw new Error(
      "AegisCanonicalRegistry.sol is missing; run prepare-sepolia-deployment.mjs first",
    );
  }

  const source = fs.readFileSync(CANONICAL_REGISTRY, "utf8");
  const match = source.match(
    new RegExp(
      `${name}\\\\s*=\\\\s*\\\\n\\\\s*(0x[0-9a-fA-F]{40})\\\\s*;`,
    ),
  );

  if (!match) {
    throw new Error(
      `No ${name} entry found in AegisCanonicalRegistry.sol; run prepare-sepolia-deployment.mjs first`,
    );
  }

  return address(match[1], name);
}

async function reuse(
  viem: any,
  publicClient: any,
  configured: Address | null,
  contractName: string,
): Promise<Deployment | null> {
  if (!configured) return null;

  const bytecode = await publicClient.getBytecode({ address: configured });
  if (!bytecode || bytecode === "0x") {
    throw new Error(`${contractName} configured at ${configured}, but no bytecode exists there`);
  }

  console.log(`Reusing ${contractName}: ${configured}`);
  return {
    address: configured,
    txHash: null,
  };
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  if (!deployer?.account) throw new Error("No deployment wallet configured");

  const chainId = await publicClient.getChainId();
  const deployerAddress = address(deployer.account.address, "deployer");
  const expectedDeployer = address(
    process.env.SEPOLIA_EXPECTED_DEPLOYER,
    "SEPOLIA_EXPECTED_DEPLOYER",
  );

  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`Expected Sepolia chain ${SEPOLIA_CHAIN_ID}, got ${chainId}`);
  }
  if (!sameAddress(deployerAddress, expectedDeployer)) {
    throw new Error(
      `Deployer mismatch: wallet=${deployerAddress}, expected=${expectedDeployer}`,
    );
  }

  const [latestNonce, pendingNonce] = await Promise.all([
    publicClient.getTransactionCount({
      address: deployerAddress,
      blockTag: "latest",
    }),
    publicClient.getTransactionCount({
      address: deployerAddress,
      blockTag: "pending",
    }),
  ]);

  if (latestNonce !== pendingNonce) {
    throw new Error(
      `Pending transaction detected: latest nonce=${latestNonce}, pending nonce=${pendingNonce}. Refusing deployment.`,
    );
  }

  console.log("==========================================");
  console.log("AegisProof Sepolia Deployment");
  console.log("==========================================");
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Starting nonce: ${latestNonce}`);

  const configuredVerifier = previousEnvAddress("SEPOLIA_VERIFIER_ADDRESS");
  const configuredRegistry = previousEnvAddress("SEPOLIA_REGISTRY_ADDRESS");
  const configuredShield = previousEnvAddress("SEPOLIA_SHIELD_ADDRESS");

  const verifierTarget =
    configuredVerifier ??
    (getContractAddress({
      from: deployerAddress,
      nonce: BigInt(latestNonce),
    }) as Address);

  const registryNonce = configuredVerifier ? latestNonce : latestNonce + 1;
  const registryTarget =
    configuredRegistry ??
    (getContractAddress({
      from: deployerAddress,
      nonce: BigInt(registryNonce),
    }) as Address);

  if (!sameAddress(canonicalAddress("SEPOLIA_VERIFIER"), verifierTarget)) {
    throw new Error(
      "Canonical Sepolia verifier does not match deployment target. Run prepare-sepolia-deployment.mjs.",
    );
  }
  if (!sameAddress(canonicalAddress("SEPOLIA_REGISTRY"), registryTarget)) {
    throw new Error(
      "Canonical Sepolia registry does not match deployment target. Run prepare-sepolia-deployment.mjs.",
    );
  }

  console.log("Canonical Sepolia address preflight: PASS");

  // 1. Verifier
  let verifier = await reuse(
    viem,
    publicClient,
    configuredVerifier,
    "Groth16VerifierV2",
  );

  if (!verifier) {
    console.log("\n[1] Deploying Groth16VerifierV2...");
    const result = await viem.sendDeploymentTransaction(
      "protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2",
      [],
    );
    const hash = deploymentHash(result);
    console.log(`Deployment Tx: ${hash}`);
    const receipt = await waitForDeployment(publicClient, hash);
    if (!receipt.contractAddress) {
      throw new Error("Verifier deployment receipt has no contract address");
    }
    verifier = {
      address: getAddress(receipt.contractAddress) as Address,
      txHash: hash,
    };
  }

  if (!sameAddress(verifier.address, verifierTarget)) {
    throw new Error(
      `Verifier address mismatch: expected=${verifierTarget}, got=${verifier.address}`,
    );
  }

  // 2. Registry
  let registry = await reuse(
    viem,
    publicClient,
    configuredRegistry,
    "AegisNullifierRegistry",
  );

  if (!registry) {
    console.log("\n[2] Deploying AegisNullifierRegistry...");
    const result = await viem.sendDeploymentTransaction(
      "protocol/contracts/AegisNullifierRegistry.sol:AegisNullifierRegistry",
      [deployerAddress],
    );
    const hash = deploymentHash(result);
    console.log(`Deployment Tx: ${hash}`);
    const receipt = await waitForDeployment(publicClient, hash);
    if (!receipt.contractAddress) {
      throw new Error("Registry deployment receipt has no contract address");
    }
    registry = {
      address: getAddress(receipt.contractAddress) as Address,
      txHash: hash,
    };
  }

  if (!sameAddress(registry.address, registryTarget)) {
    throw new Error(
      `Registry address mismatch: expected=${registryTarget}, got=${registry.address}`,
    );
  }

  // 3. Shield
  let shield = await reuse(
    viem,
    publicClient,
    configuredShield,
    "AegisShieldV2",
  );

  if (!shield) {
    const shieldNonce = await publicClient.getTransactionCount({
      address: deployerAddress,
      blockTag: "latest",
    });
    const predictedShield = getContractAddress({
      from: deployerAddress,
      nonce: BigInt(shieldNonce),
    }) as Address;

    console.log("\n[3] Deploying AegisShieldV2...");
    const result = await viem.sendDeploymentTransaction(
      "protocol/contracts/AegisShieldV2.sol:AegisShieldV2",
      [verifier.address, deployerAddress, registry.address],
    );
    const hash = deploymentHash(result);
    console.log(`Deployment Tx: ${hash}`);
    const receipt = await waitForDeployment(publicClient, hash);
    if (!receipt.contractAddress) {
      throw new Error("Shield deployment receipt has no contract address");
    }
    shield = {
      address: getAddress(receipt.contractAddress) as Address,
      txHash: hash,
    };

    if (!sameAddress(shield.address, predictedShield)) {
      throw new Error(
        `Shield nonce/address mismatch: expected=${predictedShield}, got=${shield.address}`,
      );
    }
  }

  // 4. Registry authorization
  const registryContract = await viem.getContractAt(
    "protocol/contracts/AegisNullifierRegistry.sol:AegisNullifierRegistry",
    registry.address,
  );

  const authorized = await registryContract.read.authorizedConsumers([
    shield.address,
  ]);

  if (!authorized) {
    console.log("\n[4] Authorizing Shield...");
    const hash = await registryContract.write.setConsumerAuthorized([
      shield.address,
      true,
    ]);
    console.log(`Authorization Tx: ${hash}`);
    await waitForDeployment(publicClient, hash);
  } else {
    console.log("\n[4] Shield authorization: already active");
  }

  // 5. On-chain wiring validation
  const verifierContract = await viem.getContractAt(
    "protocol/contracts/Groth16VerifierV2.sol:Groth16VerifierV2",
    verifier.address,
  );
  const shieldContract = await viem.getContractAt(
    "protocol/contracts/AegisShieldV2.sol:AegisShieldV2",
    shield.address,
  );

  const [verifierCode, registryCode, shieldCode] = await Promise.all([
    publicClient.getBytecode({ address: verifier.address }),
    publicClient.getBytecode({ address: registry.address }),
    publicClient.getBytecode({ address: shield.address }),
  ]);

  if (!verifierCode || verifierCode === "0x") throw new Error("Verifier bytecode missing");
  if (!registryCode || registryCode === "0x") throw new Error("Registry bytecode missing");
  if (!shieldCode || shieldCode === "0x") throw new Error("Shield bytecode missing");

  const [storedVerifier, storedOperator, storedRegistry, storedAdmin, finalAuthorized] =
    await Promise.all([
      shieldContract.read.verifier(),
      shieldContract.read.operator(),
      shieldContract.read.nullifierRegistry(),
      registryContract.read.admin(),
      registryContract.read.authorizedConsumers([shield.address]),
    ]);

  if (!sameAddress(storedVerifier, verifier.address)) throw new Error("Shield verifier wiring mismatch");
  if (!sameAddress(storedOperator, deployerAddress)) throw new Error("Shield operator wiring mismatch");
  if (!sameAddress(storedRegistry, registry.address)) throw new Error("Shield registry wiring mismatch");
  if (!sameAddress(storedAdmin, deployerAddress)) throw new Error("Registry admin mismatch");
  if (!finalAuthorized) throw new Error("Shield authorization validation failed");

  void verifierContract;

  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const deploymentPath = path.join(DEPLOYMENTS_DIR, "sepolia.json");
  const metadata = {
    schemaVersion: 2,
    network: "sepolia",
    chainId,
    deployer: deployerAddress,
    verifier: verifier,
    registry,
    shield,
    shieldAuthorized: true,
    startingNonce: latestNonce,
    updatedAt: new Date().toISOString(),
  };

  const tmpPath = `${deploymentPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(metadata, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(tmpPath, deploymentPath);

  console.log("\n==========================================");
  console.log("Sepolia deployment completed successfully");
  console.log("==========================================");
  console.log(`Verifier: ${verifier.address}`);
  console.log(`Registry: ${registry.address}`);
  console.log(`Shield:   ${shield.address}`);
  console.log(`Metadata: ${deploymentPath}`);
}

main().catch((error) => {
  console.error("\nDEPLOYMENT FAILED");
  console.error(error);
  process.exitCode = 1;
});
