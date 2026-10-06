#!/usr/bin/env node
// Static Frozen Core hash check. Independent of production.zkey.
// PASS here is not Groth16 regression PASS.
import { verifyFrozenCoreArtifactIntegrity } from "./lib/groth16-regression-gate.mjs";

const result = verifyFrozenCoreArtifactIntegrity();
if (!result.ok) {
  console.error("Frozen Core artifact integrity: FAIL");
  for (const error of result.errors) console.error(`FAIL ${error}`);
  process.exit(1);
}

console.log("Frozen Core artifact integrity: PASS");
console.log("Groth16 regression is a separate result and was not executed by this command.");
