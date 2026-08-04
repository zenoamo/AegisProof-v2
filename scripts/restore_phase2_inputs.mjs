// ============================================================================
// Post-rollback recovery: restore the phase2 test input vectors.
// ----------------------------------------------------------------------------
// artifacts/phase2/tests/input_v2.json is the frozen Phase 2 baseline input;
// its canonical content is embedded below (byte-exact). The three negative
// variants are single-field mutations required by the FULL suite's negative
// witness tests (commitment/nullifier equality constraints, manifest tree).
// Safe to re-run (idempotent).
// ============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = path.join(ROOT, "artifacts/phase2/tests");
fs.mkdirSync(TESTS, { recursive: true });

const BASELINE = {
  secretKey: "123456789",
  deviceId: "1",
  expectedPromptRoot: "111111",
  expectedOutputRoot: "222222",
  sessionId: "777",
  purposeId: "42",
  weightsHash: "100",
  tokenizerHash: "200",
  systemPromptHash: "300",
  loraHash: "400",
  adapterHash: "500",
  safetyLayerHash: "600",
  quantizationHash: "700",
  precisionHash: "800",
  runtimeHash: "900",
  driverHash: "1000",
  temperature: "70",
  topP: "90",
  topK: "40",
  seed: "12345",
  repetitionPenalty: "100",
  presencePenalty: "0",
  frequencyPenalty: "0",
  maxTokens: "512",
  chainId: "31337",
  protocolVersion: "2",
  timestamp: "1754300000",
  modelManifestCommitment:
    "9545276152835560897520121746081571195384734068630670902992540984735352457495",
  executionEnvCommitment:
    "8467494628841207067040003367186015935231186431277318505280623156169797295001",
  generationCommitment:
    "16490064544900279657031437514169079799951816844151523046212986534819030533243",
  commitment:
    "21092069349670863398454109521462427619296145556387894181652055483721552540755",
  nullifier:
    "15581994437212860990191878758872006199905487917698440603787983317110791878196",
};

fs.writeFileSync(path.join(TESTS, "input_v2.json"), JSON.stringify(BASELINE, null, 2) + "\n", "utf8");
const mutate = (field, name) => {
  const m = { ...BASELINE };
  m[field] = (BigInt(m[field]) + 1n).toString();
  fs.writeFileSync(path.join(TESTS, name), JSON.stringify(m, null, 2) + "\n", "utf8");
};
mutate("commitment", "input_v2_bad_commitment.json"); // breaks Poseidon(6) equality constraint
mutate("nullifier", "input_v2_bad_nullifier.json"); // breaks Poseidon(8) equality constraint
mutate("weightsHash", "input_v2_bad_manifest.json"); // breaks modelManifest tree constraint
console.log("restored: input_v2.json + 3 negative variants -> artifacts/phase2/tests/");
