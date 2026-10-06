#!/usr/bin/env node
// Read-only Ethereum Mainnet canonical verifier preflight.
// Does not print MAINNET_RPC_URL, private keys, or authorization material.
// Does not write files or broadcast transactions.
// Missing bytecode is FAIL exit 1. A missing RPC URL is NOT RUN exit 3.
import { runMainnetPreflight } from "./lib/mainnet-preflight.mjs";

const result = await runMainnetPreflight(process.env);
const sink = result.exitCode === 1 ? console.error : console.log;
for (const line of result.lines) sink(line);
process.exit(result.exitCode);
