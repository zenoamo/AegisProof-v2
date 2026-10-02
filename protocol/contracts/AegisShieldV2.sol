// ===========================================================================
// DEVELOPMENT CONTRACT — pairs with the development Groth16VerifierV2
// (single-contribution dev zkey). NEVER deploy against real value.
// Production deployment is a Phase 4 deliverable backed by the production
// multi-contributor + beacon trusted setup.
//
// Policy source of truth: specs/aegis-protocol.v2.json (contractPolicy).
// Signal indices/constants come from the SSoT-generated library
// contracts/generated/AegisSignals.sol — NEVER hardcode indices here.
// ===========================================================================

import { AegisSignals as S } from "./generated/AegisSignals.sol";
import { AegisCanonicalRegistry } from "./AegisCanonicalRegistry.sol";

interface IAegisVerifierV2 {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[30] calldata pubSignals
    ) external view returns (bool);
}

interface IAegisNullifierRegistry {
    function consume(uint256 nullifier) external;
}

contract AegisShieldV2 {

    // ==========================================
    // Cross-contract deployment domain
    // ==========================================
    // v2's frozen nullifier intentionally does not include address(this).
    // Cross-deployment replay is therefore prevented by the shared registry
    // below rather than by changing the 30-signal circuit.
    bytes32 public constant DEPLOYMENT_DOMAIN =
        keccak256("AEGIS_SHIELD_V2");

    uint256 public constant SUPPORTED_PROTOCOL_VERSION =
        S.PROTOCOL_VERSION;

    // ==========================================
    // Verifier + operator
    // ==========================================

    IAegisVerifierV2 public immutable verifier;
    IAegisNullifierRegistry public immutable nullifierRegistry;
    address public immutable operator;

    // ==========================================
    // Registries
    // ==========================================

    // Kept as contract-local state for backwards-compatible observability.
    // Global replay protection is enforced by nullifierRegistry.
    mapping(uint256 => bool) public usedNullifiers;

    mapping(uint256 => bool) public allowedPurposes;

    mapping(uint256 => bool) public sessionExists;

    struct Session {
        uint256 purposeId;
        bool active;
    }

    mapping(uint256 => Session) public sessions;

    // ==========================================
    // Events
    // ==========================================

    event ProofAccepted(
        uint256 indexed sessionId,
        uint256 indexed commitment,
        uint256 indexed nullifier
    );

    event SessionRegistered(
        uint256 indexed sessionId,
        uint256 indexed purposeId
    );

    event SessionDeactivated(uint256 indexed sessionId);

    event PurposeAllowedUpdated(uint256 indexed purposeId, bool allowed);

    // ==========================================
    // Constructor
    // ==========================================

    constructor(
        address _verifier,
        address _operator,
        address _nullifierRegistry
    ) {
        require(_verifier != address(0), "Invalid verifier");
        require(_operator != address(0), "Invalid operator");
        require(_nullifierRegistry != address(0), "Invalid nullifier registry");

        address canonicalVerifier =
            AegisCanonicalRegistry.verifierForChain(block.chainid);
        address canonicalRegistry =
            AegisCanonicalRegistry.registryForChain(block.chainid);
        require(canonicalVerifier != address(0), "Unsupported chain");
        require(
            _verifier == canonicalVerifier,
            "Non-canonical verifier"
        );
        require(
            _nullifierRegistry == canonicalRegistry,
            "Non-canonical nullifier registry"
        );

        verifier = IAegisVerifierV2(_verifier);
        operator = _operator;
        nullifierRegistry = IAegisNullifierRegistry(_nullifierRegistry);

        // Baseline allowed purposes (carried over from v1 registry).
        allowedPurposes[0] = true;
        allowedPurposes[1] = true;
        allowedPurposes[
            13903908139708007762322057526461532999124428646935356283413770512549625280792
        ] = true;
    }

    // ==========================================
    // Purpose administration (operator only)
    // ==========================================

    function setPurposeAllowed(uint256 purposeId, bool allowed) external {
        require(msg.sender == operator, "Unauthorized caller");
        allowedPurposes[purposeId] = allowed;
        emit PurposeAllowedUpdated(purposeId, allowed);
    }

    // ==========================================
    // Session registration (operator only)
    // ==========================================

    function registerSession(uint256 sessionId, uint256 purposeId) external {
        require(msg.sender == operator, "Unauthorized caller");
        require(sessionId != 0, "Invalid session ID");
        require(!sessionExists[sessionId], "Session already exists");
        require(allowedPurposes[purposeId], "Purpose not allowed");

        sessionExists[sessionId] = true;
        sessions[sessionId] = Session({ purposeId: purposeId, active: true });

        emit SessionRegistered(sessionId, purposeId);
    }

    // ==========================================
    // Session deactivation (operator only)
    // ==========================================

    function deactivateSession(uint256 sessionId) external {
        require(msg.sender == operator, "Unauthorized caller");
        require(sessionExists[sessionId], "Session does not exist");
        require(sessions[sessionId].active, "Session already inactive");

        sessions[sessionId].active = false;

        emit SessionDeactivated(sessionId);
    }

    // ==========================================
    // Proof verification & acceptance
    // ==========================================
    // Check ordering follows specs/aegis-protocol.v2.json contractPolicy:
    //   proof -> chainCheck -> versionCheck -> timestamp window ->
    //   zeroChecks -> session binding -> purpose whitelist -> replay.

    function verifyAndAccept(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[30] calldata pubSignals,
        uint256 expectedSessionId
    ) external {
        // 0. Authorization
        require(msg.sender == operator, "Unauthorized caller");

        // 1. Groth16 proof verification (30 public signals)
        require(verifier.verifyProof(pA, pB, pC, pubSignals), "Invalid proof");

        // 2. Chain binding: nullifier domain includes chainId (Option X)
        require(
            pubSignals[S.SIGNAL_CHAIN_ID] == block.chainid,
            "Chain ID mismatch"
        );

        // 3. Protocol version check
        require(
            pubSignals[S.SIGNAL_PROTOCOL_VERSION] == SUPPORTED_PROTOCOL_VERSION,
            "Unsupported protocol version"
        );

        // 4. Timestamp validity window (untrusted metadata; window only).
        uint256 ts = pubSignals[S.SIGNAL_TIMESTAMP];
        require(ts <= block.timestamp + S.CLOCK_SKEW_SECONDS, "Timestamp in future");
        require(
            block.timestamp <= ts + S.MAX_AGE_SECONDS + S.CLOCK_SKEW_SECONDS,
            "Timestamp too old"
        );

        // 5. Zero checks
        uint256 sessionId = pubSignals[S.SIGNAL_SESSION_ID];
        uint256 purposeId = pubSignals[S.SIGNAL_PURPOSE_ID];
        uint256 commitment = pubSignals[S.SIGNAL_COMMITMENT];
        uint256 nullifier = pubSignals[S.SIGNAL_NULLIFIER];
        require(sessionId != 0, "Zero session ID");
        require(purposeId != 0, "Zero purpose ID");
        require(commitment != 0, "Zero commitment");
        require(nullifier != 0, "Zero nullifier");

        // 6. Session binding
        require(sessionId == expectedSessionId, "Session mismatch");
        require(sessionExists[sessionId], "Session does not exist");
        require(sessions[sessionId].active, "Session inactive");
        require(sessions[sessionId].purposeId == purposeId, "Purpose mismatch");

        // 7. Purpose whitelist
        require(allowedPurposes[purposeId], "Purpose not allowed");

        // 8. Global replay protection.
        // The shared canonical registry makes nullifier uniqueness chain-wide
        // across all AegisShieldV2 deployments on the supported chain.
        // Only registered Shield consumers can call consume(), preventing
        // arbitrary third parties from pre-consuming public nullifiers.
        nullifierRegistry.consume(nullifier);
        usedNullifiers[nullifier] = true;

        // 9. Accept
        emit ProofAccepted(sessionId, commitment, nullifier);
    }
}
