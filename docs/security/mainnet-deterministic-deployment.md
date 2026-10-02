# Mainnet deterministic deployment plan

This plan is a read-only address calculation. It does not deploy contracts or broadcast transactions.

## Deployment sequence

For a single deployer account, reserve three contiguous nonces:

1. N: Groth16VerifierV2Production
2. N+1: AegisNullifierRegistry(admin=deployer)
3. N+2: AegisShieldV2(verifier, operator=deployer, nullifierRegistry)

The CREATE addresses are derived from the deployer address and nonce. The predicted addresses must be fixed before the canonical Solidity registry is generated.

## Read-only command

Set AEGIS_MAINNET_EXPECTED_DEPLOYER to the public deployer address and AEGIS_MAINNET_DEPLOYER_NONCE to the nonce that will be used for the verifier deployment, then run:

npm run test:mainnet-deployment-plan
node scripts/mainnet-deployment-plan.mjs

The script prints the three predicted addresses and explicitly states that no transaction was created or broadcast.

## Nonce safety

The three deployment transactions must use contiguous nonces. No unrelated transaction may consume N, N+1, or N+2 between planning and deployment.

Before broadcasting, independently re-read the deployer's pending/latest nonce from the intended Mainnet RPC and confirm it still equals N.

If the nonce changes, discard the plan and recompute it. Never manually substitute addresses.

## Canonical registry binding

The predicted verifier and registry addresses become inputs to the Mainnet-specific canonical registry source. The source must be regenerated and reviewed before the Shield deployment.

Do not write predicted addresses into deployments/manifest.json as production evidence. The manifest remains fail-closed until the contracts are actually deployed and their bytecode/address evidence is independently verified.

## Private-key safety

The planning step requires only the public deployer address and nonce. It must not require or accept a private key.

The actual signing step is intentionally outside this read-only planning script.
