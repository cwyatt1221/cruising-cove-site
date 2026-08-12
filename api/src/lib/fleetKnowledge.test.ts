/**
 * Fleet knowledge helpers for Ask AI First Mate.
 * Run: npm run test:fleet-knowledge  (from api/)
 */
import assert from "assert";
import {
  FLEET_SHIPS,
  buildChatSystemPrompt,
  buildFleetKnowledgeBlock,
  buildShipFocusBlock,
  findShipsMentioned,
} from "./fleetKnowledge";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok — ${name}`);
  } catch (err) {
    console.error(`FAIL — ${name}`);
    throw err;
  }
}

test("fleet includes Treasure with Hook/Peter stern", () => {
  const treasure = FLEET_SHIPS.find((s) => s.slug === "disney-treasure");
  assert.ok(treasure);
  assert.match(treasure!.stern, /Hook/i);
  assert.match(treasure!.stern, /Peter Pan/i);
});

test("fleet knowledge block lists every sailing ship slug path", () => {
  const block = buildFleetKnowledgeBlock();
  for (const ship of FLEET_SHIPS) {
    assert.ok(block.includes(ship.name), `missing ${ship.name}`);
    assert.ok(block.includes(ship.guidePath), `missing ${ship.guidePath}`);
  }
  assert.ok(block.includes("Captain Hook and Peter Pan"));
});

test("findShipsMentioned matches Treasure question", () => {
  const ships = findShipsMentioned("What character is on the stern of the Disney Treasure?");
  assert.strictEqual(ships.length, 1);
  assert.strictEqual(ships[0].slug, "disney-treasure");
});

test("ship focus block highlights Treasure stern", () => {
  const focus = buildShipFocusBlock("stern of the treasure");
  assert.match(focus, /SHIP FOCUS/);
  assert.match(focus, /Captain Hook and Peter Pan/);
  assert.match(focus, /disney-treasure\.html/);
});

test("buildChatSystemPrompt includes base rules + fleet + focus", () => {
  const prompt = buildChatSystemPrompt("Who is on the Treasure stern?");
  assert.match(prompt, /Ask AI First Mate/);
  assert.match(prompt, /FLEET KNOWLEDGE/);
  assert.match(prompt, /SHIP FOCUS/);
  assert.match(prompt, /Captain Hook and Peter Pan/);
  assert.ok(prompt.length > 2000);
});

console.log("All fleet knowledge tests passed.");
