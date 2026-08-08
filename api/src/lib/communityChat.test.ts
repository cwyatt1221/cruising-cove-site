/**
 * Lightweight board-chat unit tests (no test runner dep).
 * Run: npx tsc && node dist/src/lib/communityChat.test.js
 * Or from api/: npm run test:community-chat
 */
import assert from "assert";
import {
  CHAT_MAX_LENGTH,
  CHAT_RATE_LIMIT_MS,
  isChatRateLimited,
  normalizeChatBody,
  validateChatBody,
} from "./communityChat";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("normalizeChatBody trims and caps length", () => {
  assert.strictEqual(normalizeChatBody("  hi  "), "hi");
  const long = "x".repeat(CHAT_MAX_LENGTH + 50);
  assert.strictEqual(normalizeChatBody(long).length, CHAT_MAX_LENGTH);
  assert.strictEqual(normalizeChatBody(null), "");
});

test("validateChatBody rejects empty", () => {
  assert.strictEqual(validateChatBody(""), "Message cannot be empty.");
  assert.strictEqual(validateChatBody("   "), "Message cannot be empty.");
  assert.strictEqual(validateChatBody("hello"), null);
});

test("isChatRateLimited soft window", () => {
  const now = Date.parse("2026-08-08T12:00:00.000Z");
  const recent = [
    { userId: "a", createdAt: "2026-08-08T11:59:58.000Z" }, // 2s ago
    { userId: "b", createdAt: "2026-08-08T11:59:59.000Z" },
  ];
  assert.strictEqual(isChatRateLimited(recent, "a", now, CHAT_RATE_LIMIT_MS), true);
  assert.strictEqual(isChatRateLimited(recent, "b", now, 500), false);
  assert.strictEqual(isChatRateLimited(recent, "c", now), false);
  assert.strictEqual(isChatRateLimited([], "a", now), false);
});

console.log("All community chat tests passed.");
