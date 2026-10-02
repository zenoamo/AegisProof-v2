import fs from "node:fs";
import assert from "node:assert/strict";
import { MANIFEST_PATH, validateManifest } from "../../scripts/validate-deployment-manifest.mjs";

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

assert.deepEqual(validateManifest(manifest), []);

const partialProduction = structuredClone(manifest);
partialProduction.chains["11155111"] = {
  environment: "testnet",
  deployable: false,
  canonicalVerifierAddress: "0x0000000000000000000000000000000000000001",
  canonicalRegistryAddress: "0x0000000000000000000000000000000000000002",
  productionVerifierAddress: "0x0000000000000000000000000000000000000003",
  productionShieldAddress: null,
  verifierBytecodeSha256: null,
  registryBytecodeSha256: null,
};
assert.ok(
  validateManifest(partialProduction).some((error) =>
    error.includes("production deployment fields require deployable=true"),
  ),
);

const incompleteDeployable = structuredClone(manifest);
incompleteDeployable.deploymentStatus = "testnet";
incompleteDeployable.chains["11155111"] = {
  environment: "testnet",
  deployable: true,
  canonicalVerifierAddress: "0x0000000000000000000000000000000000000001",
  canonicalRegistryAddress: "0x0000000000000000000000000000000000000002",
  productionVerifierAddress: null,
  productionShieldAddress: null,
  verifierBytecodeSha256: null,
  registryBytecodeSha256: null,
};
const incompleteErrors = validateManifest(incompleteDeployable);
assert.ok(
  incompleteErrors.some((error) =>
    error.includes("deployable entry requires productionVerifierAddress"),
  ),
);
assert.ok(
  incompleteErrors.some((error) =>
    error.includes("deployable entry requires verifierBytecodeSha256"),
  ),
);

const falseProduction = structuredClone(manifest);
falseProduction.deploymentStatus = "production";
assert.ok(
  validateManifest(falseProduction).some((error) =>
    error.includes("production deploymentStatus requires at least one deployable production chain"),
  ),
);

console.log("Deployment manifest readiness regression: PASS");
