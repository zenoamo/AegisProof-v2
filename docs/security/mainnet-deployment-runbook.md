# Ethereum Mainnet deployment runbook

This repository is fail-closed until the production deployment is independently verified.

## Preconditions

- Production zkey and verification-key hashes match the committed ceremony evidence.
- `protocol/contracts/Groth16VerifierV2Production.sol` is generated from the finalized production zkey.
- The Mainnet canonical verifier and nullifier registry addresses are real deployed contracts and have been independently verified.
- The deployment operator address is known.
- `MAINNET_RPC_URL`, `AEGIS_MAINNET_CANONICAL_VERIFIER`, `AEGIS_MAINNET_CANONICAL_REGISTRY`, and `AEGIS_MAINNET_EXPECTED_DEPLOYER` are configured as protected GitHub Environment secrets/variables as appropriate.
- No private key or seed phrase is committed to the repository or pasted into chat.

## Read-only checks

Run:

```bash
npm ci --ignore-scripts
npm run check:mainnet-deploy-config
npm run validate:deployment-manifest
npm run test:deployment-manifest
npm run test:mainnet-readiness
npm run preflight:mainnet
```

The preflight performs RPC reads only. It must not broadcast a transaction.

`npm run preflight:mainnet` checks Mainnet RPC, chain ID 1, `verifierForChain(1)`, and that address's bytecode. With no `MAINNET_RPC_URL` the result is `NOT RUN` (exit 3), which is not an undeployed-verifier finding. `address(0)` is `Canonical verifier: NOT CONFIGURED`. A non-zero binding with no bytecode exits 1 with `FAIL canonical verifier address has no deployed bytecode`. Bytecode alone is not a pass: it must match the existing production verifier declaration, and any recorded manifest address or hash. The command does not write the manifest or print the RPC URL. Sepolia and localhost addresses are not substitutes.

## Deployment order

The canonical verifier and registry addresses must be finalized before enabling a production Shield deployment because `AegisShieldV2` fails closed unless its constructor arguments match `AegisCanonicalRegistry` for the target chain.

Do not substitute Hardhat localhost addresses on Mainnet.

After the actual on-chain deployment and independent bytecode/address verification:

1. Record the deployed Production Verifier address.
2. Record the deployed canonical nullifier registry address.
3. Deploy `AegisShieldV2` with those canonical addresses and the intended operator.
4. Authorize the Shield in the canonical nullifier registry.
5. Verify constructor state and deployed bytecode.
6. Record the production addresses and bytecode SHA-256 values in `deployments/manifest.json`.
7. Only then change the manifest to `deployable: true` / `deploymentStatus: production`.
8. Re-run all deployment and security gates.

## Safety rule

The current `scripts/deploy.ts` remains a localhost development deployment script. Do not point it at Ethereum Mainnet.
