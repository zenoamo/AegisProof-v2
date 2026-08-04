// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[29] calldata pubSignals
    ) external view returns (bool);
}

/**
 * @title AegisShield
 * @notice Production Candidate - Final Hardened & Optimized Version
 * @dev Aligned with exact Canonical Signal Specification indices, optimized for
 *      Gas Griefing resistance (cheap checks first), permissionless submission,
 *      and decoupled Multisig governance.
 */
contract AegisShield {
    // --- Canonical Signal Indices (Aligned with Circom output) ---
    // snarkjs outputs public inputs first, then outputs.
    // See circuits/aegis_commit_core.circom for declaration order.
    //
    // --- Public Inputs ---
    uint256 private constant SIGNAL_SESSION_ID = 2;
    uint256 private constant SIGNAL_PURPOSE_ID = 3;
    //
    // --- Outputs (after 24 public inputs) ---
    uint256 private constant SIGNAL_COMMITMENT = 27; // Not used in logic, but defined for clarity
    uint256 private constant SIGNAL_NULLIFIER = 28;

    // --- Custom Errors for Gas Optimization ---
    error Unauthorized();
    error InvalidSessionId();
    error SessionAlreadyExists();
    error SessionNotFound();
    error SessionInactive();
    error PurposeMismatch();
    error InvalidPurposeId();
    error NullifierAlreadyUsed();
    error VerificationFailed();
    error ZeroAddressNotAllowed();

    struct Session {
        uint256 purposeId;
        bool active;
        uint64 registeredAt;
    }

    // --- State Variables ---
    IGroth16Verifier public immutable verifier;
    
    // Governance: Designed for Multisig / DAO
    address public governance;

    // Operator Registry (Multisig-managed)
    mapping(address => bool) public operators;

    // Session Registry: sessionId => Session
    mapping(uint256 => Session) public sessions;
    mapping(uint256 => bool) public sessionExists;

    // Nullifier Registry for Replay Protection
    mapping(uint256 => bool) public usedNullifiers;

    // Allowed Purpose Registry
    mapping(uint256 => bool) public allowedPurposes;

    // --- Events ---
    event SessionRegistered(uint256 indexed sessionId, uint256 indexed purposeId);
    event SessionDeactivated(uint256 indexed sessionId);
    event ProofVerifiedAndAccepted(uint256 indexed sessionId, uint256 indexed nullifier, address indexed submitter);
    event OperatorUpdated(address indexed operator, bool status);
    event GovernanceTransferred(address indexed oldGovernance, address indexed newGovernance);

    // --- Modifiers ---
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    // --- Constructor ---
    constructor(address _verifier, address initialOperator, address _governance) {
        if (_verifier == address(0) || initialOperator == address(0) || _governance == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        verifier = IGroth16Verifier(_verifier);
        governance = _governance;
        operators[initialOperator] = true;
        
        // Default allowed purpose setup
        allowedPurposes[0] = true;
    }

    // --- Governance Functions (Multisig Separated) ---

    function transferGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert ZeroAddressNotAllowed();
        emit GovernanceTransferred(governance, newGovernance);
        governance = newGovernance;
    }

    function setOperator(address operator, bool status) external onlyGovernance {
        if (operator == address(0)) revert ZeroAddressNotAllowed();
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    function setAllowedPurpose(uint256 purposeId, bool allowed) external onlyGovernance {
        allowedPurposes[purposeId] = allowed;
    }

    // --- Session Lifecycle Management ---

    function registerSession(uint256 sessionId, uint256 purposeId) external onlyOperator {
        if (sessionId == 0) revert InvalidSessionId();
        if (!allowedPurposes[purposeId]) revert InvalidPurposeId();
        if (sessionExists[sessionId]) revert SessionAlreadyExists();

        sessions[sessionId] = Session({
            purposeId: purposeId,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        sessionExists[sessionId] = true;

        emit SessionRegistered(sessionId, purposeId);
    }

    function deactivateSession(uint256 sessionId) external onlyOperator {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session memory s = sessions[sessionId];
        if (!s.active) revert SessionInactive();

        sessions[sessionId].active = false;

        emit SessionDeactivated(sessionId);
    }

    // --- Core Verification & Acceptance (Permissionless & Gas-Optimized Order) ---
    /// @notice Permissionless entry point. Executes cheap checks first to prevent Gas Griefing.
    /// @dev Execution Order:
    ///      1. Session Existence & Status Validation (Cheap storage reads)
    ///      2. Canonical Signal Binding check (Memory/Calldata checks vs session state)
    ///      3. Nullifier Unused Check (Storage read)
    ///      4. Groth16 Proof Verification (EXPENSIVE crypto operation executed LAST)
    ///      5. Nullifier Registration & Event Emission
    function verifyAndAccept(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[29] calldata signals,
        uint256 targetSessionId
    ) external {
        // 1. Session Existence & Status Validation
        if (!sessionExists[targetSessionId]) revert SessionNotFound();
        Session memory session = sessions[targetSessionId];
        if (!session.active) revert SessionInactive();

        // 2. Canonical Signal Bindings (Using precise indices)
        if (signals[SIGNAL_SESSION_ID] != targetSessionId) revert InvalidSessionId();
        if (signals[SIGNAL_PURPOSE_ID] != session.purposeId) revert PurposeMismatch();

        // 3. Nullifier Replay Protection Check
        uint256 nullifier = signals[SIGNAL_NULLIFIER];
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();

        // 4. Groth16 Proof Verification (Executed last to prevent DoS via invalid proofs)
        bool valid = verifier.verifyProof(pA, pB, pC, signals);
        if (!valid) revert VerificationFailed();

        // 5. Mark Nullifier as Used
        usedNullifiers[nullifier] = true;

        // 6. Success Emit
        emit ProofVerifiedAndAccepted(targetSessionId, nullifier, msg.sender);
    }
}