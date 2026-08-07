# AegisProof Formal Models

Lean 4 specifications for protocol-level properties of AegisProof. These models cover state-machine invariants and signal binding; they do not model Groth16 cryptography, EVM execution, or Solidity storage layout.

## Modules

| File | Scope |
|------|-------|
| `AegisShield.lean` | AegisShield state-machine invariants |
| `AegisSignalBinding.lean` | Correspondence between Circom inputs, public signal order, and Solidity `pubSignals[]` indexes |
| `AegisProof/Basic.lean` | Shared definitions |
| `AegisProof/AegisSignals.lean` | Signal layout definitions |

## Build

Requires [Lean 4](https://lean-lang.org/) and [Lake](https://github.com/leanprover/lean4).

```bash
cd formal
lake build
```

Run the executable:

```bash
lake exe aegisproof
```

Toolchain version is pinned in `lean-toolchain`.

## CI

GitHub Actions runs Lean builds via `.github/workflows/lean_action_ci.yml`.

## Scope limits

- Protocol-level properties only
- No on-chain bytecode or circuit semantics
- TODO: document relationship to production contracts and whether proofs are complete or partial
