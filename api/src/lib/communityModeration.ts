/**
 * Community moderation helpers: soft hide/delete flags, per-board mutes, quiet audit log.
 */
import {
  CHAT_MESSAGES_TABLE,
  MEMBERS_TABLE,
  MUTES_TABLE,
  MOD_LOG_TABLE,
  POSTS_TABLE,
  REPLIES_TABLE,
  SAILINGS_TABLE,
  parseSailingKey,
  postRowKey,
  table,
} from "./community";
import { escapeHtml, notifyEmail, sendEmail } from "./email";

export type ModContentKind = "post" | "reply" | "chat";
export type ModAction = "hide" | "delete" | "mute" | "unmute" | "report";

export const MUTE_ERROR = "You are muted on this sailing board and cannot post or chat until unmuted.";

export function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}

/** Public boards omit soft-hidden and soft-deleted content. */
export function isContentVisible(entity: Record<string, unknown>): boolean {
  return !isTruthyFlag(entity.hidden) && !isTruthyFlag(entity.deleted);
}

export function tableForKind(kind: ModContentKind): string {
  if (kind === "post") return POSTS_TABLE;
  if (kind === "reply") return REPLIES_TABLE;
  return CHAT_MESSAGES_TABLE;
}

export function isSafeModId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{4,80}$/.test(value);
}

export async function isUserMuted(sailingKey: string, userId: string): Promise<boolean> {
  const uid = (userId || "").trim();
  if (!sailingKey || !uid) return false;
  try {
    await (await table(MUTES_TABLE)).getEntity(sailingKey, uid);
    return true;
  } catch {
    return false;
  }
}

export async function writeModLog(entry: {
  sailingKey: string;
  action: string;
  kind?: string;
  targetId?: string;
  userId?: string;
  displayName?: string;
  note?: string;
  status?: string;
  reporterUserId?: string;
  reporterDisplayName?: string;
  targetUserId?: string;
  targetDisplayName?: string;
  bodyPreview?: string;
}): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const rowKey = postRowKey();
    await (await table(MOD_LOG_TABLE)).createEntity({
      partitionKey: entry.sailingKey || "global",
      rowKey,
      action: entry.action,
      kind: entry.kind || "",
      targetId: entry.targetId || "",
      userId: entry.userId || "",
      displayName: entry.displayName || "",
      note: (entry.note || "").slice(0, 500),
      status: entry.status || "",
      reporterUserId: entry.reporterUserId || "",
      reporterDisplayName: entry.reporterDisplayName || "",
      targetUserId: entry.targetUserId || "",
      targetDisplayName: entry.targetDisplayName || "",
      bodyPreview: (entry.bodyPreview || "").slice(0, 280),
      createdAt: now,
    });
    return rowKey;
  } catch {
    /* quiet log — never fail the moderation action */
    return null;
  }
}

function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

/** Member report — logs only; does not hide or delete content. */
export async function reportContent(input: {
  sailingKey: string;
  kind: ModContentKind;
  id: string;
  reason?: string;
  reporter: { userId: string; displayName: string; email?: string };
}): Promise<
  | { ok: true; reportId: string }
  | { ok: false; error: string; status: number }
> {
  const key = (input.sailingKey || "").trim();
  const id = (input.id || "").trim();
  if (!key || !parseSailingKey(key)) return { ok: false, status: 400, error: "Invalid sailing key." };
  if (!id || !isSafeModId(id)) return { ok: false, status: 400, error: "Invalid content id." };
  if (input.kind !== "post" && input.kind !== "reply" && input.kind !== "chat") {
    return { ok: false, status: 400, error: "kind must be post, reply, or chat." };
  }

  try {
    await (await table(MEMBERS_TABLE)).getEntity(key, input.reporter.userId);
  } catch {
    return { ok: false, status: 403, error: "Join this sailing community to report content." };
  }

  const client = await table(tableForKind(input.kind));
  let existing: Record<string, unknown>;
  try {
    existing = (await client.getEntity(key, id)) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 404, error: "Content not found." };
  }

  if (!isContentVisible(existing)) {
    return { ok: false, status: 404, error: "Content not found." };
  }

  const targetUserId = String(existing.userId ?? "");
  if (targetUserId && targetUserId === input.reporter.userId) {
    return { ok: false, status: 400, error: "You can’t report your own content." };
  }

  const reason = (input.reason || "").trim().slice(0, 500);
  const bodyPreview = String(existing.body ?? "").trim().slice(0, 280);
  const targetDisplayName = String(existing.displayName ?? "Member");
  const reportId =
    (await writeModLog({
      sailingKey: key,
      action: "report",
      kind: input.kind,
      targetId: id,
      userId: input.reporter.userId,
      displayName: input.reporter.displayName,
      note: reason,
      status: "pending",
      reporterUserId: input.reporter.userId,
      reporterDisplayName: input.reporter.displayName,
      targetUserId,
      targetDisplayName,
      bodyPreview,
    })) || postRowKey();

  const adminUrl = `${siteBase()}/community/admin.html`;
  const sailingUrl = `${siteBase()}/community/sailing.html?key=${encodeURIComponent(key)}`;
  const subject = `Community report: ${input.kind} on ${key}`;
  const text = [
    "A community member reported content on Cruising Cove.",
    "",
    `Sailing: ${key}`,
    `Kind: ${input.kind}`,
    `Content id: ${id}`,
    `Author: ${targetDisplayName} (${targetUserId || "—"})`,
    `Reporter: ${input.reporter.displayName} (${input.reporter.userId})`,
    `Reason: ${reason || "—"}`,
    "",
    `Preview: ${bodyPreview || "—"}`,
    "",
    `Admin: ${adminUrl}`,
    `Board: ${sailingUrl}`,
  ].join("\n");
  const html = `
    <p>A community member reported content on Cruising Cove.</p>
    <ul>
      <li><strong>Sailing:</strong> ${escapeHtml(key)}</li>
      <li><strong>Kind:</strong> ${escapeHtml(input.kind)}</li>
      <li><strong>Content id:</strong> ${escapeHtml(id)}</li>
      <li><strong>Author:</strong> ${escapeHtml(targetDisplayName)} (${escapeHtml(targetUserId || "—")})</li>
      <li><strong>Reporter:</strong> ${escapeHtml(input.reporter.displayName)} (${escapeHtml(input.reporter.userId)})</li>
      <li><strong>Reason:</strong> ${escapeHtml(reason || "—")}</li>
    </ul>
    <p><strong>Preview</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(bodyPreview || "—")}</pre>
    <p><a href="${escapeHtml(adminUrl)}">Open community admin</a> · <a href="${escapeHtml(sailingUrl)}">Open board</a></p>
  `;
  try {
    await sendEmail(notifyEmail(), subject, html, text);
  } catch {
    /* best-effort notify */
  }

  return { ok: true, reportId };
}

export async function listPendingReports(options: {
  sailingKey?: string;
  limit?: number;
}): Promise<
  {
    id: string;
    sailingKey: string;
    kind: string;
    targetId: string;
    status: string;
    reason: string;
    bodyPreview: string;
    reporterUserId: string;
    reporterDisplayName: string;
    targetUserId: string;
    targetDisplayName: string;
    createdAt: string;
  }[]
> {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const sailingKey = (options.sailingKey || "").trim() || undefined;
  if (sailingKey && !parseSailingKey(sailingKey)) {
    throw new Error("Invalid sailing key.");
  }

  const client = await table(MOD_LOG_TABLE);
  const out: {
    id: string;
    sailingKey: string;
    kind: string;
    targetId: string;
    status: string;
    reason: string;
    bodyPreview: string;
    reporterUserId: string;
    reporterDisplayName: string;
    targetUserId: string;
    targetDisplayName: string;
    createdAt: string;
  }[] = [];
  const filter = sailingKey ? `PartitionKey eq '${sailingKey}'` : undefined;
  const iter = client.listEntities(filter ? { queryOptions: { filter } } : undefined);
  for await (const entity of iter) {
    if (String(entity.action ?? "") !== "report") continue;
    const status = String(entity.status ?? "pending").trim().toLowerCase() || "pending";
    if (status !== "pending") continue;
    out.push({
      id: String(entity.rowKey ?? ""),
      sailingKey: String(entity.partitionKey ?? ""),
      kind: String(entity.kind ?? ""),
      targetId: String(entity.targetId ?? ""),
      status,
      reason: String(entity.note ?? ""),
      bodyPreview: String(entity.bodyPreview ?? ""),
      reporterUserId: String(entity.reporterUserId || entity.userId || ""),
      reporterDisplayName: String(entity.reporterDisplayName || entity.displayName || ""),
      targetUserId: String(entity.targetUserId ?? ""),
      targetDisplayName: String(entity.targetDisplayName ?? ""),
      createdAt: String(entity.createdAt ?? ""),
    });
    if (out.length >= limit) break;
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

export async function muteMember(input: {
  sailingKey: string;
  userId: string;
  reason?: string;
}): Promise<{ ok: true; mute: Record<string, string> } | { ok: false; error: string; status: number }> {
  const key = (input.sailingKey || "").trim();
  const userId = (input.userId || "").trim();
  if (!key || !parseSailingKey(key)) return { ok: false, status: 400, error: "Invalid sailing key." };
  if (!userId || !isSafeModId(userId)) return { ok: false, status: 400, error: "Invalid user id." };

  let displayName = "";
  let email = "";
  try {
    const member = await (await table(MEMBERS_TABLE)).getEntity(key, userId);
    displayName = String(member.displayName ?? "");
    email = String(member.email ?? "");
  } catch {
    /* allow mute even if membership row is missing */
  }

  const now = new Date().toISOString();
  const reason = (input.reason || "").trim().slice(0, 500);
  await (await table(MUTES_TABLE)).upsertEntity(
    {
      partitionKey: key,
      rowKey: userId,
      mutedAt: now,
      reason,
      displayName,
      email,
    },
    "Replace"
  );

  await writeModLog({
    sailingKey: key,
    action: "mute",
    userId,
    displayName,
    note: reason,
  });

  return {
    ok: true,
    mute: {
      sailingKey: key,
      userId,
      displayName,
      email,
      mutedAt: now,
      reason,
    },
  };
}

export async function unmuteMember(input: {
  sailingKey: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const key = (input.sailingKey || "").trim();
  const userId = (input.userId || "").trim();
  if (!key || !parseSailingKey(key)) return { ok: false, status: 400, error: "Invalid sailing key." };
  if (!userId || !isSafeModId(userId)) return { ok: false, status: 400, error: "Invalid user id." };

  try {
    await (await table(MUTES_TABLE)).deleteEntity(key, userId);
  } catch {
    return { ok: false, status: 404, error: "Mute not found." };
  }

  await writeModLog({
    sailingKey: key,
    action: "unmute",
    userId,
  });

  return { ok: true };
}

export async function listMutes(sailingKey?: string, limit = 100): Promise<
  {
    sailingKey: string;
    userId: string;
    displayName: string;
    email: string;
    mutedAt: string;
    reason: string;
  }[]
> {
  const client = await table(MUTES_TABLE);
  const out: {
    sailingKey: string;
    userId: string;
    displayName: string;
    email: string;
    mutedAt: string;
    reason: string;
  }[] = [];
  const filter = sailingKey ? `PartitionKey eq '${sailingKey}'` : undefined;
  const iter = client.listEntities(filter ? { queryOptions: { filter } } : undefined);
  for await (const entity of iter) {
    out.push({
      sailingKey: String(entity.partitionKey ?? ""),
      userId: String(entity.rowKey ?? ""),
      displayName: String(entity.displayName ?? ""),
      email: String(entity.email ?? ""),
      mutedAt: String(entity.mutedAt ?? ""),
      reason: String(entity.reason ?? ""),
    });
    if (out.length >= limit) break;
  }
  out.sort((a, b) => String(b.mutedAt).localeCompare(String(a.mutedAt)));
  return out;
}

export async function moderateContent(input: {
  action: "hide" | "delete";
  kind: ModContentKind;
  sailingKey: string;
  id: string;
}): Promise<{ ok: true; item: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const key = (input.sailingKey || "").trim();
  const id = (input.id || "").trim();
  if (!key || !parseSailingKey(key)) return { ok: false, status: 400, error: "Invalid sailing key." };
  if (!id || !isSafeModId(id)) return { ok: false, status: 400, error: "Invalid content id." };
  if (input.kind !== "post" && input.kind !== "reply" && input.kind !== "chat") {
    return { ok: false, status: 400, error: "kind must be post, reply, or chat." };
  }

  const client = await table(tableForKind(input.kind));
  let existing: Record<string, unknown>;
  try {
    existing = (await client.getEntity(key, id)) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 404, error: "Content not found." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    partitionKey: key,
    rowKey: id,
    etag: existing.etag,
    moderatedAt: now,
  };
  if (input.action === "hide") {
    patch.hidden = true;
  } else {
    patch.deleted = true;
    patch.hidden = true;
  }

  await client.updateEntity(patch as Parameters<typeof client.updateEntity>[0], "Merge");

  await writeModLog({
    sailingKey: key,
    action: input.action,
    kind: input.kind,
    targetId: id,
    userId: String(existing.userId ?? ""),
    displayName: String(existing.displayName ?? ""),
  });

  return {
    ok: true,
    item: {
      kind: input.kind,
      id,
      sailingKey: key,
      hidden: true,
      deleted: input.action === "delete",
      moderatedAt: now,
      body: String(existing.body ?? ""),
      displayName: String(existing.displayName ?? ""),
      userId: String(existing.userId ?? ""),
      createdAt: String(existing.createdAt ?? ""),
    },
  };
}

type FeedItem = {
  kind: "post" | "chat";
  id: string;
  sailingKey: string;
  body: string;
  displayName: string;
  userId: string;
  email: string;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

async function collectFromTable(
  tableName: string,
  kind: "post" | "chat",
  sailingKey: string | undefined,
  perPartitionCap: number,
  into: FeedItem[]
): Promise<void> {
  const client = await table(tableName);
  const counts = new Map<string, number>();
  const filter = sailingKey ? `PartitionKey eq '${sailingKey}'` : undefined;
  const iter = client.listEntities(filter ? { queryOptions: { filter } } : undefined);
  for await (const entity of iter) {
    const pk = String(entity.partitionKey ?? "");
    const n = counts.get(pk) || 0;
    if (n >= perPartitionCap) continue;
    counts.set(pk, n + 1);
    into.push({
      kind,
      id: String(entity.rowKey ?? ""),
      sailingKey: pk,
      body: String(entity.body ?? ""),
      displayName: String(entity.displayName ?? "Member"),
      userId: String(entity.userId ?? ""),
      email: String(entity.email ?? ""),
      createdAt: String(entity.createdAt ?? ""),
      hidden: isTruthyFlag(entity.hidden),
      deleted: isTruthyFlag(entity.deleted),
    });
  }
}

export async function listModerationFeed(options: {
  sailingKey?: string;
  limit?: number;
}): Promise<{ items: FeedItem[]; sailingKeys: string[] }> {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const sailingKey = (options.sailingKey || "").trim() || undefined;
  if (sailingKey && !parseSailingKey(sailingKey)) {
    throw new Error("Invalid sailing key.");
  }

  const sailingKeys: string[] = [];
  try {
    const sailings = await table(SAILINGS_TABLE);
    const iter = sailings.listEntities({
      queryOptions: { filter: "PartitionKey eq 'sailing'" },
    });
    for await (const entity of iter) {
      sailingKeys.push(String(entity.rowKey ?? ""));
    }
  } catch {
    /* optional for feed */
  }

  const items: FeedItem[] = [];
  const perPartition = sailingKey ? limit : Math.max(10, Math.ceil(limit / 4));
  await collectFromTable(POSTS_TABLE, "post", sailingKey, perPartition, items);
  await collectFromTable(CHAT_MESSAGES_TABLE, "chat", sailingKey, perPartition, items);

  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { items: items.slice(0, limit), sailingKeys: sailingKeys.sort() };
}
