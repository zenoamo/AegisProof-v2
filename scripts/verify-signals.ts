import fs from "node:fs";
import path from "node:path";

type Signal = {
  index: number;
  name: string;
};

type SignalSpec = {
  version: number;
  signals: Signal[];
};

type VerifiedRef = {
  name: string;
  index: number;
  sourceExpr: string;
};

type ErrorRef = {
  name: string;
  expected: number;
  actual: number;
  line: number;
  sourceExpr: string;
};

type WarningRef = {
  message: string;
  line: number;
};

type FileCheckResult = {
  relativePath: string;
  verified: VerifiedRef[];
  errors: ErrorRef[];
  warnings: WarningRef[];
};

const ROOT = process.cwd();

const specPath = path.join(
  ROOT,
  "specs",
  "canonical-signals.json"
);

// ============================================================
// Canonical Signal Specification
// ============================================================

let spec: SignalSpec;

try {
  spec = JSON.parse(
    fs.readFileSync(specPath, "utf8")
  );
} catch {
  spec = {
    version: 1,
    signals: [
      { index: 0, name: "expectedPromptRoot" },
      { index: 1, name: "expectedOutputRoot" },
      { index: 2, name: "sessionId" },
      { index: 3, name: "purposeId" },
      { index: 4, name: "weightsHash" },
      { index: 5, name: "tokenizerHash" },
      { index: 6, name: "systemPromptHash" },
      { index: 7, name: "loraHash" },
      { index: 8, name: "adapterHash" },
      { index: 9, name: "safetyLayerHash" },
      { index: 10, name: "quantizationHash" },
      { index: 11, name: "precisionHash" },
      { index: 12, name: "runtimeHash" },
      { index: 13, name: "driverHash" },
      { index: 14, name: "temperature" },
      { index: 15, name: "topP" },
      { index: 16, name: "topK" },
      { index: 17, name: "seed" },
      { index: 18, name: "repetitionPenalty" },
      { index: 19, name: "presencePenalty" },
      { index: 20, name: "frequencyPenalty" },
      { index: 21, name: "maxTokens" },
      { index: 22, name: "protocolVersion" },
      { index: 23, name: "timestamp" },
      { index: 24, name: "modelManifestCommitment" },
      { index: 25, name: "executionEnvCommitment" },
      { index: 26, name: "generationCommitment" },
      { index: 27, name: "commitment" },
      { index: 28, name: "nullifier" },
    ],
  };
}

// ============================================================
// Canonical Validation
// ============================================================

if (spec.signals.length !== 29) {
  console.error(
    `❌ Error: Canonical signals count must be exactly 29, found ${spec.signals.length}.`
  );
  process.exit(1);
}

const indexToNameMap = new Map<number, string>(
  spec.signals.map((signal) => [
    signal.index,
    signal.name,
  ])
);

const nameToIndexMap = new Map<string, number>(
  spec.signals.map((signal) => [
    signal.name,
    signal.index,
  ])
);

// ============================================================
// IDX_* Canonical Alias Map
//
// These aliases are intentionally copied from the Canonical
// Signal Specification so scripts such as prove.js can use:
//
//   signals[IDX_SESSION_ID]
//
// without requiring changes to prove.js.
//
// IMPORTANT:
// This map represents the CANONICAL expected indices.
// It does not modify or execute any project source code.
// ============================================================

const canonicalIndexAliases: Record<string, number> = {
  IDX_EXPECTED_PROMPT_ROOT: 0,
  IDX_EXPECTED_OUTPUT_ROOT: 1,

  IDX_SESSION_ID: 2,
  IDX_PURPOSE_ID: 3,

  IDX_WEIGHTS_HASH: 4,
  IDX_TOKENIZER_HASH: 5,
  IDX_SYSTEM_PROMPT_HASH: 6,
  IDX_LORA_HASH: 7,
  IDX_ADAPTER_HASH: 8,
  IDX_SAFETY_LAYER_HASH: 9,

  IDX_QUANTIZATION_HASH: 10,
  IDX_PRECISION_HASH: 11,
  IDX_RUNTIME_HASH: 12,
  IDX_DRIVER_HASH: 13,

  IDX_TEMPERATURE: 14,
  IDX_TOP_P: 15,
  IDX_TOP_K: 16,
  IDX_SEED: 17,

  IDX_REPETITION_PENALTY: 18,
  IDX_PRESENCE_PENALTY: 19,
  IDX_FREQUENCY_PENALTY: 20,

  IDX_MAX_TOKENS: 21,
  IDX_PROTOCOL_VERSION: 22,
  IDX_TIMESTAMP: 23,

  IDX_MODEL_MANIFEST_COMMITMENT: 24,
  IDX_EXECUTION_ENV_COMMITMENT: 25,
  IDX_GENERATION_COMMITMENT: 26,

  IDX_COMMITMENT: 27,
  IDX_NULLIFIER: 28,
};

// ============================================================
// Target Configuration
// ============================================================

const targets = [
  "contracts",
  "circuits",
  "scripts",
  "test",
  "tests",
  "formal",
  "server",
  "sdk",
  "specs",
];

const extensions = [
  ".sol",
  ".ts",
  ".js",
  ".lean",
];

const ignoredDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "cache",
  ".lake",
  "artifacts",
  "target",
  ".next",
  ".turbo",
]);

// ============================================================
// File Utilities
// ============================================================

function shouldIgnorePath(
  filePath: string
): boolean {
  const parts = filePath.split(path.sep);

  if (
    parts.some((part) =>
      ignoredDirs.has(part)
    )
  ) {
    return true;
  }

  const fileName = path.basename(filePath);

  if (
    fileName.startsWith(".env") ||
    fileName.endsWith(".key") ||
    fileName.endsWith(".pem") ||
    fileName.endsWith(".secret") ||
    fileName.endsWith(".zkey")
  ) {
    return true;
  }

  return false;
}

function collectFiles(
  dir: string
): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];

  try {
    const entries = fs.readdirSync(
      dir,
      {
        withFileTypes: true,
      }
    );

    for (const entry of entries) {
      const fullPath = path.join(
        dir,
        entry.name
      );

      if (
        shouldIgnorePath(fullPath)
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(
          ...collectFiles(fullPath)
        );
      } else if (
        entry.isFile() &&
        extensions.includes(
          path.extname(entry.name)
        )
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore unreadable directories/files.
  }

  return results;
}

// ============================================================
// Source Cleaning
// ============================================================

function stripCommentsAndStrings(
  content: string,
  ext: string
): string {
  let cleaned = content;

  // Block comments
  cleaned = cleaned.replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );

  if (ext === ".lean") {
    // Lean block comments
    cleaned = cleaned.replace(
      /\/-[\s\S]*?-\//g,
      ""
    );

    // Lean line comments
    cleaned = cleaned.replace(
      /--.*$/gm,
      ""
    );
  } else {
    // Solidity / TypeScript / JavaScript
    cleaned = cleaned.replace(
      /\/\/.*$/gm,
      ""
    );
  }

  // Strings
  cleaned = cleaned.replace(
    /"([^"\\]|\\.)*"/g,
    '""'
  );

  cleaned = cleaned.replace(
    /'([^'\\]|\\.)*'/g,
    "''"
  );

  cleaned = cleaned.replace(
    /`([^`\\]|\\.)*`/g,
    "``"
  );

  return cleaned;
}

// ============================================================
// Constant Resolution
// ============================================================

function extractConstants(
  lines: string[]
): Map<string, number> {
  const constantMap =
    new Map<string, number>();

  // Solidity / JS / TS constants
  const constRegex =
    /(?:const|let|var|constant)\s+([A-Z0-9_]+)\s*=\s*(\d+)/g;

  for (const line of lines) {
    let match: RegExpExecArray | null;

    while (
      (match = constRegex.exec(line)) !== null
    ) {
      const name = match[1];
      const value = Number(match[2]);

      if (
        Number.isInteger(value)
      ) {
        constantMap.set(
          name,
          value
        );
      }
    }
  }

  return constantMap;
}

// ============================================================
// Signal Name Helpers
// ============================================================

function constantToSignalName(
  constantName: string
): string | null {
  if (
    !constantName.startsWith(
      "SIGNAL_"
    )
  ) {
    return null;
  }

  const body =
    constantName
      .slice("SIGNAL_".length)
      .toLowerCase()
      .split("_");

  if (body.length === 0) {
    return null;
  }

  const name =
    body[0] +
    body
      .slice(1)
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1)
      )
      .join("");

  return name;
}

function idxToSignalName(
  idxName: string
): string | null {
  if (
    !idxName.startsWith("IDX_")
  ) {
    return null;
  }

  const body =
    idxName
      .slice("IDX_".length)
      .toLowerCase()
      .split("_");

  if (body.length === 0) {
    return null;
  }

  const name =
    body[0] +
    body
      .slice(1)
      .map(
        (part) =>
          part.charAt(0).toUpperCase() +
          part.slice(1)
      )
      .join("");

  return name;
}

// ============================================================
// Index Resolution
// ============================================================

function resolveIndex(
  expression: string,
  constantMap: Map<string, number>
): number | null {
  const expr =
    expression.trim();

  // Direct integer
  if (/^\d+$/.test(expr)) {
    return Number(expr);
  }

  // Local source constant
  if (constantMap.has(expr)) {
    return constantMap.get(expr)!;
  }

  // Canonical IDX_* alias
  if (
    Object.prototype.hasOwnProperty.call(
      canonicalIndexAliases,
      expr
    )
  ) {
    return canonicalIndexAliases[expr];
  }

  return null;
}

// ============================================================
// Expected Signal Resolution
// ============================================================

function resolveExpectedSignal(
  expression: string,
  resolvedIndex: number
): string | null {
  const expr =
    expression.trim();

  // IDX_* alias
  const idxSignal =
    idxToSignalName(expr);

  if (
    idxSignal &&
    nameToIndexMap.has(idxSignal)
  ) {
    return idxSignal;
  }

  // SIGNAL_* alias
  const signalName =
    constantToSignalName(expr);

  if (
    signalName &&
    nameToIndexMap.has(signalName)
  ) {
    return signalName;
  }

  // Canonical index
  return (
    indexToNameMap.get(
      resolvedIndex
    ) ?? null
  );
}

// ============================================================
// File Analysis
// ============================================================

function analyzeFile(
  filePath: string
): FileCheckResult {
  const rawContent =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  const ext =
    path.extname(filePath);

  const cleanContent =
    stripCommentsAndStrings(
      rawContent,
      ext
    );

  const relativePath =
    path.relative(
      ROOT,
      filePath
    );

  const lines =
    cleanContent.split("\n");

  const constantMap =
    extractConstants(lines);

  const verified: VerifiedRef[] = [];
  const errors: ErrorRef[] = [];
  const warnings: WarningRef[] = [];

  // ==========================================================
  // Detect array access
  //
  // signals[2]
  // signals[SIGNAL_SESSION_ID]
  // signals[IDX_SESSION_ID]
  // pubSignals[28]
  // ==========================================================

  const arrayAccessRegex =
    /\b(signals|pubSignals)\s*\[\s*([^\]]+?)\s*\]/g;

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i];

    const lineNumber =
      i + 1;

    let match: RegExpExecArray | null;

    while (
      (match =
        arrayAccessRegex.exec(line)) !== null
    ) {
      const arrayName =
        match[1];

      const expression =
        match[2].trim();

      const sourceExpr =
        `${arrayName}[${expression}]`;

      const resolvedIndex =
        resolveIndex(
          expression,
          constantMap
        );

      // --------------------------------------------------------
      // Unable to resolve
      // --------------------------------------------------------

      if (
        resolvedIndex === null
      ) {
        warnings.push({
          message:
            `Unable to resolve signal index: ${sourceExpr}`,
          line: lineNumber,
        });

        continue;
      }

      // --------------------------------------------------------
      // Out of canonical range
      // --------------------------------------------------------

      if (
        resolvedIndex < 0 ||
        resolvedIndex >= 29
      ) {
        errors.push({
          name:
            "UnknownSignal",
          expected: 0,
          actual:
            resolvedIndex,
          line:
            lineNumber,
          sourceExpr,
        });

        continue;
      }

      // --------------------------------------------------------
      // Resolve canonical signal
      // --------------------------------------------------------

      const canonicalName =
        resolveExpectedSignal(
          expression,
          resolvedIndex
        );

      if (
        !canonicalName
      ) {
        warnings.push({
          message:
            `Unable to resolve canonical signal name: ${sourceExpr}`,
          line: lineNumber,
        });

        continue;
      }

      const expectedIndex =
        nameToIndexMap.get(
          canonicalName
        );

      if (
        expectedIndex === undefined
      ) {
        warnings.push({
          message:
            `Signal is not present in canonical specification: ${canonicalName}`,
          line: lineNumber,
        });

        continue;
      }

      // --------------------------------------------------------
      // Canonical validation
      // --------------------------------------------------------

      if (
        resolvedIndex ===
        expectedIndex
      ) {
        verified.push({
          name:
            canonicalName,
          index:
            expectedIndex,
          sourceExpr,
        });
      } else {
        errors.push({
          name:
            canonicalName,
          expected:
            expectedIndex,
          actual:
            resolvedIndex,
          line:
            lineNumber,
          sourceExpr,
        });
      }
    }
  }

  return {
    relativePath,
    verified,
    errors,
    warnings,
  };
}

// ============================================================
// Main
// ============================================================

console.log(
  "🔍 AegisProof Canonical Signal Verification\n"
);

console.log(
  `Canonical Specification v${spec.version}\n`
);

for (
  const signal of spec.signals
) {
  console.log(
    `✓ [${signal.index}] ${signal.name}`
  );
}

console.log(
  "\nScanning project...\n"
);

let totalFilesScanned = 0;
let totalVerifiedRefs = 0;
let totalWarnings = 0;
let totalErrors = 0;

for (
  const target of targets
) {
  const targetDir =
    path.join(
      ROOT,
      target
    );

  const files =
    collectFiles(
      targetDir
    );

  for (
    const file of files
  ) {
    totalFilesScanned++;

    const result =
      analyzeFile(file);

    // ----------------------------------------------------------
    // Errors
    // ----------------------------------------------------------

    if (
      result.errors.length > 0
    ) {
      for (
        const error of result.errors
      ) {
        totalErrors++;

        console.log(
          `❌ ${result.relativePath}`
        );

        console.log(
          `  Signal: ${error.name}`
        );

        console.log(
          `  Expected index: ${error.expected}`
        );

        console.log(
          `  Actual index: ${error.actual}`
        );

        console.log(
          `  Line: ${error.line} (${error.sourceExpr})`
        );
      }
    }

    // ----------------------------------------------------------
    // Verified
    // ----------------------------------------------------------

    if (
      result.verified.length > 0
    ) {
      console.log(
        `✓ ${result.relativePath}`
      );

      for (
        const verified of result.verified
      ) {
        totalVerifiedRefs++;

        console.log(
          `  ${verified.name} → [${verified.index}]`
        );
      }
    }

    // ----------------------------------------------------------
    // Warnings
    // ----------------------------------------------------------

    if (
      result.warnings.length > 0
    ) {
      for (
        const warning of result.warnings
      ) {
        totalWarnings++;

        console.log(
          `⚠ ${result.relativePath}`
        );

        console.log(
          `  ${warning.message}`
        );

        console.log(
          `  Line: ${warning.line}`
        );
      }
    }
  }
}

// ============================================================
// Summary
// ============================================================

console.log(
  "\n────────────────────────"
);

console.log(
  `Canonical Signals: 29`
);

console.log(
  `Files Scanned: ${totalFilesScanned}`
);

console.log(
  `Verified References: ${totalVerifiedRefs}`
);

console.log(
  `Warnings: ${totalWarnings}`
);

console.log(
  `Errors: ${totalErrors}`
);

console.log(
  "────────────────────────"
);

// ============================================================
// Exit Status
// ============================================================

if (
  totalErrors === 0
) {
  console.log(
    "✓ No canonical signal mismatches detected."
  );

  process.exit(0);
}

console.error(
  "❌ Canonical signal mismatches detected."
);

process.exit(1);