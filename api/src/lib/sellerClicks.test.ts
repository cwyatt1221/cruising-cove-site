import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOwnerWeeklyDigest,
  buildSellerWeeklyClickEmail,
  previousUtcWeek,
  weekContainsDay,
} from "./sellerClicks";

describe("previousUtcWeek", () => {
  it("returns the prior Mon–Sun window from a Wednesday", () => {
    const week = previousUtcWeek(new Date("2026-08-12T15:00:00.000Z")); // Wed
    assert.equal(week.weekStartYmd, "2026-08-03");
    assert.equal(week.weekEndYmd, "2026-08-09");
    assert.equal(week.weekEndExclusiveYmd, "2026-08-10");
    assert.equal(weekContainsDay(week, "2026-08-03"), true);
    assert.equal(weekContainsDay(week, "2026-08-09"), true);
    assert.equal(weekContainsDay(week, "2026-08-10"), false);
  });

  it("on Monday reports the week that just ended", () => {
    const week = previousUtcWeek(new Date("2026-08-10T14:00:00.000Z")); // Mon
    assert.equal(week.weekStartYmd, "2026-08-03");
    assert.equal(week.weekEndExclusiveYmd, "2026-08-10");
  });
});

describe("buildSellerWeeklyClickEmail", () => {
  it("includes week clicks and lifetime total", () => {
    const week = previousUtcWeek(new Date("2026-08-10T14:00:00.000Z"));
    const email = buildSellerWeeklyClickEmail({
      shopName: "Bels Castle Creations",
      shopId: "bels-castle-creations",
      weekClicks: 3,
      lifetimeClicks: 11,
      week,
    });
    assert.match(email.subject, /3 shop clicks/);
    assert.match(email.text, /Visit shop clicks: 3/);
    assert.match(email.text, /Lifetime clicks on Cruising Cove: 11/);
    assert.match(email.html, /Bels Castle Creations/);
  });
});

describe("buildOwnerWeeklyDigest", () => {
  it("sums shop rows", () => {
    const week = previousUtcWeek(new Date("2026-08-10T14:00:00.000Z"));
    const digest = buildOwnerWeeklyDigest({
      week,
      rows: [
        { shopName: "A", shopId: "a", weekClicks: 2, emailed: true },
        { shopName: "B", shopId: "b", weekClicks: 5, emailed: false },
      ],
    });
    assert.match(digest.subject, /7 across 2 shops/);
    assert.match(digest.text, /Total Visit shop clicks: 7/);
    assert.match(digest.text, /not emailed/);
  });
});
