/**
 * Community moderation unit tests (no test runner dep).
 * Run: npx tsc && node dist/src/lib/communityModeration.test.js
 * Or from api/: npm run test:community-moderation
 */
import assert from "assert";
import {
  isContentVisible,
  isSafeModId,
  isTruthyFlag,
  MUTE_ERROR,
  tableForKind,
} from "./communityModeration";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("isTruthyFlag accepts common truthy encodings", () => {
  assert.strictEqual(isTruthyFlag(true), true);
  assert.strictEqual(isTruthyFlag(1), true);
  assert.strictEqual(isTruthyFlag("true"), true);
  assert.strictEqual(isTruthyFlag("TRUE"), true);
  assert.strictEqual(isTruthyFlag("1"), true);
  assert.strictEqual(isTruthyFlag(false), false);
  assert.strictEqual(isTruthyFlag(0), false);
  assert.strictEqual(isTruthyFlag(""), false);
  assert.strictEqual(isTruthyFlag(undefined), false);
});

test("isContentVisible hides soft-hidden and soft-deleted", () => {
  assert.strictEqual(isContentVisible({}), true);
  assert.strictEqual(isContentVisible({ hidden: false, deleted: false }), true);
  assert.strictEqual(isContentVisible({ hidden: true }), false);
  assert.strictEqual(isContentVisible({ deleted: true }), false);
  assert.strictEqual(isContentVisible({ hidden: "true", deleted: false }), false);
});

test("tableForKind maps content kinds", () => {
  assert.strictEqual(tableForKind("post"), "CommunityPosts");
  assert.strictEqual(tableForKind("reply"), "CommunityReplies");
  assert.strictEqual(tableForKind("chat"), "CommunityChatMessages");
});

test("isSafeModId validates ids", () => {
  assert.strictEqual(isSafeModId("abcd"), true);
  assert.strictEqual(isSafeModId("1234567890abcdef"), true);
  assert.strictEqual(isSafeModId("bad id"), false);
  assert.strictEqual(isSafeModId("x"), false);
});

test("MUTE_ERROR is member-facing", () => {
  assert.ok(MUTE_ERROR.toLowerCase().includes("muted"));
  assert.ok(MUTE_ERROR.toLowerCase().includes("unmuted"));
});

console.log("All community moderation tests passed.");
