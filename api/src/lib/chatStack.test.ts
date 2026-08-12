/**
 * Chat stack unit tests (knowledge, history, retrieval ranking, review heuristics).
 * Run: npm run test:chat  (from api/)
 */
import assert from "assert";
import { buildAnthropicMessages, normalizeHistory } from "./chatHistory";
import { buildChatSystemPrompt } from "./chatPrompt";
import { findPortsMentioned, buildPlanningKnowledgeBlock } from "./planningKnowledge";
import { findShipsMentioned } from "./fleetKnowledge";
import { htmlToPlainText, rankPagesForQuestion, scorePage, RETRIEVABLE_PAGES } from "./siteRetrieval";
import { buildKnowledgeGapDigest, type ChatReviewResult } from "./chatReview";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("planning knowledge includes Castaway + cost guide", () => {
  const block = buildPlanningKnowledgeBlock();
  assert.match(block, /Castaway Cay/);
  assert.match(block, /disney-cruise-cost\.html/);
  assert.match(block, /disney-cruise-packing-list\.html/);
});

test("findPortsMentioned finds Nassau", () => {
  const ports = findPortsMentioned("What should we do in Nassau?");
  assert.strictEqual(ports[0]?.slug, "nassau");
});

test("normalizeHistory caps and filters", () => {
  const hist = normalizeHistory([
    { role: "user", content: " hi " },
    { role: "system", content: "nope" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "x".repeat(600) },
  ]);
  assert.strictEqual(hist.length, 3);
  assert.strictEqual(hist[0].content, "hi");
  assert.ok(hist[2].content.length <= 500);
});

test("buildAnthropicMessages appends question and alternates", () => {
  const msgs = buildAnthropicMessages(
    [
      { role: "user", content: "Treasure stern?" },
      { role: "assistant", content: "Hook and Peter Pan." },
    ],
    "And the atrium?"
  );
  assert.strictEqual(msgs[0].role, "user");
  assert.strictEqual(msgs[msgs.length - 1].content, "And the atrium?");
  assert.strictEqual(msgs[msgs.length - 1].role, "user");
});

test("rankPagesForQuestion prefers Treasure page", () => {
  const ranked = rankPagesForQuestion("What is on the stern of the Disney Treasure?");
  assert.ok(ranked.length >= 1);
  assert.strictEqual(ranked[0].path, "/ships/disney-treasure.html");
});

test("htmlToPlainText strips tags", () => {
  const text = htmlToPlainText("<html><nav>x</nav><main><p>Hello <b>Treasure</b></p></main></html>");
  assert.match(text, /Hello Treasure/);
  assert.doesNotMatch(text, /<p>/);
});

test("scorePage is zero for unrelated", () => {
  const page = RETRIEVABLE_PAGES.find((p) => p.path.includes("skagway"))!;
  assert.strictEqual(scorePage("what is Palo Steakhouse", page), 0);
});

test("buildChatSystemPrompt includes cards + guide rules", () => {
  const prompt = buildChatSystemPrompt("How much does a Disney cruise cost?", []);
  assert.match(prompt, /PORT \/ PACKING \/ COST/);
  assert.match(prompt, /Open this guide/);
  assert.match(prompt, /FLEET KNOWLEDGE/);
  assert.ok(findShipsMentioned("treasure stern").length === 1);
});

test("buildKnowledgeGapDigest lists weak items", () => {
  const digest = buildKnowledgeGapDigest([
    {
      partitionKey: "2026-08-12",
      rowKey: "1",
      question: "Treasure stern?",
      answer: "Not sure",
      score: 1,
      weak: true,
      reasons: ["missing Hook"],
      suggestedFix: "Add Hook/Peter Pan",
      knowledgeGap: "stern characters",
    } satisfies ChatReviewResult,
  ]);
  assert.match(digest, /Treasure stern/);
  assert.match(digest, /Hook/);
});

console.log("All chat stack tests passed.");
