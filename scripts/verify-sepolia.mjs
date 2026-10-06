#!/usr/bin/env node
// Confirm Sepolia RPC chain id 11155111 and a signer from SEPOLIA_PRIVATE_KEY.
// Prints status lines and, on success, the signer address.
// Does not print the private key, its length, or the RPC URL.
// Does not write files. This is not a production provenance check.
import { verifySepoliaConnection } from "./lib/sepolia-connection.mjs";

const result = await verifySepoliaConnection(process.env);
const sink = result.exitCode === 1 ? console.error : console.log;
for (const line of result.lines) sink(line);
process.exit(result.exitCode);
