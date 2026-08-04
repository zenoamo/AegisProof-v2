// Gate runner: executes every standalone gate as an independent child process
// (a crashing gate cannot take the others down) and aggregates results.
// Exit code = number of failed gates (0 = all pass).
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gates = [
  "gate_layout.mjs", // #1 Layout (C-1)
  "gate_binding.mjs", // #2 Binding (C-4) + C-2
  "gate_icvk.mjs", // #3 IC/VK consistency
  "gate_domain.mjs", // #5 Domain separation
  "gate_forbidden_hardcode.mjs", // #6 Forbidden hardcodes
];

let failed = 0;
const t0 = Date.now();
for (const g of gates) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, g)], { stdio: "inherit" });
  const el = ((Date.now() - t) / 1000).toFixed(1);
  if (r.status !== 0) {
    failed++;
    console.log(`>>> ${g}: FAILED (exit=${r.status}, ${el}s)`);
  } else {
    console.log(`>>> ${g}: OK (${el}s)`);
  }
}
console.log(
  failed === 0
    ? `ALL GATES PASS (${gates.length}/${gates.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`
    : `GATE SUITE FAILED: ${failed}/${gates.length} gates failed`
);
process.exit(failed === 0 ? 0 : 1);
