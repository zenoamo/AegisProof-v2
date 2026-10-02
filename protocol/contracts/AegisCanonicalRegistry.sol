// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AegisCanonicalRegistry
/// @notice Chain-specific canonical Aegis deployment addresses.
/// @dev Mainnet addresses are generated from the approved deterministic
///      deployment plan, but remain reference-only until deployment and
///      independent verification are complete.
library AegisCanonicalRegistry {
    uint256 internal constant HARDHAT_CHAIN_ID = 31337;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    address internal constant HARDHAT_VERIFIER =
        0x5fbdb2315678afecb367f032d93f642f64180aa3;

    address internal constant HARDHAT_REGISTRY =
        0xe7f1725e7734ce288f8367e1bb143e90bb3f0512;

    address internal constant MAINNET_VERIFIER =
        0x014468895DB46636dCEED11A0981c3dB3d8BE146;

    address internal constant MAINNET_REGISTRY =
        0x5fECFdDE220Ecc5349f16547fa3c49fBc36A62f6;

    function verifierForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
            return HARDHAT_VERIFIER;
        }
        // Mainnet addresses are counterfactual until deployment and
        // independent verification. Keep the lookup fail-closed.
        return address(0);
    }

    function registryForChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
            return HARDHAT_REGISTRY;
        }
        // Mainnet addresses are counterfactual until deployment and
        // independent verification. Keep the lookup fail-closed.
        return address(0);
    }

    function forChain(uint256 chainId) internal pure returns (address) {
        return registryForChain(chainId);
    }
}
