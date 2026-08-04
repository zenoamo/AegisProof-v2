import { createPublicClient, http, getAddress } from "viem";
import { hardhat } from "viem/chains";

const VERIFIER_ADDRESS = getAddress(
  "0x5fbdb2315678afecb367f032d93f642f64180aa3"
);

const verifierAbi = [
  {
    inputs: [
      {
        internalType: "uint256[2]",
        name: "_pA",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[2][2]",
        name: "_pB",
        type: "uint256[2][2]",
      },
      {
        internalType: "uint256[2]",
        name: "_pC",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[29]",
        name: "_pubSignals",
        type: "uint256[29]",
      },
    ],
    name: "verifyProof",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const pA = [
  282877452702272621232294400118185730114598512048650071318301043148884402699n,
  14145143184131728843047006910455664463675768977990623641934435470915581860165n,
] as const;

const pB = [
  [
    2251670812248528237148034836831999131859566294534361135439866066651785150611n,
    14482815947360503305892810489763820153565927238656814099802850157766388919875n,
  ],
  [
    15256014752606113974214747571210530585852509998468671237020989181103073957519n,
    8973004668054053844014148580848986024731842580959518801872710138079748032503n,
  ],
] as const;

const pC = [
  14464230113245261529430050957618309474678721230283266868346111939750849208712n,
  7693720611770934724841633670067171754718085291588250307212720140790572050890n,
] as const;

const pubSignals = [
  9545276152835560897520121746081571195384734068630670902992540984735352457495n,
  8467494628841207067040003367186015935231186431277318505280623156169797295001n,
  16490064544900279657031437514169079799951816844151523046212986534819030533243n,
  13903908139708007762322057526461532999124428646935356283413770512549625280792n,
  13098789712689991751617789633923034792601713511507611320692156503213565165024n,
  123n,
  456n,
  1n,
  0n,
  100n,
  200n,
  300n,
  400n,
  500n,
  600n,
  700n,
  800n,
  900n,
  1000n,
  70n,
  90n,
  40n,
  12345n,
  100n,
  0n,
  0n,
  512n,
  1n,
  1234567890n,
] as const;

async function main() {
  console.log("==========================================");
  console.log("Direct Groth16 Verifier Test");
  console.log("==========================================");

  console.log("Verifier:", VERIFIER_ADDRESS);
  console.log("Public signals:", pubSignals.length);

  const client = createPublicClient({
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });

  const code = await client.getCode({
    address: VERIFIER_ADDRESS,
  });

  if (!code || code === "0x") {
    console.log("");
    console.log("❌ VERIFIER CONTRACT NOT FOUND");
    console.log("Address:", VERIFIER_ADDRESS);
    return;
  }

  console.log("Verifier bytecode detected.");

  const result = await client.readContract({
    address: VERIFIER_ADDRESS,
    abi: verifierAbi,
    functionName: "verifyProof",
    args: [
      pA,
      pB,
      pC,
      pubSignals,
    ],
  });

  console.log("");
  console.log("==========================================");
  console.log("Verifier Result:", result);
  console.log("==========================================");
}

main().catch((error) => {
  console.error("");
  console.error("VERIFIER TEST FAILED");
  console.error(error);
  process.exit(1);
});