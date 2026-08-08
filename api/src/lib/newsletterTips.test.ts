/**
 * Lightweight milestone unit tests (no test runner dep).
 * Run: npx tsc && node dist/src/lib/newsletterTips.test.js
 * Or from api/: npm run test:newsletter-tips (after build).
 */
import assert from "assert";
import {
  daysUntilEmbark,
  parseTipsSent,
  selectMilestone,
  serializeTipsSent,
  shipShortName,
  tipSubject,
  MILESTONES,
} from "./newsletterTips";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("daysUntilEmbark basic", () => {
  assert.strictEqual(daysUntilEmbark("2026-10-01", "2026-09-01"), 30);
  assert.strictEqual(daysUntilEmbark("2026-10-01", "2026-10-01"), 0);
  assert.strictEqual(daysUntilEmbark("2026-09-01", "2026-10-01"), -30);
  assert.strictEqual(daysUntilEmbark("bad", "2026-10-01"), null);
});

test("selectMilestone windows — 90 / 60 / 30 / 14 / 7 / 0", () => {
  assert.strictEqual(selectMilestone(90, [])?.id, "d90");
  assert.strictEqual(selectMilestone(75, [])?.id, "d90");
  assert.strictEqual(selectMilestone(61, [])?.id, "d90");
  assert.strictEqual(selectMilestone(60, [])?.id, "d60");
  assert.strictEqual(selectMilestone(45, [])?.id, "d60");
  assert.strictEqual(selectMilestone(31, [])?.id, "d60");
  assert.strictEqual(selectMilestone(30, [])?.id, "d30");
  assert.strictEqual(selectMilestone(15, [])?.id, "d30");
  assert.strictEqual(selectMilestone(14, [])?.id, "d14");
  assert.strictEqual(selectMilestone(8, [])?.id, "d14");
  assert.strictEqual(selectMilestone(7, [])?.id, "d7");
  assert.strictEqual(selectMilestone(1, [])?.id, "d7");
  assert.strictEqual(selectMilestone(0, [])?.id, "d0");
  assert.strictEqual(selectMilestone(100, []), null);
  assert.strictEqual(selectMilestone(-1, []), null);
});

test("selectMilestone skips already-sent and late signup skips backlog", () => {
  assert.strictEqual(selectMilestone(75, ["d90"]), null);
  assert.strictEqual(selectMilestone(45, ["d60"]), null);
  assert.strictEqual(selectMilestone(45, [])?.id, "d60");
  assert.strictEqual(selectMilestone(25, [])?.id, "d30"); // late signup → current stage only
  assert.strictEqual(selectMilestone(0, ["d0"]), null);
  assert.strictEqual(selectMilestone(3, ["d7"]), null);
});

test("tipsSent parse/serialize", () => {
  assert.deepStrictEqual(parseTipsSent("[]"), []);
  assert.deepStrictEqual(parseTipsSent('["d90","d60"]'), ["d90", "d60"]);
  assert.deepStrictEqual(parseTipsSent(["d30", "nope"]), ["d30"]);
  assert.strictEqual(serializeTipsSent(["d90", "d30"]), '["d90","d30"]');
});

test("subject + ship short name", () => {
  assert.strictEqual(shipShortName("Disney Wish"), "Wish");
  assert.strictEqual(shipShortName("Disney Treasure"), "Treasure");
  const m30 = MILESTONES.find((m) => m.id === "d30")!;
  assert.strictEqual(tipSubject("Disney Wish", m30), "Wish sailing tip: 30 days to go");
  assert.strictEqual(tipSubject("", m30), "Sailing tip: 30 days to go");
});

console.log("All newsletter tip tests passed.");
