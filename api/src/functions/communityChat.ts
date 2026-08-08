import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  CHAT_MESSAGES_TABLE,
  MEMBERS_TABLE,
  SAILINGS_TABLE,
  corsJson,
  parseSailingKey,
  postRowKey,
  requireUser,
  table,
} from "../lib/community";
import {
  CHAT_LIST_LIMIT,
  CHAT_MAX_LENGTH,
  isChatRateLimited,
  normalizeChatBody,
  validateChatBody,
} from "../lib/communityChat";
import { isContentVisible, isUserMuted, MUTE_ERROR } from "../lib/communityModeration";
import { notifyMembersOfChat } from "../lib/communityNotify";

async function assertMember(sailingKey: string, userId: string): Promise<boolean> {
  try {
    await (await table(MEMBERS_TABLE)).getEntity(sailingKey, userId);
    return true;
  } catch {
    return false;
  }
}

function serializeMessage(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    body: String(entity.body ?? ""),
    displayName: String(entity.displayName ?? "Member"),
    userId: String(entity.userId ?? ""),
    createdAt: String(entity.createdAt ?? ""),
  };
}

async function listRecentForRateLimit(sailingKey: string, limit = 20) {
  const messages: { userId: string; createdAt: string }[] = [];
  const client = await table(CHAT_MESSAGES_TABLE);
  const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${sailingKey}'` } });
  for await (const entity of iter) {
    messages.push({
      userId: String(entity.userId ?? ""),
      createdAt: String(entity.createdAt ?? ""),
    });
    if (messages.length >= limit) break;
  }
  return messages;
}

export async function listChatMessages(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to view board chat." });

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  if (!(await assertMember(key, user.userId))) {
    return corsJson(403, { error: "Join this sailing community to view board chat." });
  }

  try {
    // Reverse-time row keys → newest first; reverse for chronological chat UI.
    const newestFirst: ReturnType<typeof serializeMessage>[] = [];
    const client = await table(CHAT_MESSAGES_TABLE);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      const row = entity as Record<string, unknown>;
      if (!isContentVisible(row)) continue;
      newestFirst.push(serializeMessage(row));
      if (newestFirst.length >= CHAT_LIST_LIMIT) break;
    }
    const messages = newestFirst.slice().reverse();
    return corsJson(200, { messages });
  } catch (err) {
    context.error("listChatMessages failed:", err);
    return corsJson(500, { error: "Could not load chat." });
  }
}

export async function createChatMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to chat." });

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  if (!(await assertMember(key, user.userId))) {
    return corsJson(403, { error: "Join this sailing community before chatting." });
  }

  if (await isUserMuted(key, user.userId)) {
    return corsJson(403, { error: MUTE_ERROR });
  }

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const text = normalizeChatBody(body.body);
  const validationError = validateChatBody(text);
  if (validationError) return corsJson(400, { error: validationError });

  try {
    const recent = await listRecentForRateLimit(key);
    if (isChatRateLimited(recent, user.userId)) {
      return corsJson(429, { error: "Slow down a moment — wait a few seconds between messages." });
    }

    const rowKey = postRowKey();
    const now = new Date().toISOString();

    await (await table(CHAT_MESSAGES_TABLE)).createEntity({
      partitionKey: key,
      rowKey,
      body: text,
      userId: user.userId,
      displayName: user.displayName,
      email: user.email,
      createdAt: now,
    });

    let shipName = "";
    let embarkDate = "";
    try {
      const sailings = await table(SAILINGS_TABLE);
      const meta = await sailings.getEntity("sailing", key);
      shipName = String(meta.shipName ?? "");
      embarkDate = String(meta.embarkDate ?? "");
    } catch {
      /* best-effort */
    }

    if (!shipName || !embarkDate) {
      const parsed = parseSailingKey(key);
      if (parsed) embarkDate = embarkDate || parsed.embarkDate;
    }

    // Await fan-out so Azure doesn't freeze mid-send; failures never fail the chat post.
    await notifyMembersOfChat({
      sailingKey: key,
      actorUserId: user.userId,
      actorName: user.displayName,
      shipName: shipName || "Disney cruise",
      embarkDate,
      log: (...args) => context.warn(String(args[0]), ...args.slice(1)),
    });

    return corsJson(200, {
      success: true,
      message: {
        id: rowKey,
        body: text,
        displayName: user.displayName,
        userId: user.userId,
        createdAt: now,
      },
      maxLength: CHAT_MAX_LENGTH,
    });
  } catch (err) {
    context.error("createChatMessage failed:", err);
    return corsJson(500, { error: "Could not send your message." });
  }
}

async function chatCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return listChatMessages(request, context);
  if (request.method === "POST") return createChatMessage(request, context);
  return corsJson(204, {});
}

app.http("chatCollection", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/chat",
  handler: chatCollection,
});
