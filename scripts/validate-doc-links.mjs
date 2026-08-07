#!/usr/bin/env node
// Validate relative markdown links in README and docs/README.md
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  "README.md",
  "SECURITY.md",
  "docs/README.md",
  "docs/release/v2.0.1-release-notes.md",
  "CONTRIBUTING.md",
];

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

let broken = 0;
let checked = 0;

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`MISSING file: ${rel}`);
    broken++;
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  for (const m of text.matchAll(LINK_RE)) {
    const href = m[1].trim();
    if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) continue;
    const clean = href.split("#")[0];
    if (!clean) continue;
    const resolved = path.normalize(path.join(path.dirname(abs), clean));
    if (!resolved.startsWith(ROOT)) continue;
    checked++;
    if (!fs.existsSync(resolved)) {
      console.error(`BROKEN ${rel}: ${href}`);
      broken++;
    }
  }
}

if (broken > 0) {
  console.error(`\nDOC LINKS: ${broken} broken / ${checked} checked`);
  process.exit(1);
}
console.log(`DOC LINKS: ${checked} links OK`);
process.exit(0);
