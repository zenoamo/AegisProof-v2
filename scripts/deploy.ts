import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(
  __dirname,
  ".."
);

const LOCAL_DEPLOYMENT_INFO_PATH = path.join(
  PROJECT_ROOT,
  "deployments",
  "localhost.json"
);

const ENV_PATH = path.join(
  PROJECT_ROOT,
  ".env"
);

function upsertEnvValue(
  content: string,
  key: string,
  value: string
) {
  const line = `${key}=${value}`;

  const pattern = new RegExp(
    `^${key}=.*$`,
    "m"
  );

  if (pattern.test(content)) {
    return content.replace(
      pattern,
      line
    );
  }

  const normalized =
    content.length === 0 ||
    content.endsWith("\n")
      ? content
      : `${content}\n`;

  return `${normalized}${line}\n`;
}

function syncLocalhostAddresses(
  verifierAddress: string,
  shieldAddress: string,
  registryAddress: string
) {
  let existing = "";
  try {
    existing = fs.readFileSync(
      ENV_PATH,
      "utf8"
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  let updated = existing;

  updated = upsertEnvValue(
    updated,
    "VERIFIER_ADDRESS",
    verifierAddress
  );

  updated = upsertEnvValue(
    updated,
    "SHIELD_ADDRESS",
    shieldAddress
  );

  updated = upsertEnvValue(
    updated,
    "NULLIFIER_REGISTRY_ADDRESS",
    registryAddress
  );

  fs.writeFileSync(
    ENV_PATH,
    updated
  );
}

async function main() {
  // ==========================================
  // Connect localhost
  // ==========================================

  const { viem } =
    await network.connect({
      network: "localhost",
    });

  const [deployer] =
    await viem.getWalletClients();

  const publicClient =
    await viem.getPublicClient();

  const chainId =
    await publicClient.getChainId();

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "AegisProof Localhost Deployment"
  );
  console.log(
    "=========================================="
  );

  console.log(
    "Deployer:",
    deployer.account.address
  );

  console.log(
    "Chain ID:",
    chainId
  );

  // ==========================================
  // 1. Deploy Groth16Verifier29
  // ==========================================

  console.log("");
  console.log(
    "[1] Deploying Groth16Verifier29"
  );

  const verifier =
    await viem.deployContract(
      "contracts/Groth16VerifierV2.sol:Groth16VerifierV2"
    );

  console.log(
    "Verifier:",
    verifier.address
  );

  // ==========================================
  // 2. Verify Verifier Bytecode
  // ==========================================

  const verifierCode =
    await publicClient.getBytecode({
      address:
        verifier.address,
    });

  if (
    !verifierCode ||
    verifierCode === "0x"
  ) {
    throw new Error(
      "Verifier deployment failed: no bytecode found"
    );
  }

  console.log(
    "Verifier bytecode: OK"
  );

  // ==========================================
  // 3. Deploy chain-wide nullifier registry
  // ==========================================

  console.log("");
  console.log(
    "[2] Deploying AegisShield"
  );

  const registry =
    await viem.deployContract(
      "AegisNullifierRegistry",
      [deployer.account.address]
    );

  const canonicalRegistryAddress =
    "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

  if (
    registry.address.toLowerCase() !==
    canonicalRegistryAddress
  ) {
    throw new Error(
      `Canonical registry mismatch on localhost: expected ${canonicalRegistryAddress}, got ${registry.address}`
    );
  }

  // ==========================================
  // 4. Deploy AegisShieldV2
  // ==========================================

  const shield =
    await viem.deployContract(
      "AegisShieldV2",
      [verifier.address, deployer.account.address, registry.address]
    );

  await registry.write.setConsumerAuthorized([shield.address, true]);

  const authorized = await registry.read.authorizedConsumers([shield.address]);
  if (!authorized) throw new Error("Registry authorization failed for AegisShieldV2");

  console.log(
    "Shield:",
    shield.address
  );

  // ==========================================
  // 4. Verify Shield Bytecode
  // ==========================================

  const shieldCode =
    await publicClient.getBytecode({
      address:
        shield.address,
    });

  if (
    !shieldCode ||
    shieldCode === "0x"
  ) {
    throw new Error(
      "AegisShield deployment failed: no bytecode found"
    );
  }

  console.log(
    "Shield bytecode: OK"
  );

  // ==========================================
  // 5. Verify Constructor State
  // ==========================================

  console.log("");
  console.log(
    "[3] Verifying AegisShield state"
  );

  const storedVerifier =
    String(
      await shield.read.verifier()
    );

  const storedOperator =
    String(
      await shield.read.operator()
    );

  const storedRegistry =
    String(
      await shield.read.nullifierRegistry()
    );

  console.log(
    "Expected verifier:",
    verifier.address
  );

  console.log(
    "Stored verifier:",
    storedVerifier
  );

  console.log(
    "Expected operator:",
    deployer.account.address
  );

  console.log(
    "Stored operator:",
    storedOperator
  );

  if (
    storedVerifier.toLowerCase() !==
    verifier.address.toLowerCase()
  ) {
    throw new Error(
      `Verifier mismatch: expected ${verifier.address}, got ${storedVerifier}`
    );
  }

  if (
    storedOperator.toLowerCase() !==
    deployer.account.address.toLowerCase()
  ) {
    throw new Error(
      `Operator mismatch: expected ${deployer.account.address}, got ${storedOperator}`
    );
  }

  if (storedRegistry.toLowerCase() !== registry.address.toLowerCase()) {
    throw new Error(`Nullifier registry mismatch: expected ${registry.address}, got ${storedRegistry}`);
  }

  console.log(
    "AegisShield constructor state: OK"
  );

  // ==========================================
  // 6. Save Deployment Information
  // ==========================================

  fs.mkdirSync(
    path.dirname(
      LOCAL_DEPLOYMENT_INFO_PATH
    ),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    LOCAL_DEPLOYMENT_INFO_PATH,
    JSON.stringify(
      {
        network:
          "localhost",

        chainId,

        deployer:
          deployer.account.address,

        verifierAddress:
          verifier.address,

        nullifierRegistryAddress:
          registry.address,

        shieldAddress:
          shield.address,
      },
      null,
      2
    ) + "\n"
  );

  // ==========================================
  // 7. Sync .env
  // ==========================================

  syncLocalhostAddresses(
    verifier.address,
    shield.address,
    registry.address
  );

  // ==========================================
  // 8. Final Output
  // ==========================================

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "Deployment completed successfully"
  );
  console.log(
    "=========================================="
  );

  console.log(
    "Deployer:",
    deployer.account.address
  );

  console.log(
    "Chain ID:",
    chainId
  );

  console.log(
    "Groth16VerifierV2:",
    verifier.address
  );

  console.log(
    "AegisShieldV2:",
    shield.address
  );

  console.log(
    "Stored verifier:",
    storedVerifier
  );

  console.log(
    "Stored operator:",
    storedOperator
  );

  console.log(
    "Deployment file:",
    LOCAL_DEPLOYMENT_INFO_PATH
  );

  console.log(
    "Updated .env:",
    ENV_PATH
  );

  console.log(
    "=========================================="
  );
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "DEPLOYMENT FAILED"
    );
    console.error(error);
    process.exitCode = 1;
  }
);