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

export type ModContentKind = "post" | "reply" | "chat";
export type ModAction = "hide" | "delete" | "mute" | "unmute";

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

async function writeModLog(entry: {
  sailingKey: string;
  action: string;
  kind?: string;
  targetId?: string;
  userId?: string;
  displayName?: string;
  note?: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    await (await table(MOD_LOG_TABLE)).createEntity({
      partitionKey: entry.sailingKey || "global",
      rowKey: postRowKey(),
      action: entry.action,
      kind: entry.kind || "",
      targetId: entry.targetId || "",
      userId: entry.userId || "",
      displayName: entry.displayName || "",
      note: (entry.note || "").slice(0, 500),
      createdAt: now,
    });
  } catch {
    /* quiet log — never fail the moderation action */
  }
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
