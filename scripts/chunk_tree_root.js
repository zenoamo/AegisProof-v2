const { buildPoseidon } = require("circomlibjs");

async function main() {
    const poseidon = await buildPoseidon();

    // テスト用16チャンク
    const chunks = [
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
    ];

    let level = chunks;

    while (level.length > 1) {
        const nextLevel = [];

        for (let i = 0; i < level.length; i += 2) {
            const hash = poseidon([
                level[i],
                level[i + 1]
            ]);

            nextLevel.push(
                poseidon.F.toObject(hash).toString()
            );
        }

        level = nextLevel;
    }

    console.log("AegisChunkTree Root:");
    console.log(level[0]);
}

main().catch(console.error);