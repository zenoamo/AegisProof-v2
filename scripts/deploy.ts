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
  shieldAddress: string
) {
  const existing =
    fs.existsSync(ENV_PATH)
      ? fs.readFileSync(
          ENV_PATH,
          "utf8"
        )
      : "";

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
      "contracts/Groth16Verifier29.sol:Groth16Verifier"
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
  // 3. Deploy AegisShield
  // ==========================================

  console.log("");
  console.log(
    "[2] Deploying AegisShield"
  );

  const shield =
    await viem.deployContract(
      "AegisShield",
      [
        verifier.address,
        deployer.account.address,
      ]
    );

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
    shield.address
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
    "Groth16Verifier29:",
    verifier.address
  );

  console.log(
    "AegisShield:",
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