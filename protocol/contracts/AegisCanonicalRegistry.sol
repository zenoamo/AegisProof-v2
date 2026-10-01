// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AegisCanonicalRegistry
/// @notice Chain-specific canonical AegisNullifierRegistry addresses.
/// @dev v2 currently has one supported deployment chain: Hardhat 31337.
///      Production chain addresses MUST be added here before deployment.
///      Returning address(0) for an unsupported chain makes the Shield
///      constructor fail closed rather than accepting an arbitrary registry.
library AegisCanonicalRegistry {
    uint256 internal constant HARDHAT_CHAIN_ID = 31337;

    // Determined from the documented localhost deployment order:
    // deployer nonce 0 = verifier, nonce 1 = registry.
    address internal constant HARDHAT_REGISTRY =
        0xe7f1725e7734ce288f8367e1bb143e90bb3f0512;

    function forChain(uint256 chainId) internal pure returns (address) {
        if (chainId == HARDHAT_CHAIN_ID) {
            return HARDHAT_REGISTRY;
        }
        return address(0);
    }
}
