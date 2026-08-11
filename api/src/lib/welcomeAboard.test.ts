import assert from "assert";
import {
  resolveWelcomeTheme,
  resolveNewsletterWelcomeTheme,
  buildWelcomeAboardEmail,
  buildWelcomeToCoveEmail,
  buildNewsletterWelcomeEmail,
  buildItineraryStops,
  fillPlaceholders,
} from "./welcomeAboard";
import { lookupSailing } from "./sailingCatalog";

assert.strictEqual(resolveWelcomeTheme("disney-dream", "2026-10-16"), "halloween");
assert.strictEqual(resolveWelcomeTheme("disney-wish", "2026-10-16"), "halloween");
assert.strictEqual(resolveWelcomeTheme("disney-destiny", "2026-10-24"), "halloween");
assert.strictEqual(resolveWelcomeTheme("disney-treasure", "2026-12-26"), "base");
assert.strictEqual(resolveWelcomeTheme("disney-fantasy", "2026-11-15"), "christmas");
assert.strictEqual(resolveWelcomeTheme("disney-magic", "2026-06-01"), "base");

assert.strictEqual(resolveNewsletterWelcomeTheme("", ""), "generic");
assert.strictEqual(resolveNewsletterWelcomeTheme("disney-dream", ""), "generic");
assert.strictEqual(resolveNewsletterWelcomeTheme("", "2026-10-16"), "generic");
assert.strictEqual(resolveNewsletterWelcomeTheme("disney-dream", "2026-10-16"), "halloween");

const filled = fillPlaceholders("Hi {{GUEST_NAME}} on {{SHIP_NAME}}", {
  GUEST_NAME: "Bridget",
  SHIP_NAME: "Disney Dream",
});
assert.strictEqual(filled, "Hi Bridget on Disney Dream");

const missing: string[] = [];
fillPlaceholders("{{A}} {{B}}", { A: "1" }, (k) => missing.push(k));
assert.deepStrictEqual(missing, ["B"]);

const email = buildWelcomeAboardEmail({
  name: "Bridget Lebers",
  shipSlug: "disney-dream",
  shipLabel: "Disney Dream",
  embarkationDate: "2026-10-16",
  unsubUrl: "https://www.cruisingcove.com/newsletter/unsubscribe.html",
});
assert.match(email.subject, /Halloween on the High Seas/i);
assert.match(email.html, /Halloween/i);
assert.match(email.html, /Bridget/);
assert.match(email.html, /Itinerary/);
assert.match(email.html, /Lookout Cay/);
assert.match(email.html, /Nassau/);
assert.match(email.html, /Embark/);
assert.match(email.html, /Return/);
assert.match(email.html, /Packing list/);
assert.match(email.html, /disney-cruise-packing-list/);
assert.match(email.html, /Marketplace/);
assert.match(email.html, /Travel agent directory/);
assert.doesNotMatch(email.html, /\{\{[A-Z0-9_]+\}\}/);

const treasure = buildWelcomeAboardEmail({
  name: "Laura",
  shipSlug: "disney-treasure",
  shipLabel: "Disney Treasure",
  embarkationDate: "2026-12-26",
});
assert.doesNotMatch(treasure.subject, /Merrytime|Halloween/i);
assert.doesNotMatch(treasure.html, /Costume Parade/i);
assert.match(treasure.html, /Castaway Cay/);
assert.match(treasure.html, /Cozumel/);
assert.match(treasure.html, /Grand Cayman|Falmouth/);

const destiny = buildWelcomeAboardEmail({
  name: "J",
  shipSlug: "disney-destiny",
  shipLabel: "Disney Destiny",
  embarkationDate: "2026-10-24",
});
assert.match(destiny.html, /Cozumel/);
assert.match(destiny.html, /Castaway Cay/);
assert.match(destiny.html, /At sea/);

const destStops = buildItineraryStops(lookupSailing("disney-destiny", "2026-10-24"), "Fort Lauderdale, FL");
assert.deepStrictEqual(
  destStops.map((s) => s.title),
  [
    "Embark — Fort Lauderdale, FL",
    "At sea",
    "Cozumel, Mexico",
    "At sea",
    "Disney Castaway Cay",
    "Return — Fort Lauderdale, FL",
  ]
);

const cove = buildWelcomeToCoveEmail({ name: "Martina Yost" });
assert.strictEqual(cove.subject, "Welcome to the Cove");
assert.match(cove.html, /Welcome to the Cove/);
assert.match(cove.html, /Martina/);
assert.match(cove.html, /Getting Started/);
assert.match(cove.html, /Key Card/);
assert.match(cove.html, /Muster Drill/);
assert.match(cove.html, /Marketplace/);
assert.match(cove.html, /Travel agent directory/);
assert.match(cove.html, /marketplace\//);
assert.match(cove.html, /agents\//);
assert.doesNotMatch(cove.html, /\{\{[A-Z0-9_]+\}\}/);

const routed = buildNewsletterWelcomeEmail({ name: "Martina Yost" });
assert.strictEqual(routed.subject, "Welcome to the Cove");

console.log("welcomeAboard.test.ts: ok");
