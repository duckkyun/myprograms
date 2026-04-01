import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChunks,
  createFingerprint,
  parseTranscriptText,
  renderBilingualOutput,
} from "../src/lib/transcript.js";

test("parseTranscriptText handles timestamps, headings, and wrapped lines", () => {
  const source = [
    "챕터 1: Introduction",
    "2:032분 3초All right, this is CS50.",
    "continued sentence here",
    "2:122분 12초Harvard University's introduction to computer science.",
  ].join("\n");

  const items = parseTranscriptText(source);

  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    id: 1,
    kind: "freeform",
    source: "챕터 1: Introduction",
  });
  assert.equal(items[1].timestamp, "2:03");
  assert.equal(items[1].source, "All right, this is CS50. continued sentence here");
  assert.equal(items[2].timestamp, "2:12");
});

test("buildChunks respects item and char limits", () => {
  const items = parseTranscriptText(
    [
      "2:032분 3초One",
      "2:042분 4초Two",
      "2:052분 5초Three",
    ].join("\n"),
  );

  const chunks = buildChunks(items, { maxItemsPerChunk: 2, maxCharsPerChunk: 10 });
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 2);
  assert.equal(chunks[1].length, 1);
});

test("renderBilingualOutput formats timestamped and freeform lines", () => {
  const items = parseTranscriptText(
    [
      "챕터 1: Introduction",
      "2:032분 3초All right, this is CS50.",
    ].join("\n"),
  );

  const translations = new Map([
    [1, "챕터 1: 소개"],
    [2, "좋아요, 이것이 CS50입니다."],
  ]);

  const output = renderBilingualOutput(items, translations);

  assert.equal(
    output,
    [
      "챕터 1: Introduction",
      "챕터 1: 소개",
      "",
      "[2:03] All right, this is CS50.",
      "[2:03] 좋아요, 이것이 CS50입니다.",
      "",
    ].join("\n"),
  );
});

test("createFingerprint changes when transcript content changes", () => {
  const left = parseTranscriptText("2:032분 3초One");
  const right = parseTranscriptText("2:032분 3초Two");

  assert.notEqual(createFingerprint(left), createFingerprint(right));
});
