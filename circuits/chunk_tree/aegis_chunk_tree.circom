pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template AegisChunkTree16() {
    signal input leaves[16];
    signal output root;

    component h1[8];
    component h2[4];
    component h3[2];
    component h4;

    for (var i = 0; i < 8; i++) {
        h1[i] = Poseidon(2);
        h1[i].inputs[0] <== leaves[i * 2];
        h1[i].inputs[1] <== leaves[i * 2 + 1];
    }

    for (var i = 0; i < 4; i++) {
        h2[i] = Poseidon(2);
        h2[i].inputs[0] <== h1[i * 2].out;
        h2[i].inputs[1] <== h1[i * 2 + 1].out;
    }

    for (var i = 0; i < 2; i++) {
        h3[i] = Poseidon(2);
        h3[i].inputs[0] <== h2[i * 2].out;
        h3[i].inputs[1] <== h2[i * 2 + 1].out;
    }

    h4 = Poseidon(2);
    h4.inputs[0] <== h3[0].out;
    h4.inputs[1] <== h3[1].out;

    root <== h4.out;
}

component main = AegisChunkTree16();