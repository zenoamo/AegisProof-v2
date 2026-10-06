#!/usr/bin/env node
// Confirm a Sepolia RPC connection and a signer derived from SEPOLIA_PRIVATE_KEY.
// Prints chainId, address, and native balance. Does not print the key or RPC URL.
import { verifySepoliaConnection } from "./lib/sepolia-connection.mjs";

const result = await verifySepoliaConnection(process.env);
const sink = result.exitCode === 0 ? console.log : console.error;
for (const line of result.lines) sink(line);
process.exit(result.exitCode);
