// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAegisVerifier {
    function verifyProof(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[29] calldata pubSignals
    ) external view returns (bool);
}

contract AegisShield {

    // ==========================================
    // Verifier
    // ==========================================

    IAegisVerifier public immutable verifier;

    address public immutable operator;


    // ==========================================
    // Canonical Public Signal Layout
    // ==========================================

    uint256 private constant SIGNAL_EXPECTED_PROMPT_ROOT = 0;
    uint256 private constant SIGNAL_EXPECTED_OUTPUT_ROOT = 1;

    uint256 private constant SIGNAL_SESSION_ID = 2;
    uint256 private constant SIGNAL_PURPOSE_ID = 3;

    uint256 private constant SIGNAL_WEIGHTS_HASH = 4;
    uint256 private constant SIGNAL_TOKENIZER_HASH = 5;
    uint256 private constant SIGNAL_SYSTEM_PROMPT_HASH = 6;

    uint256 private constant SIGNAL_LORA_HASH = 7;
    uint256 private constant SIGNAL_ADAPTER_HASH = 8;
    uint256 private constant SIGNAL_SAFETY_LAYER_HASH = 9;

    uint256 private constant SIGNAL_QUANTIZATION_HASH = 10;
    uint256 private constant SIGNAL_PRECISION_HASH = 11;
    uint256 private constant SIGNAL_RUNTIME_HASH = 12;
    uint256 private constant SIGNAL_DRIVER_HASH = 13;

    uint256 private constant SIGNAL_TEMPERATURE = 14;
    uint256 private constant SIGNAL_TOP_P = 15;
    uint256 private constant SIGNAL_TOP_K = 16;
    uint256 private constant SIGNAL_SEED = 17;

    uint256 private constant SIGNAL_REPETITION_PENALTY = 18;
    uint256 private constant SIGNAL_PRESENCE_PENALTY = 19;
    uint256 private constant SIGNAL_FREQUENCY_PENALTY = 20;
    uint256 private constant SIGNAL_MAX_TOKENS = 21;

    uint256 private constant SIGNAL_PROTOCOL_VERSION = 22;
    uint256 private constant SIGNAL_TIMESTAMP = 23;

    uint256 private constant SIGNAL_MODEL_MANIFEST_COMMITMENT = 24;
    uint256 private constant SIGNAL_EXECUTION_ENV_COMMITMENT = 25;
    uint256 private constant SIGNAL_GENERATION_COMMITMENT = 26;

    uint256 private constant SIGNAL_COMMITMENT = 27;
    uint256 private constant SIGNAL_NULLIFIER = 28;


    // ==========================================
    // Nullifier Registry
    // ==========================================

    mapping(
        uint256 => bool
    ) public usedNullifiers;


    // ==========================================
    // Purpose Registry
    // ==========================================

    mapping(
        uint256 => bool
    ) public allowedPurposes;


    // ==========================================
    // Session Registry
    // ==========================================

    mapping(
        uint256 => bool
    ) public sessionExists;


    struct Session {

        uint256 purposeId;

        bool active;

    }


    mapping(
        uint256 => Session
    ) public sessions;


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


    event SessionDeactivated(
        uint256 indexed sessionId
    );


    // ==========================================
    // Constructor
    // ==========================================

    constructor(
        address _verifier,
        address _operator
    ) {

        require(
            _verifier != address(0),
            "Invalid verifier"
        );


        require(
            _operator != address(0),
            "Invalid operator"
        );


        verifier =
            IAegisVerifier(
                _verifier
            );


        operator =
            _operator;


        // ==========================================
        // Allowed Purpose IDs
        // ==========================================

        allowedPurposes[0] =
            true;


        allowedPurposes[1] =
            true;


        allowedPurposes[
            13903908139708007762322057526461532999124428646935356283413770512549625280792
        ] =
            true;

    }


    // ==========================================
    // Session Registration
    // ==========================================

    function registerSession(
        uint256 sessionId,
        uint256 purposeId
    )
        external
    {

        // ==========================================
        // Authorization
        // ==========================================

        require(
            msg.sender == operator,
            "Unauthorized caller"
        );


        // ==========================================
        // Session ID Validity
        // ==========================================

        require(
            sessionId != 0,
            "Invalid session ID"
        );


        // ==========================================
        // Session ID Uniqueness
        // ==========================================

        require(
            !sessionExists[sessionId],
            "Session already exists"
        );


        // ==========================================
        // Purpose Allowlist
        // ==========================================

        require(
            allowedPurposes[purposeId],
            "Purpose not allowed"
        );


        // ==========================================
        // Register Session
        // ==========================================

        sessionExists[sessionId] =
            true;


        sessions[sessionId] =
            Session({
                purposeId: purposeId,
                active: true
            });


        emit SessionRegistered(
            sessionId,
            purposeId
        );

    }


    // ==========================================
    // Session Deactivation
    // ==========================================

    function deactivateSession(
        uint256 sessionId
    )
        external
    {

        // ==========================================
        // Authorization
        // ==========================================

        require(
            msg.sender == operator,
            "Unauthorized caller"
        );


        // ==========================================
        // Session Existence
        // ==========================================

        require(
            sessionExists[sessionId],
            "Session does not exist"
        );


        // ==========================================
        // Session Active State
        // ==========================================

        require(
            sessions[sessionId].active,
            "Session already inactive"
        );


        // ==========================================
        // Deactivate
        // ==========================================

        sessions[sessionId].active =
            false;


        emit SessionDeactivated(
            sessionId
        );

    }


    // ==========================================
    // Proof Verification & Acceptance
    // ==========================================

    function verifyAndAccept(
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC,
        uint[29] calldata pubSignals,
        uint256 expectedSessionId
    )
        external
    {

        // ==========================================
        // 0. Authorization
        // ==========================================

        require(
            msg.sender == operator,
            "Unauthorized caller"
        );


        // ==========================================
        // 1. Groth16 Proof Verification
        // ==========================================

        bool valid =
            verifier.verifyProof(
                pA,
                pB,
                pC,
                pubSignals
            );


        require(
            valid,
            "Invalid proof"
        );


        // ==========================================
        // 2. Session Binding
        // ==========================================

        uint256 sessionId =
            pubSignals[
                SIGNAL_SESSION_ID
            ];


        require(
            sessionId ==
            expectedSessionId,
            "Session mismatch"
        );


        // ==========================================
        // 3. Session Registry
        // ==========================================

        require(
            sessionExists[sessionId],
            "Session does not exist"
        );


        require(
            sessions[sessionId].active,
            "Session inactive"
        );


        // ==========================================
        // 4. Purpose Binding
        // ==========================================

        uint256 purposeId =
            pubSignals[
                SIGNAL_PURPOSE_ID
            ];


        require(
            sessions[sessionId].purposeId ==
            purposeId,
            "Purpose mismatch"
        );


        // ==========================================
        // 5. Commitment
        // ==========================================

        uint256 commitment =
            pubSignals[
                SIGNAL_COMMITMENT
            ];


        // ==========================================
        // 6. Nullifier
        // ==========================================

        uint256 nullifier =
            pubSignals[
                SIGNAL_NULLIFIER
            ];


        // ==========================================
        // 7. Replay Protection
        // ==========================================

        require(
            !usedNullifiers[nullifier],
            "Nullifier already used"
        );


        // ==========================================
        // 8. Mark Nullifier as Used
        // ==========================================

        usedNullifiers[nullifier] =
            true;


        // ==========================================
        // 9. Emit Proof Accepted
        // ==========================================

        emit ProofAccepted(
            sessionId,
            commitment,
            nullifier
        );

    }

}