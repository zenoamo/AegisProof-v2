use risc0_zkvm::guest::env;

fn main() {
    let input: u64 = env::read();
    let output = input.wrapping_mul(input).wrapping_add(7);
    env::commit(&output);
}
