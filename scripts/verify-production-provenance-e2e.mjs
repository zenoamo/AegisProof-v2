#!/usr/bin/env node
// Production provenance final E2E.
// Without an external production credential this exits NOT VERIFIED and does not sign.
import { loadManifest, DEFAULT_MANIFEST_PATH } from "./lib/artifact-provenance.mjs";
import { runProductionProvenanceE2E } from "./lib/production-provenance-e2e.mjs";

const manifest = loadManifest(DEFAULT_MANIFEST_PATH);
const result = await runProductionProvenanceE2E(manifest);
const sink = result.exitCode === 0 ? console.log : console.error;
for (const line of result.lines) sink(line);
process.exit(result.exitCode);
