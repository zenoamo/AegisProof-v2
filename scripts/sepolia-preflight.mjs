#!/usr/bin/env node
// Read-only Sepolia canonical verifier preflight.
// Does not print SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, or authorization material.
// Does not write files or broadcast transactions.
// address(0) from verifierForChain(11155111) is NOT CONFIGURED exit 3.
// Missing bytecode is FAIL exit 1.
import { runSepoliaPreflight } from "./lib/sepolia-preflight.mjs";

const result = await runSepoliaPreflight(process.env);
const sink = result.exitCode === 1 ? console.error : console.log;
for (const line of result.lines) sink(line);
process.exit(result.exitCode);
