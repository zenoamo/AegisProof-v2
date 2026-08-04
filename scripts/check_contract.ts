import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const address = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  const code = await publicClient.getBytecode({ address });
  console.log("Bytecode:", code);
  console.log("Has bytecode:", code !== "0x" && code !== undefined);
}

main().catch(console.error);