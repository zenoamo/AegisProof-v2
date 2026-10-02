import assert from "node:assert/strict";
import test from "node:test";

import { validateMainnetReadiness } from "../../scripts/validate-mainnet-readiness.mjs";

const validEntry = {
  environment: "production",
  deployable: true,
  canonicalVerifierAddress: "0x1111111111111111111111111111111111111111",
  canonicalRegistryAddress: "0x2222222222222222222222222222222222222222",
  productionVerifierAddress: "0x3333333333333333333333333333333333333333",
  productionShieldAddress: "0x4444444444444444444444444444444444444444",
  verifierBytecodeSha256: "a".repeat(64),
  registryBytecodeSha256: "b".repeat(64),
};

test("accepts a fully populated Ethereum Mainnet production entry", () => {
  assert.deepEqual(
    validateMainnetReadiness({
      schemaVersion: 1,
      protocol: "AegisProof",
      deploymentStatus: "production",
      chains: { "1": validEntry },
    }),
    [],
  );
});

test("rejects Mainnet when deployment metadata is incomplete", () => {
  const errors = validateMainnetReadiness({
    schemaVersion: 1,
    protocol: "AegisProof",
    deploymentStatus: "production",
    chains: {
      "1": {
        ...validEntry,
        productionShieldAddress: null,
      },
    },
  });

  assert.ok(errors.some((error) => error.includes("productionShieldAddress")));
});

test("rejects a non-production environment on chain 1", () => {
  const errors = validateMainnetReadiness({
    deploymentStatus: "not-deployed",
    chains: {
      "1": {
        ...validEntry,
        environment: "local",
        deployable: false,
      },
    },
  });

  assert.ok(errors.some((error) => error.includes("environment")));
  assert.ok(errors.some((error) => error.includes("deployable")));
  assert.ok(errors.some((error) => error.includes("deploymentStatus")));
});
