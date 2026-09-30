// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// GENERATED FILE — do not edit. Source: protocol/specs
// Regenerate: node scripts/codegen_signals.mjs
library AegisSignals {
    uint256 internal constant PROTOCOL_VERSION = 2;
    uint256 internal constant DOMAIN_NULLIFIER_V2 = 20148535406093122816468858649806210947444276317485944952083069500197208546562; // NUS-derived
    uint256 internal constant MAX_AGE_SECONDS = 86400;
    uint256 internal constant CLOCK_SKEW_SECONDS = 300;
    uint256 internal constant N_PUBLIC_SIGNALS = 30;

    // Canonical public-signal indices (pubSignals array positions)
    uint256 internal constant SIGNAL_EXPECTED_PROMPT_ROOT = 0;
    uint256 internal constant SIGNAL_EXPECTED_OUTPUT_ROOT = 1;
    uint256 internal constant SIGNAL_SESSION_ID = 2;
    uint256 internal constant SIGNAL_PURPOSE_ID = 3;
    uint256 internal constant SIGNAL_WEIGHTS_HASH = 4;
    uint256 internal constant SIGNAL_TOKENIZER_HASH = 5;
    uint256 internal constant SIGNAL_SYSTEM_PROMPT_HASH = 6;
    uint256 internal constant SIGNAL_LORA_HASH = 7;
    uint256 internal constant SIGNAL_ADAPTER_HASH = 8;
    uint256 internal constant SIGNAL_SAFETY_LAYER_HASH = 9;
    uint256 internal constant SIGNAL_QUANTIZATION_HASH = 10;
    uint256 internal constant SIGNAL_PRECISION_HASH = 11;
    uint256 internal constant SIGNAL_RUNTIME_HASH = 12;
    uint256 internal constant SIGNAL_DRIVER_HASH = 13;
    uint256 internal constant SIGNAL_TEMPERATURE = 14;
    uint256 internal constant SIGNAL_TOP_P = 15;
    uint256 internal constant SIGNAL_TOP_K = 16;
    uint256 internal constant SIGNAL_SEED = 17;
    uint256 internal constant SIGNAL_REPETITION_PENALTY = 18;
    uint256 internal constant SIGNAL_PRESENCE_PENALTY = 19;
    uint256 internal constant SIGNAL_FREQUENCY_PENALTY = 20;
    uint256 internal constant SIGNAL_MAX_TOKENS = 21;
    uint256 internal constant SIGNAL_CHAIN_ID = 22;
    uint256 internal constant SIGNAL_PROTOCOL_VERSION = 23;
    uint256 internal constant SIGNAL_TIMESTAMP = 24;
    uint256 internal constant SIGNAL_MODEL_MANIFEST_COMMITMENT = 25;
    uint256 internal constant SIGNAL_EXECUTION_ENV_COMMITMENT = 26;
    uint256 internal constant SIGNAL_GENERATION_COMMITMENT = 27;
    uint256 internal constant SIGNAL_COMMITMENT = 28;
    uint256 internal constant SIGNAL_NULLIFIER = 29;
}
