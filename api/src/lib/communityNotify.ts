/**
 * Community sailing-board email notifications (join + new post + board chat).
 * Preference lives on CommunityMembers.emailNotify (default on).
 */
import { MEMBERS_TABLE, table } from "./community";
import { escapeHtml, sendEmail } from "./email";

export type MemberNotifyRow = {
  userId: string;
  email: string;
  displayName?: string;
  emailNotify?: unknown;
};

const MAX_RECIPIENTS = 80;
const SEND_CONCURRENCY = 5;

export function wantsEmailNotify(emailNotify: unknown): boolean {
  // On by default — only an explicit false opts out (covers missing/legacy rows).
  if (emailNotify === false || emailNotify === "false" || emailNotify === 0) return false;
  return true;
}

export function filterNotifiableMembers(
  members: MemberNotifyRow[],
  excludeUserId: string
): MemberNotifyRow[] {
  const exclude = (excludeUserId || "").trim();
  const out: MemberNotifyRow[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    const userId = String(m.userId || "").trim();
    const email = String(m.email || "")
      .trim()
      .toLowerCase();
    if (!userId || userId === exclude) continue;
    if (!email || !email.includes("@")) continue;
    if (!wantsEmailNotify(m.emailNotify)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ userId, email, displayName: m.displayName, emailNotify: m.emailNotify });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

export function formatEmbarkShort(embarkDate: string): string {
  const m = String(embarkDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(m[3])}`;
}

export function shipShortName(shipName: string): string {
  return String(shipName || "")
    .replace(/^Disney\s+/i, "")
    .trim();
}

export function joinNotifySubject(): string {
  return "Someone joined your sailing board";
}

export function postNotifySubject(shipName: string, embarkDate: string): string {
  const short = shipShortName(shipName) || "sailing";
  const when = formatEmbarkShort(embarkDate);
  if (when) return `New post on your ${short} sailing (${when})`;
  return `New post on your ${short} sailing`;
}

export function chatNotifySubject(shipName: string, embarkDate: string, channel?: string): string {
  const short = shipShortName(shipName) || "sailing";
  const when = formatEmbarkShort(embarkDate);
  const room = channel === "book-trade" ? "book trade chat" : "chat";
  if (when) return `New ${room} on your ${short} sailing (${when})`;
  return `New ${room} on your ${short} sailing`;
}

export function sailingBoardUrl(sailingKey: string, hash?: string): string {
  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
  const base = `${site}/community/sailing.html?key=${encodeURIComponent(sailingKey)}`;
  const fragment = (hash || "").trim().replace(/^#/, "");
  return fragment ? `${base}#${fragment}` : base;
}

export function buildJoinEmail(opts: {
  actorName: string;
  shipName: string;
  embarkDate: string;
  sailingKey: string;
}): { subject: string; html: string; text: string } {
  const who = (opts.actorName || "Someone").trim() || "Someone";
  const ship = (opts.shipName || "your sailing").trim();
  const when = formatEmbarkShort(opts.embarkDate);
  const board = sailingBoardUrl(opts.sailingKey);
  const sailingLine = when ? `${ship} (${when})` : ship;
  const subject = joinNotifySubject();
  const text = [
    `${who} joined the ${sailingLine} sailing board on Cruising Cove.`,
    "",
    `Open the board: ${board}`,
    "",
    "You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.",
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(who)}</strong> joined the <strong>${escapeHtml(sailingLine)}</strong> sailing board on Cruising Cove.</p>
    <p><a href="${escapeHtml(board)}">Open the sailing board</a></p>
    <p style="color:#666;font-size:14px;">You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.</p>
  `;
  return { subject, html, text };
}

export function buildPostEmail(opts: {
  actorName: string;
  shipName: string;
  embarkDate: string;
  sailingKey: string;
}): { subject: string; html: string; text: string } {
  const who = (opts.actorName || "Someone").trim() || "Someone";
  const ship = (opts.shipName || "your sailing").trim();
  const board = sailingBoardUrl(opts.sailingKey);
  const subject = postNotifySubject(ship, opts.embarkDate);
  const short = shipShortName(ship) || "sailing";
  const when = formatEmbarkShort(opts.embarkDate);
  const sailingLine = when ? `${short} sailing (${when})` : `${short} sailing`;
  const text = [
    `${who} posted on your ${sailingLine} board on Cruising Cove.`,
    "",
    `Open the board: ${board}`,
    "",
    "You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.",
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(who)}</strong> posted on your <strong>${escapeHtml(sailingLine)}</strong> board on Cruising Cove.</p>
    <p><a href="${escapeHtml(board)}">Open the sailing board</a></p>
    <p style="color:#666;font-size:14px;">You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.</p>
  `;
  return { subject, html, text };
}

export async function listMembersForNotify(sailingKey: string): Promise<MemberNotifyRow[]> {
  const client = await table(MEMBERS_TABLE);
  const members: MemberNotifyRow[] = [];
  const iter = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${sailingKey}'` },
  });
  for await (const entity of iter) {
    members.push({
      userId: String(entity.rowKey ?? ""),
      email: String(entity.email ?? ""),
      displayName: String(entity.displayName ?? ""),
      emailNotify: entity.emailNotify,
    });
    if (members.length >= 500) break;
  }
  return members;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<boolean>
): Promise<{ attempted: number; sent: number }> {
  let sent = 0;
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) || 0 }, async () => {
    while (idx < items.length) {
      const i = idx++;
      const ok = await fn(items[i]);
      if (ok) sent += 1;
    }
  });
  await Promise.all(workers);
  return { attempted: items.length, sent };
}

/** Best-effort fan-out. Never throws — callers should not fail the HTTP path. */
export async function notifySailingMembers(opts: {
  sailingKey: string;
  excludeUserId: string;
  subject: string;
  html: string;
  text: string;
  log?: (msg: string, ...args: unknown[]) => void;
}): Promise<{ attempted: number; sent: number }> {
  try {
    const members = await listMembersForNotify(opts.sailingKey);
    const recipients = filterNotifiableMembers(members, opts.excludeUserId);
    if (!recipients.length) return { attempted: 0, sent: 0 };

    const result = await mapPool(recipients, SEND_CONCURRENCY, async (m) => {
      try {
        return await sendEmail(m.email, opts.subject, opts.html, opts.text);
      } catch (err) {
        opts.log?.("community notify send failed", m.email, err);
        return false;
      }
    });
    opts.log?.(
      `community notify ${opts.sailingKey}: sent ${result.sent}/${result.attempted} (exclude ${opts.excludeUserId})`
    );
    return result;
  } catch (err) {
    opts.log?.("community notify failed", err);
    return { attempted: 0, sent: 0 };
  }
}

export async function notifyMembersOfJoin(opts: {
  sailingKey: string;
  actorUserId: string;
  actorName: string;
  shipName: string;
  embarkDate: string;
  log?: (msg: string, ...args: unknown[]) => void;
}): Promise<{ attempted: number; sent: number }> {
  const email = buildJoinEmail({
    actorName: opts.actorName,
    shipName: opts.shipName,
    embarkDate: opts.embarkDate,
    sailingKey: opts.sailingKey,
  });
  return notifySailingMembers({
    sailingKey: opts.sailingKey,
    excludeUserId: opts.actorUserId,
    subject: email.subject,
    html: email.html,
    text: email.text,
    log: opts.log,
  });
}

export async function notifyMembersOfPost(opts: {
  sailingKey: string;
  actorUserId: string;
  actorName: string;
  shipName: string;
  embarkDate: string;
  log?: (msg: string, ...args: unknown[]) => void;
}): Promise<{ attempted: number; sent: number }> {
  const email = buildPostEmail({
    actorName: opts.actorName,
    shipName: opts.shipName,
    embarkDate: opts.embarkDate,
    sailingKey: opts.sailingKey,
  });
  return notifySailingMembers({
    sailingKey: opts.sailingKey,
    excludeUserId: opts.actorUserId,
    subject: email.subject,
    html: email.html,
    text: email.text,
    log: opts.log,
  });
}

export function buildChatEmail(opts: {
  actorName: string;
  shipName: string;
  embarkDate: string;
  sailingKey: string;
  channel?: string;
}): { subject: string; html: string; text: string } {
  const who = (opts.actorName || "Someone").trim() || "Someone";
  const ship = (opts.shipName || "your sailing").trim();
  const isBookTrade = opts.channel === "book-trade";
  const board = sailingBoardUrl(opts.sailingKey, isBookTrade ? "btChat" : "boardChat");
  const subject = chatNotifySubject(ship, opts.embarkDate, opts.channel);
  const short = shipShortName(ship) || "sailing";
  const when = formatEmbarkShort(opts.embarkDate);
  const sailingLine = when ? `${short} sailing (${when})` : `${short} sailing`;
  const where = isBookTrade ? `${sailingLine} book trade chat` : `${sailingLine} board`;
  const openLabel = isBookTrade ? "Open book trade chat" : "Open the sailing board";
  const text = [
    `${who} sent a chat message on your ${where} on Cruising Cove.`,
    "",
    `${openLabel}: ${board}`,
    "",
    "You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.",
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(who)}</strong> sent a chat message on your <strong>${escapeHtml(where)}</strong> on Cruising Cove.</p>
    <p><a href="${escapeHtml(board)}">${escapeHtml(openLabel)}</a></p>
    <p style="color:#666;font-size:14px;">You’re getting this because you’re a member of that board. Turn off “Email me about this sailing” on the board anytime.</p>
  `;
  return { subject, html, text };
}

export async function notifyMembersOfChat(opts: {
  sailingKey: string;
  actorUserId: string;
  actorName: string;
  shipName: string;
  embarkDate: string;
  channel?: string;
  log?: (msg: string, ...args: unknown[]) => void;
}): Promise<{ attempted: number; sent: number }> {
  const email = buildChatEmail({
    actorName: opts.actorName,
    shipName: opts.shipName,
    embarkDate: opts.embarkDate,
    sailingKey: opts.sailingKey,
    channel: opts.channel,
  });
  return notifySailingMembers({
    sailingKey: opts.sailingKey,
    excludeUserId: opts.actorUserId,
    subject: email.subject,
    html: email.html,
    text: email.text,
    log: opts.log,
  });
}
