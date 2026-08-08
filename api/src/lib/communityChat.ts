/** Board chat validation helpers (sailing-scoped, members only). */

export const CHAT_MAX_LENGTH = 500;
export const CHAT_MIN_LENGTH = 1;
/** Soft cooldown between messages from the same member on one board. */
export const CHAT_RATE_LIMIT_MS = 4000;
export const CHAT_LIST_LIMIT = 100;

export function normalizeChatBody(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
}

export function validateChatBody(text: string): string | null {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length < CHAT_MIN_LENGTH) return "Message cannot be empty.";
  if (trimmed.length > CHAT_MAX_LENGTH) return `Keep messages under ${CHAT_MAX_LENGTH} characters.`;
  return null;
}

export function isChatRateLimited(
  recent: { userId: string; createdAt: string }[],
  userId: string,
  nowMs: number = Date.now(),
  windowMs: number = CHAT_RATE_LIMIT_MS
): boolean {
  const uid = (userId || "").trim();
  if (!uid || !recent.length) return false;
  let latest = 0;
  for (const m of recent) {
    if (String(m.userId || "") !== uid) continue;
    const t = Date.parse(String(m.createdAt || ""));
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return false;
  return nowMs - latest < windowMs;
}
