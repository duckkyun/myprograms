#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { deleteProgress, loadProgress, saveProgress } from "./lib/checkpoint.js";
import { CodexTranscriptTranslator } from "./lib/codexTranslator.js";
import {
  buildChunks,
  createFingerprint,
  defaultOutputPath,
  defaultProgressPath,
  parseTranscriptText,
  renderBilingualOutput,
} from "./lib/transcript.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function printHelp() {
  console.log(`Codex Transcript Translator

Usage:
  node ./src/cli.js <input.txt> [options]
  npm run translate -- <input.txt> [options]

Options:
  --output <path>        Write the final txt to a custom path.
  --model <name>         Ask Codex to use a specific model.
  --reasoning <level>    minimal | low | medium | high | xhigh (default: low)
  --chunk-size <number>  Max transcript lines per chunk (default: 100)
  --max-chars <number>   Max source characters per chunk (default: 15000)
  --overwrite            Replace an existing output file.
  --fresh                Ignore and replace any saved progress file.
  --help                 Show this help message.

Setup:
  1. Install dependencies with: npm install
  2. Sign in once with: npx codex login
  3. Run the translator:
     npm run translate -- "C:\\path\\to\\lecture.txt"
`);
}

function parsePositiveInteger(flagName, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    inputPath: null,
    outputPath: null,
    model: undefined,
    reasoning: "low",
    chunkSize: 100,
    maxChars: 15000,
    overwrite: false,
    fresh: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (arg === "--fresh") {
      options.fresh = true;
      continue;
    }

    if (arg === "--output") {
      options.outputPath = argv[++i];
      continue;
    }

    if (arg === "--model") {
      options.model = argv[++i];
      continue;
    }

    if (arg === "--reasoning") {
      options.reasoning = argv[++i];
      continue;
    }

    if (arg === "--chunk-size") {
      options.chunkSize = parsePositiveInteger("--chunk-size", argv[++i]);
      continue;
    }

    if (arg === "--max-chars") {
      options.maxChars = parsePositiveInteger("--max-chars", argv[++i]);
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.inputPath) {
      throw new Error("Only one input file path can be provided.");
    }

    options.inputPath = arg;
  }

  return options;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildProgressPayload({ fingerprint, inputPath, outputPath, model, translationsById }) {
  return {
    fingerprint,
    inputPath,
    outputPath,
    model: model ?? null,
    updatedAt: new Date().toISOString(),
    translations: Object.fromEntries(
      [...translationsById.entries()].map(([id, translation]) => [String(id), translation]),
    ),
  };
}

function restoreTranslations(progress) {
  return new Map(
    Object.entries(progress?.translations ?? {}).map(([id, translation]) => [
      Number.parseInt(id, 10),
      translation,
    ]),
  );
}

function printSetupHint(error) {
  const message = error?.message ?? "";
  const likelyAuthIssue =
    /login|auth|credential|api key|configuration/i.test(message);

  if (!likelyAuthIssue) {
    return;
  }

  console.error("");
  console.error("Codex setup hint:");
  console.error("  Run `npx codex login` in this project folder and sign in with ChatGPT.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.inputPath) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath ?? defaultOutputPath(inputPath));
  const progressPath = defaultProgressPath(outputPath);

  if (!options.overwrite && (await fileExists(outputPath))) {
    throw new Error(
      `Output file already exists: ${outputPath}\nUse --overwrite to replace it.`,
    );
  }

  const rawInput = await fs.readFile(inputPath, "utf8");
  const items = parseTranscriptText(rawInput);
  if (items.length === 0) {
    throw new Error("No transcript lines were parsed from the input file.");
  }

  const fingerprint = createFingerprint(items);
  let translationsById = new Map();

  if (!options.fresh) {
    const savedProgress = await loadProgress(progressPath);
    if (savedProgress && savedProgress.fingerprint === fingerprint) {
      translationsById = restoreTranslations(savedProgress);
      if (translationsById.size > 0) {
        console.log(`Resuming from saved progress: ${translationsById.size} item(s) already translated.`);
      }
    }
  }

  const remainingItems = items.filter((item) => !translationsById.has(item.id));
  const chunks = buildChunks(remainingItems, {
    maxItemsPerChunk: options.chunkSize,
    maxCharsPerChunk: options.maxChars,
  });

  console.log(`Parsed ${items.length} item(s).`);
  console.log(`Output path: ${outputPath}`);
  console.log(`Progress path: ${progressPath}`);
  console.log(`Remaining chunks: ${chunks.length}`);

  if (chunks.length > 0) {
    const translator = new CodexTranscriptTranslator({
      model: options.model,
      reasoningEffort: options.reasoning,
      workingDirectory: PROJECT_ROOT,
    });

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const lineCount = chunk.length;
      console.log(`Translating chunk ${index + 1}/${chunks.length} (${lineCount} item(s))...`);

      const translatedChunk = await translator.translateChunk(chunk);
      for (const [id, translation] of translatedChunk.entries()) {
        translationsById.set(id, translation);
      }

      await saveProgress(
        progressPath,
        buildProgressPayload({
          fingerprint,
          inputPath,
          outputPath,
          model: options.model,
          translationsById,
        }),
      );
    }
  }

  if (translationsById.size !== items.length) {
    throw new Error(
      `Expected ${items.length} translations, but only collected ${translationsById.size}.`,
    );
  }

  const outputText = renderBilingualOutput(items, translationsById);
  await fs.writeFile(outputPath, outputText, "utf8");
  await deleteProgress(progressPath);

  console.log(`Done. Wrote translated transcript to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  printSetupHint(error);
  process.exitCode = 1;
});
