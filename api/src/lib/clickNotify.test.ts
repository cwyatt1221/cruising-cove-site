import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICK_NOTIFY_COOLDOWN_MS,
  parseVisitCount,
  shouldSendClickNotify,
} from "./clickNotify";

describe("parseVisitCount", () => {
  it("parses numbers and numeric strings", () => {
    assert.equal(parseVisitCount(12), 12);
    assert.equal(parseVisitCount("7"), 7);
    assert.equal(parseVisitCount(" 3 "), 3);
  });

  it("floors and clamps negatives / junk to 0", () => {
    assert.equal(parseVisitCount(3.9), 3);
    assert.equal(parseVisitCount(-2), 0);
    assert.equal(parseVisitCount(""), 0);
    assert.equal(parseVisitCount(undefined), 0);
    assert.equal(parseVisitCount("nope"), 0);
  });
});

describe("shouldSendClickNotify", () => {
  const now = Date.parse("2026-08-08T18:00:00.000Z");

  it("allows when never notified", () => {
    assert.equal(shouldSendClickNotify(undefined, now), true);
    assert.equal(shouldSendClickNotify("", now), true);
  });

  it("blocks within the cooldown window", () => {
    const recent = new Date(now - CLICK_NOTIFY_COOLDOWN_MS + 60_000).toISOString();
    assert.equal(shouldSendClickNotify(recent, now), false);
  });

  it("allows after the cooldown window", () => {
    const old = new Date(now - CLICK_NOTIFY_COOLDOWN_MS).toISOString();
    assert.equal(shouldSendClickNotify(old, now), true);
  });
});
