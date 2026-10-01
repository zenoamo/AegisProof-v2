use methods::{AEGIS_EXECUTION_ELF, AEGIS_EXECUTION_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};

fn main() {
    let input: u64 = 7;

    let env = ExecutorEnv::builder()
        .write(&input)
        .expect("failed to write guest input")
        .build()
        .expect("failed to build executor environment");

    let receipt = default_prover()
        .prove(env, AEGIS_EXECUTION_ELF)
        .expect("failed to prove guest execution")
        .receipt;

    receipt
        .verify(AEGIS_EXECUTION_ID)
        .expect("zkVM receipt verification failed");

    let output: u64 = receipt
        .journal
        .decode()
        .expect("failed to decode guest journal");

    assert_eq!(output, input.wrapping_mul(input).wrapping_add(7));

    println!("AegisProof zkVM PoC verified: {input} -> {output}");
}
