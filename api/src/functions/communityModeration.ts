import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { adminAuthOk } from "../lib/adminAuth";
import { corsJson } from "../lib/community";
import {
  listModerationFeed,
  listMutes,
  moderateContent,
  muteMember,
  unmuteMember,
  type ModContentKind,
} from "../lib/communityModeration";

function isKind(value: unknown): value is ModContentKind {
  return value === "post" || value === "reply" || value === "chat";
}

export async function communityModerationGet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return corsJson(401, { error: "Unauthorized." });
  }

  const view = (request.query.get("view") || "feed").trim().toLowerCase();
  const sailingKey = (request.query.get("sailingKey") || "").trim();
  const limitRaw = Number(request.query.get("limit") || "80");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 80;

  try {
    if (view === "mutes") {
      const mutes = await listMutes(sailingKey || undefined, limit);
      return corsJson(200, { mutes });
    }

    const feed = await listModerationFeed({
      sailingKey: sailingKey || undefined,
      limit,
    });
    return corsJson(200, feed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load moderation data.";
    if (message.includes("Invalid sailing")) return corsJson(400, { error: message });
    context.error("communityModerationGet failed:", err);
    return corsJson(500, { error: "Could not load moderation data." });
  }
}

export async function communityModerationPost(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return corsJson(401, { error: "Unauthorized." });
  }

  let body: {
    action?: string;
    kind?: string;
    sailingKey?: string;
    id?: string;
    userId?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const action = String(body.action || "").trim().toLowerCase();
  const sailingKey = String(body.sailingKey || "").trim();

  try {
    if (action === "hide" || action === "delete") {
      if (!isKind(body.kind)) {
        return corsJson(400, { error: "kind must be post, reply, or chat." });
      }
      const result = await moderateContent({
        action,
        kind: body.kind,
        sailingKey,
        id: String(body.id || "").trim(),
      });
      if (!result.ok) return corsJson(result.status, { error: result.error });
      return corsJson(200, { success: true, item: result.item });
    }

    if (action === "mute") {
      const result = await muteMember({
        sailingKey,
        userId: String(body.userId || "").trim(),
        reason: body.reason,
      });
      if (!result.ok) return corsJson(result.status, { error: result.error });
      return corsJson(200, { success: true, mute: result.mute });
    }

    if (action === "unmute") {
      const result = await unmuteMember({
        sailingKey,
        userId: String(body.userId || "").trim(),
      });
      if (!result.ok) return corsJson(result.status, { error: result.error });
      return corsJson(200, { success: true });
    }

    return corsJson(400, { error: "action must be hide, delete, mute, or unmute." });
  } catch (err) {
    context.error("communityModerationPost failed:", err);
    return corsJson(500, { error: "Could not apply moderation action." });
  }
}

async function communityModeration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  if (request.method === "GET") return communityModerationGet(request, context);
  if (request.method === "POST") return communityModerationPost(request, context);
  return corsJson(405, { error: "Method not allowed." });
}

app.http("communityModeration", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/moderation",
  handler: communityModeration,
});
