import crypto from "node:crypto";
import path from "node:path";

const TIMESTAMP_LINE_RE =
  /^(?<timestamp>(?:\d+:)?\d+:\d{2})(?:\d+\uC2DC\uAC04)?(?:\s*\d+\uBD84)?(?:\s*\d+\uCD08)?(?<text>.*)$/u;
const HEADING_LINE_RE = /^(?:chapter|\uCC55\uD130)\s*\d+\s*:/iu;

function isHeadingLine(line) {
  return HEADING_LINE_RE.test(line);
}

export function parseTranscriptText(text) {
  const items = [];
  let nextId = 1;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const timestampMatch = line.match(TIMESTAMP_LINE_RE);
    if (timestampMatch) {
      items.push({
        id: nextId,
        kind: "timestamp",
        timestamp: timestampMatch.groups.timestamp,
        source: timestampMatch.groups.text.trim(),
      });
      nextId += 1;
      continue;
    }

    const previousItem = items.at(-1);
    if (
      previousItem &&
      previousItem.kind === "timestamp" &&
      !isHeadingLine(line)
    ) {
      previousItem.source = `${previousItem.source} ${line}`.trim();
      continue;
    }

    items.push({
      id: nextId,
      kind: "freeform",
      source: line,
    });
    nextId += 1;
  }

  return items;
}

export function buildChunks(items, { maxItemsPerChunk = 30, maxCharsPerChunk = 7000 } = {}) {
  const chunks = [];
  let currentChunk = [];
  let currentChars = 0;

  for (const item of items) {
    const itemChars = item.source.length;
    const shouldFlush =
      currentChunk.length > 0 &&
      (currentChunk.length >= maxItemsPerChunk ||
        currentChars + itemChars > maxCharsPerChunk);

    if (shouldFlush) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(item);
    currentChars += itemChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function renderBilingualOutput(items, translationsById) {
  const lines = [];

  for (const item of items) {
    const translation = translationsById.get(item.id);
    if (!translation) {
      throw new Error(`Missing translation for item ${item.id}.`);
    }

    if (item.kind === "timestamp") {
      lines.push(`[${item.timestamp}] ${item.source}`);
      lines.push(`[${item.timestamp}] ${translation}`);
      lines.push("");
      continue;
    }

    lines.push(item.source);
    lines.push(translation);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function defaultOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_\uBC88\uC5ED\uBCF8${parsed.ext || ".txt"}`);
}

export function defaultProgressPath(outputPath) {
  const parsed = path.parse(outputPath);
  return path.join(parsed.dir, `${parsed.name}.progress.json`);
}

export function createFingerprint(items) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(items))
    .digest("hex");
}
