#!/usr/bin/env bash
# ============================================================================
# Native Groth16 prover wrapper (rapidsnark) — Phase 8.10 PoC
# ----------------------------------------------------------------------------
# Uses production.zkey + canonical witness input via prove.js with
# AEGIS_PROVER=rapidsnark. Requires rapidsnark prover binary (RAPIDSNARK_BIN).
#
# Usage:
#   ./scripts/prove_native.sh
#   ./scripts/prove_native.sh --input artifacts/phase2/tests/input_v2.json
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AEGIS_PROVER=rapidsnark

exec node "${ROOT}/scripts/prove.js" "$@"
