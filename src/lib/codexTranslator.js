import { Codex } from "@openai/codex-sdk";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          translation: { type: "string" },
        },
        required: ["id", "translation"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
};

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Codex did not return valid JSON.");
}

function normalizeTranslations(items, rawResponse) {
  const parsed = JSON.parse(extractJson(rawResponse));
  const translations = parsed.translations;
  if (!Array.isArray(translations)) {
    throw new Error("The response did not include a translations array.");
  }

  const expectedIds = new Set(items.map((item) => item.id));
  const normalized = new Map();

  for (const entry of translations) {
    if (!entry || typeof entry.id !== "number" || typeof entry.translation !== "string") {
      throw new Error("The response contained an invalid translation entry.");
    }

    if (!expectedIds.has(entry.id)) {
      throw new Error(`Unexpected translation id returned: ${entry.id}`);
    }

    const translation = entry.translation.trim();
    if (!translation) {
      throw new Error(`Codex returned an empty translation for item ${entry.id}.`);
    }

    normalized.set(entry.id, translation);
  }

  if (normalized.size !== items.length) {
    throw new Error(
      `Expected ${items.length} translations, but received ${normalized.size}.`,
    );
  }

  return normalized;
}

function buildPrompt(items) {
  const payload = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    timestamp: item.kind === "timestamp" ? item.timestamp : null,
    english: item.source,
  }));

  return [
    "Translate every item into natural Korean.",
    "Rules:",
    "- Translate every item exactly once.",
    "- Do not omit, merge, reorder, summarize, or paraphrase away any item.",
    "- Keep technical terms accurate. Names like CS50, ASCII, Unicode, Python, C, HTML, CSS, and SQL may stay in English when that sounds natural.",
    "- Preserve lecture tone, hesitation, filler words, and emphasis when they matter.",
    "- Do not include timestamps in the translation text itself.",
    "- If an item is already Korean, keep it natural Korean without changing the meaning.",
    "- Return JSON only, matching the provided schema.",
    "",
    "Items:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export class CodexTranscriptTranslator {
  constructor({
    model,
    reasoningEffort = "medium",
    workingDirectory = process.cwd(),
    retries = 3,
  } = {}) {
    this.codex = new Codex();
    this.model = model;
    this.reasoningEffort = reasoningEffort;
    this.workingDirectory = workingDirectory;
    this.retries = retries;
  }

  async translateChunk(items) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        const thread = this.codex.startThread({
          workingDirectory: this.workingDirectory,
          skipGitRepoCheck: true,
          approvalPolicy: "never",
          sandboxMode: "read-only",
          model: this.model,
          modelReasoningEffort: this.reasoningEffort,
          networkAccessEnabled: false,
          webSearchEnabled: false,
        });

        const turn = await thread.run(buildPrompt(items), {
          outputSchema: OUTPUT_SCHEMA,
        });

        return normalizeTranslations(items, turn.finalResponse);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Chunk translation failed after ${this.retries} attempt(s): ${lastError?.message ?? "unknown error"}`,
    );
  }
}

