// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AegisNullifierRegistry
/// @notice Chain-wide replay registry shared by AegisShield deployments.
/// @dev Only explicitly registered Shield contracts may consume nullifiers.
///      This prevents a malicious third party from front-running a nullifier
///      and griefing an otherwise valid proof.
contract AegisNullifierRegistry {
    address public immutable admin;

    mapping(address => bool) public authorizedConsumers;
    mapping(uint256 => bool) public usedNullifiers;

    event ConsumerAuthorized(address indexed consumer, bool authorized);
    event NullifierConsumed(uint256 indexed nullifier, address indexed consumer);

    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin");
        admin = _admin;
    }

    function setConsumerAuthorized(address consumer, bool authorized) external {
        require(msg.sender == admin, "Unauthorized caller");
        require(consumer != address(0), "Invalid consumer");
        authorizedConsumers[consumer] = authorized;
        emit ConsumerAuthorized(consumer, authorized);
    }

    function consume(uint256 nullifier) external {
        require(authorizedConsumers[msg.sender], "Unauthorized consumer");
        require(!usedNullifiers[nullifier], "Nullifier already used");
        usedNullifiers[nullifier] = true;
        emit NullifierConsumed(nullifier, msg.sender);
    }
}
