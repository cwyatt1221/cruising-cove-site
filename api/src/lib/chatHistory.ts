/**
 * Multi-turn chat history validation for Ask AI First Mate.
 */

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export const MAX_HISTORY_TURNS = 8; // messages, not pairs
export const MAX_HISTORY_MESSAGE_LENGTH = 500;

export function normalizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_HISTORY_MESSAGE_LENGTH);
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  // Keep the most recent N messages.
  return out.slice(-MAX_HISTORY_TURNS);
}

/** Build Anthropic messages: prior turns + current user question. */
export function buildAnthropicMessages(
  history: ChatTurn[],
  question: string
): { role: "user" | "assistant"; content: string }[] {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const turn of history) {
    // Skip a trailing duplicate of the current question if the client included it.
    if (turn.role === "user" && turn.content === question && history.indexOf(turn) === history.length - 1) {
      continue;
    }
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: question });

  // Anthropic requires alternating roles starting with user. Collapse if needed.
  const cleaned: { role: "user" | "assistant"; content: string }[] = [];
  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${msg.content}`;
    } else {
      cleaned.push({ ...msg });
    }
  }
  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ role: "user", content: "(continuing prior chat)" });
  }
  return cleaned;
}
