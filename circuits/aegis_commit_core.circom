pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

template AegisCommitCore() {

    // ==========================================
    // Secret Inputs
    // ==========================================

    signal input secretKey;
    signal input deviceId;


    // ==========================================
    // Public Inputs
    // ==========================================

    signal input expectedPromptRoot;
    signal input expectedOutputRoot;

    signal input sessionId;
    signal input purposeId;

    signal input weightsHash;
    signal input tokenizerHash;
    signal input systemPromptHash;

    signal input loraHash;
    signal input adapterHash;
    signal input safetyLayerHash;

    signal input quantizationHash;
    signal input precisionHash;
    signal input runtimeHash;
    signal input driverHash;

    signal input temperature;
    signal input topP;
    signal input topK;
    signal input seed;

    signal input repetitionPenalty;
    signal input presencePenalty;
    signal input frequencyPenalty;
    signal input maxTokens;

    signal input protocolVersion;
    signal input timestamp;


    // ==========================================
    // Public Outputs
    // ==========================================

    signal output modelManifestCommitment;
    signal output executionEnvCommitment;
    signal output generationCommitment;
    signal output commitment;
    signal output nullifier;


    // ==========================================
    // Model Manifest Commitment
    // ==========================================

    component hManifest1 = Poseidon(3);

    hManifest1.inputs[0] <== weightsHash;
    hManifest1.inputs[1] <== tokenizerHash;
    hManifest1.inputs[2] <== systemPromptHash;


    component hManifest2 = Poseidon(3);

    hManifest2.inputs[0] <== loraHash;
    hManifest2.inputs[1] <== adapterHash;
    hManifest2.inputs[2] <== safetyLayerHash;


    component hManifestRoot = Poseidon(2);

    hManifestRoot.inputs[0] <== hManifest1.out;
    hManifestRoot.inputs[1] <== hManifest2.out;

    modelManifestCommitment <== hManifestRoot.out;


    // ==========================================
    // Execution Environment Commitment
    // ==========================================

    component hEnv = Poseidon(4);

    hEnv.inputs[0] <== quantizationHash;
    hEnv.inputs[1] <== precisionHash;
    hEnv.inputs[2] <== runtimeHash;
    hEnv.inputs[3] <== driverHash;

    executionEnvCommitment <== hEnv.out;


    // ==========================================
    // Generation Commitment
    // ==========================================

    component hGen1 = Poseidon(4);

    hGen1.inputs[0] <== temperature;
    hGen1.inputs[1] <== topP;
    hGen1.inputs[2] <== topK;
    hGen1.inputs[3] <== seed;


    component hGen2 = Poseidon(4);

    hGen2.inputs[0] <== repetitionPenalty;
    hGen2.inputs[1] <== presencePenalty;
    hGen2.inputs[2] <== frequencyPenalty;
    hGen2.inputs[3] <== maxTokens;


    component hGenRoot = Poseidon(2);

    hGenRoot.inputs[0] <== hGen1.out;
    hGenRoot.inputs[1] <== hGen2.out;

    generationCommitment <== hGenRoot.out;


    // ==========================================
    // Ultimate Commitment
    // ==========================================

    component commitHasher = Poseidon(7);

    commitHasher.inputs[0] <== expectedPromptRoot;
    commitHasher.inputs[1] <== expectedOutputRoot;
    commitHasher.inputs[2] <== modelManifestCommitment;
    commitHasher.inputs[3] <== executionEnvCommitment;
    commitHasher.inputs[4] <== generationCommitment;
    commitHasher.inputs[5] <== protocolVersion;
    commitHasher.inputs[6] <== timestamp;

    commitment <== commitHasher.out;


    // ==========================================
    // Nullifier
    // ==========================================

    var DOMAIN_SEPARATOR_V1 = 548923749238475923;

    component nullifierHasher = Poseidon(5);

    nullifierHasher.inputs[0] <== DOMAIN_SEPARATOR_V1;
    nullifierHasher.inputs[1] <== secretKey;
    nullifierHasher.inputs[2] <== deviceId;
    nullifierHasher.inputs[3] <== purposeId;
    nullifierHasher.inputs[4] <== commitment;

    nullifier <== nullifierHasher.out;
}


// ==========================================
// Main Circuit
// ==========================================
//
// Public Inputs:
//   [0..23]
//
// Public Outputs:
//   [24..28]
//
// Total:
//   29 public signals
//
// ==========================================

component main {public [

    expectedPromptRoot,
    expectedOutputRoot,

    sessionId,
    purposeId,

    weightsHash,
    tokenizerHash,
    systemPromptHash,

    loraHash,
    adapterHash,
    safetyLayerHash,

    quantizationHash,
    precisionHash,
    runtimeHash,
    driverHash,

    temperature,
    topP,
    topK,
    seed,

    repetitionPenalty,
    presencePenalty,
    frequencyPenalty,
    maxTokens,

    protocolVersion,
    timestamp

]} = AegisCommitCore();