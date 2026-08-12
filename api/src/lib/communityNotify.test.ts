/**
 * Lightweight community notify unit tests (no test runner dep).
 * Run: npx tsc && node dist/src/lib/communityNotify.test.js
 * Or from api/: npm run test:community-notify
 */
import assert from "assert";
import {
  buildChatEmail,
  buildJoinEmail,
  buildPostEmail,
  filterNotifiableMembers,
  formatEmbarkShort,
  chatNotifySubject,
  joinNotifySubject,
  postNotifySubject,
  shipShortName,
  wantsEmailNotify,
} from "./communityNotify";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("wantsEmailNotify defaults on", () => {
  assert.strictEqual(wantsEmailNotify(undefined), true);
  assert.strictEqual(wantsEmailNotify(null), true);
  assert.strictEqual(wantsEmailNotify(true), true);
  assert.strictEqual(wantsEmailNotify("true"), true);
  assert.strictEqual(wantsEmailNotify(false), false);
  assert.strictEqual(wantsEmailNotify("false"), false);
  assert.strictEqual(wantsEmailNotify(0), false);
});

test("filterNotifiableMembers skips actor, opt-outs, bad emails, dupes", () => {
  const members = [
    { userId: "a", email: "a@example.com", emailNotify: true },
    { userId: "b", email: "b@example.com" }, // default on
    { userId: "c", email: "c@example.com", emailNotify: false },
    { userId: "d", email: "not-an-email" },
    { userId: "e", email: "b@example.com" }, // dupe email
    { userId: "f", email: "  F@Example.COM  ", emailNotify: true },
  ];
  const got = filterNotifiableMembers(members, "a");
  assert.deepStrictEqual(
    got.map((m) => m.email),
    ["b@example.com", "f@example.com"]
  );
  assert.ok(!got.some((m) => m.userId === "a"));
  assert.ok(!got.some((m) => m.userId === "c"));
});

test("formatEmbarkShort + shipShortName", () => {
  assert.strictEqual(formatEmbarkShort("2026-10-15"), "Oct 15");
  assert.strictEqual(formatEmbarkShort("2026-01-03"), "Jan 3");
  assert.strictEqual(formatEmbarkShort("bad"), "");
  assert.strictEqual(shipShortName("Disney Wish"), "Wish");
  assert.strictEqual(shipShortName("Disney Treasure"), "Treasure");
});

test("subjects", () => {
  assert.strictEqual(joinNotifySubject(), "Someone joined your sailing board");
  assert.strictEqual(
    postNotifySubject("Disney Wish", "2026-10-15"),
    "New post on your Wish sailing (Oct 15)"
  );
  assert.strictEqual(postNotifySubject("Disney Wish", ""), "New post on your Wish sailing");
  assert.strictEqual(
    chatNotifySubject("Disney Wish", "2026-10-15"),
    "New chat on your Wish sailing (Oct 15)"
  );
  assert.strictEqual(chatNotifySubject("Disney Wish", ""), "New chat on your Wish sailing");
});

test("email bodies link to board and omit cabin/passport", () => {
  process.env.PUBLIC_SITE_URL = "https://www.cruisingcove.com";
  const join = buildJoinEmail({
    actorName: "Alex",
    shipName: "Disney Wish",
    embarkDate: "2026-10-15",
    sailingKey: "disney-wish_2026-10-15",
  });
  assert.ok(join.text.includes("Alex joined"));
  assert.ok(join.text.includes("/community/sailing.html?key=disney-wish_2026-10-15"));
  assert.ok(!/cabin|passport|ssn/i.test(join.text + join.html));

  const post = buildPostEmail({
    actorName: "Sam",
    shipName: "Disney Wish",
    embarkDate: "2026-10-15",
    sailingKey: "disney-wish_2026-10-15",
  });
  assert.strictEqual(post.subject, "New post on your Wish sailing (Oct 15)");
  assert.ok(post.html.includes("Open the sailing board"));
  assert.ok(!/cabin|passport/i.test(post.text + post.html));

  const chat = buildChatEmail({
    actorName: "Jordan",
    shipName: "Disney Wish",
    embarkDate: "2026-10-15",
    sailingKey: "disney-wish_2026-10-15",
  });
  assert.strictEqual(chat.subject, "New chat on your Wish sailing (Oct 15)");
  assert.ok(chat.text.includes("Jordan sent a chat message"));
  assert.ok(chat.text.includes("/community/sailing.html?key=disney-wish_2026-10-15#boardChat"));
  assert.ok(!/cabin|passport|payment/i.test(chat.text + chat.html));

  const btChat = buildChatEmail({
    actorName: "Cassondra",
    shipName: "Disney Wish",
    embarkDate: "2026-10-15",
    sailingKey: "disney-wish_2026-10-15",
    channel: "book-trade",
  });
  assert.strictEqual(btChat.subject, "New book trade chat on your Wish sailing (Oct 15)");
  assert.ok(btChat.text.includes("book trade chat"));
  assert.ok(btChat.text.includes("#btChat"));
  assert.ok(btChat.html.includes("Open book trade chat"));
});

console.log("All community notify tests passed.");
