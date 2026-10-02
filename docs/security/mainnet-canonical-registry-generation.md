# Mainnet canonical registry generation

This workflow binds the Mainnet \`AegisShieldV2\` constructor to the exact
Production Verifier and canonical nullifier registry addresses planned for the
deployment.

## Why this exists

\`AegisShieldV2\` fails closed unless its verifier and nullifier registry match
the chain-specific values returned by \`AegisCanonicalRegistry\`.

For Mainnet, those values are derived from one deployer and three contiguous
CREATE nonces:

1. \`N\` — \`Groth16VerifierV2Production\`
2. \`N+1\` — \`AegisNullifierRegistry\`
3. \`N+2\` — \`AegisShieldV2\`

The predicted addresses are therefore deterministic before any transaction is
broadcast.

## Generate

Set only the public deployer address and the intended starting nonce:

\`\`\`bash
AEGIS_MAINNET_EXPECTED_DEPLOYER=0x... \\
AEGIS_MAINNET_DEPLOYER_NONCE=... \\
npm run generate:mainnet-canonical-registry
\`\`\`

The generator writes:

\`\`\`text
protocol/contracts/AegisCanonicalRegistry.sol
\`\`\`

and reports the predicted Mainnet Verifier and Registry addresses.

It never accepts a private key and never creates or broadcasts a transaction.

## Required review before deployment

After generation, verify all of the following:

- Mainnet Verifier address equals CREATE(deployer, N).
- Mainnet Registry address equals CREATE(deployer, N+1).
- Mainnet Shield address equals CREATE(deployer, N+2).
- Hardhat 31337 canonical fixtures are unchanged.
- \`Groth16VerifierV2Production.sol\` is the production verifier.
- Production zkey / verification-key hashes remain unchanged.
- The deployer pending/latest nonce still equals \`N\`.
- No unrelated transaction can consume \`N\`, \`N+1\`, or \`N+2\`.

If the deployer nonce changes, discard the generated source and regenerate the
plan. Do not manually edit any predicted address.

## After deployment

Only after the three transactions are confirmed on Ethereum Mainnet:

1. Read the actual contract addresses from the deployment receipts.
2. Verify deployed bytecode at each address.
3. Confirm the actual addresses equal the deterministic plan.
4. Independently verify the Production Verifier bytecode/artifact identity.
5. Set \`AEGIS_MAINNET_CANONICAL_VERIFIER\` to the verified Verifier address in
   the GitHub \`production\` Environment.
6. Set \`AEGIS_MAINNET_CANONICAL_REGISTRY\` and
   \`AEGIS_MAINNET_EXPECTED_DEPLOYER\` to their independently verified values.
7. Keep \`deployments/manifest.json\` fail-closed until the on-chain evidence and
   bytecode hashes are recorded.

Never put a private key or seed phrase in repository files, GitHub issues,
pull requests, or chat.
