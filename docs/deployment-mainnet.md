# AegisProof Production Deployment Plan — Ethereum Mainnet

**Status:** Readiness documentation only — no Mainnet deployment is performed or authorized by this repository.  
**Production VK hash:** `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`

> This document is a review checklist, not an executable deployment runbook. The repository intentionally does not contain a current Mainnet deployment command. Any future deployment requires explicit human authorization and independently reviewed tooling.

## Pre-deployment requirements

1. Verify the production zkey hash:
   `ce5a3d308868f2fe7a6a8e3b68d717c3217f84b0ddfbb3dc155338b9be4d6571`
2. Verify the production VK hash:
   `d012bd29ff6e4c44b4c656c7af6b289c5c8286a1554ce7b2b8fd1a7d3c67d2ec`
3. Confirm the generated production verifier still has 30 public inputs / 31 IC points.
4. Independently review the trusted-setup/ceremony evidence.
5. Add the authorized chain entry to `deployments/manifest.json` with independently verified registry, verifier, Shield, and bytecode hashes.
6. Add the chain's canonical registry address to `AegisCanonicalRegistry` before deploying any Shield.
7. Validate the manifest:

```bash
npm run validate:deployment-manifest
```

## Required deployment topology

For a supported chain:

1. Deploy the production verifier generated from the authorized production zkey.
2. Deploy exactly one canonical `AegisNullifierRegistry` for the chain.
3. Deploy `AegisShieldV2` using that chain's pinned canonical registry.
4. Authorize the Shield in the registry.
5. Record independently verified addresses and bytecode hashes in the deployment manifest.
6. Run the production on-chain regression suite against the deployed addresses.
7. Re-run manifest validation and preserve the deployment evidence.

**Verifier identity:** `AegisShieldV2` currently accepts a nonzero verifier address and stores it immutably. The repository tracks the intended production verifier through deployment governance and the manifest; no production verifier address is hardcoded until an authorized deployment exists.

## Operational requirements

- Use HSM/MPC-backed signing where feasible.
- Keep private keys and RPC credentials out of Git.
- Use independent review for the deployment transaction parameters.
- Verify the deployed bytecode against the reviewed artifacts.
- Monitor proof acceptance/rejection, registry consumption, operator actions, and unexpected reverts.

## Rollback / incident response

The contracts are immutable. A remediation deployment would be a new Shield instance, coordinated through protocol versioning and operator governance. Follow `docs/incident-response.md` and `docs/key-management-policy.md`.

## Current status

There is currently **no Mainnet deployment recorded in `deployments/manifest.json`**. Do not infer a live deployment from this document.

## References

- Protocol SSoT: `specs/aegis-protocol.v2.json`
- Deployment manifest: `deployments/manifest.json`
- Deployment checklist: `docs/deployment-checklist.md`
- Security model: `docs/security-model.md`
