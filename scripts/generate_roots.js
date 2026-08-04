const { buildPoseidon } = require("circomlibjs");

async function hashTree(poseidon, leaves) {
    let level = leaves.map(x => BigInt(x));

    while (level.length > 1) {
        const nextLevel = [];

        for (let i = 0; i < level.length; i += 2) {
            const hash = poseidon([
                level[i],
                level[i + 1]
            ]);

            nextLevel.push(
                poseidon.F.toObject(hash)
            );
        }

        level = nextLevel;
    }

    return level[0].toString();
}

async function main() {
    const poseidon = await buildPoseidon();

    // テスト用 Prompt
    const prompt = [
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
    ];

    // テスト用 Output
    const output = [
        101, 102, 103, 104,
        105, 106, 107, 108,
        109, 110, 111, 112,
        113, 114, 115, 116
    ];

    const promptRoot = await hashTree(poseidon, prompt);
    const outputRoot = await hashTree(poseidon, output);

    console.log("PromptRoot :", promptRoot);
    console.log("OutputRoot:", outputRoot);
}

main().catch(console.error);