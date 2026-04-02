import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChunks,
  createFingerprint,
  parseTranscriptText,
  renderBilingualOutput,
} from "../src/lib/transcript.js";

const CHAPTER_1 = "\uCC55\uD130 1: Introduction";
const CHAPTER_1_KO = "\uCC55\uD130 1: \uC18C\uAC1C";
const GOOD_CS50 = "\uC88B\uC544\uC694, \uC774\uAC83\uC774 CS50\uC785\uB2C8\uB2E4.";

test("parseTranscriptText handles timestamps, headings, and wrapped lines", () => {
  const source = [
    CHAPTER_1,
    "2:03" + "2\uBD84 3\uCD08" + "All right, this is CS50.",
    "continued sentence here",
    "2:12" + "2\uBD84 12\uCD08" + "Harvard University's introduction to computer science.",
  ].join("\n");

  const items = parseTranscriptText(source);

  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    id: 1,
    kind: "freeform",
    source: CHAPTER_1,
  });
  assert.equal(items[1].timestamp, "2:03");
  assert.equal(items[1].source, "All right, this is CS50. continued sentence here");
  assert.equal(items[2].timestamp, "2:12");
});

test("parseTranscriptText accepts zero-second timestamps when the 초 suffix is omitted", () => {
  const source = [
    "6:00" + "6\uBD84" + "So here's how relatively easy it is nowadays to write even your own chatbot using the AI technologies that we already have.",
    "12:00" + "12\uBD84" + "What do we get back?",
    "16:00" + "16\uBD84" + "take out another hand or your toes or the like because it's fairly limiting. But if I think a little harder instead of just using unary, what if I use a different system instead?",
  ].join("\n");

  const items = parseTranscriptText(source);

  assert.equal(items.length, 3);
  assert.equal(items[0].timestamp, "6:00");
  assert.match(items[0].source, /^So here's how relatively easy/);
  assert.equal(items[1].timestamp, "12:00");
  assert.equal(items[1].source, "What do we get back?");
  assert.equal(items[2].timestamp, "16:00");
  assert.match(items[2].source, /^take out another hand or your toes/);
});

test("buildChunks respects item and char limits", () => {
  const items = parseTranscriptText(
    [
      "2:03" + "2\uBD84 3\uCD08" + "One",
      "2:04" + "2\uBD84 4\uCD08" + "Two",
      "2:05" + "2\uBD84 5\uCD08" + "Three",
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
      CHAPTER_1,
      "2:03" + "2\uBD84 3\uCD08" + "All right, this is CS50.",
    ].join("\n"),
  );

  const translations = new Map([
    [1, CHAPTER_1_KO],
    [2, GOOD_CS50],
  ]);

  const output = renderBilingualOutput(items, translations);

  assert.equal(
    output,
    [
      CHAPTER_1,
      CHAPTER_1_KO,
      "",
      "[2:03] All right, this is CS50.",
      `[2:03] ${GOOD_CS50}`,
      "",
    ].join("\n"),
  );
});

test("createFingerprint changes when transcript content changes", () => {
  const left = parseTranscriptText("2:03" + "2\uBD84 3\uCD08" + "One");
  const right = parseTranscriptText("2:03" + "2\uBD84 3\uCD08" + "Two");

  assert.notEqual(createFingerprint(left), createFingerprint(right));
});
