import {
  CHAT_BASE_SYSTEM_PROMPT,
  buildFleetKnowledgeBlock,
  buildShipFocusBlock,
} from "./fleetKnowledge";
import {
  buildPlanningFocusBlock,
  buildPlanningKnowledgeBlock,
} from "./planningKnowledge";
import { buildRetrievalBlock, type RetrievedSnippet } from "./siteRetrieval";

const GUIDE_LINK_RULES = `
Guide link rules:
- When a Cruising Cove guide applies, end with a line like: Open this guide: https://www.cruisingcove.com/ships/disney-treasure.html
- Prefer https://www.cruisingcove.com + the path from knowledge/retrieval blocks.
- You may include more than one guide link if truly helpful (ship + packing, etc.).
- Do not invent paths. If unsure, link /ships/, /ports/, /planning/disney-cruise-cost.html, or /agents/.
`;

export function buildChatSystemPrompt(
  question: string,
  snippets: RetrievedSnippet[] = []
): string {
  return (
    CHAT_BASE_SYSTEM_PROMPT +
    "\n" +
    GUIDE_LINK_RULES +
    "\n\n" +
    buildFleetKnowledgeBlock() +
    "\n\n" +
    buildPlanningKnowledgeBlock() +
    buildShipFocusBlock(question) +
    buildPlanningFocusBlock(question) +
    buildRetrievalBlock(snippets)
  );
}
