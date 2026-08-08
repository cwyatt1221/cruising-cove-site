import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  MEMBERS_TABLE,
  POSTS_TABLE,
  REPLIES_TABLE,
  SAILINGS_TABLE,
  corsJson,
  parseSailingKey,
  postRowKey,
  requireUser,
  table,
} from "../lib/community";
import { isContentVisible, isUserMuted, MUTE_ERROR } from "../lib/communityModeration";
import { notifyMembersOfPost } from "../lib/communityNotify";

async function assertMember(sailingKey: string, userId: string): Promise<boolean> {
  try {
    await (await table(MEMBERS_TABLE)).getEntity(sailingKey, userId);
    return true;
  } catch {
    return false;
  }
}

function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{4,80}$/.test(value);
}

function serializePost(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    body: String(entity.body ?? ""),
    displayName: String(entity.displayName ?? "Member"),
    userId: String(entity.userId ?? ""),
    createdAt: String(entity.createdAt ?? ""),
    updatedAt: String(entity.updatedAt ?? ""),
  };
}

function serializeReply(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    postId: String(entity.postId ?? ""),
    body: String(entity.body ?? ""),
    displayName: String(entity.displayName ?? "Member"),
    userId: String(entity.userId ?? ""),
    createdAt: String(entity.createdAt ?? ""),
    updatedAt: String(entity.updatedAt ?? ""),
  };
}

async function listRepliesForSailing(sailingKey: string) {
  const replies: ReturnType<typeof serializeReply>[] = [];
  const client = await table(REPLIES_TABLE);
  const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${sailingKey}'` } });
  for await (const entity of iter) {
    const row = entity as Record<string, unknown>;
    if (!isContentVisible(row)) continue;
    replies.push(serializeReply(row));
    if (replies.length >= 500) break;
  }
  replies.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return replies;
}

async function deleteRepliesForPost(sailingKey: string, postId: string) {
  const client = await table(REPLIES_TABLE);
  const iter = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${sailingKey}' and postId eq '${postId}'` },
  });
  for await (const entity of iter) {
    await client.deleteEntity(sailingKey, String(entity.rowKey)).catch(() => undefined);
  }
}

export async function listPosts(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  try {
    const posts: ReturnType<typeof serializePost>[] = [];
    const client = await table(POSTS_TABLE);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      const row = entity as Record<string, unknown>;
      if (!isContentVisible(row)) continue;
      posts.push(serializePost(row));
      if (posts.length >= 100) break;
    }

    const allReplies = await listRepliesForSailing(key);
    const byPost = new Map<string, ReturnType<typeof serializeReply>[]>();
    for (const reply of allReplies) {
      if (!reply.postId) continue;
      const list = byPost.get(reply.postId) || [];
      list.push(reply);
      byPost.set(reply.postId, list);
    }

    return corsJson(200, {
      posts: posts.map((p) => ({
        ...p,
        replies: byPost.get(p.id) || [],
      })),
    });
  } catch (err) {
    context.error("listPosts failed:", err);
    return corsJson(500, { error: "Could not load posts." });
  }
}

export async function createPost(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to post." });

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  if (!(await assertMember(key, user.userId))) {
    return corsJson(403, { error: "Join this sailing community before posting." });
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

  const text = (body.body ?? "").trim().slice(0, 2000);
  if (text.length < 2) return corsJson(400, { error: "Post something a little longer." });

  const rowKey = postRowKey();
  const now = new Date().toISOString();

  try {
    await (await table(POSTS_TABLE)).createEntity({
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
      await sailings.updateEntity(
        {
          partitionKey: "sailing",
          rowKey: key,
          etag: meta.etag,
          postCount: Number(meta.postCount ?? 0) + 1,
        },
        "Merge"
      );
    } catch {
      /* best-effort */
    }

    if (!shipName || !embarkDate) {
      const parsed = parseSailingKey(key);
      if (parsed) embarkDate = embarkDate || parsed.embarkDate;
    }

    // Await fan-out so Azure doesn't freeze mid-send; failures never fail the post.
    await notifyMembersOfPost({
      sailingKey: key,
      actorUserId: user.userId,
      actorName: user.displayName,
      shipName: shipName || "Disney cruise",
      embarkDate,
      log: (...args) => context.warn(String(args[0]), ...args.slice(1)),
    });

    return corsJson(200, {
      success: true,
      post: {
        id: rowKey,
        body: text,
        displayName: user.displayName,
        userId: user.userId,
        createdAt: now,
        updatedAt: "",
        replies: [],
      },
    });
  } catch (err) {
    context.error("createPost failed:", err);
    return corsJson(500, { error: "Could not publish your post." });
  }
}

export async function updatePost(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to edit a post." });

  const key = request.params.sailingKey;
  const postId = (request.params.postId || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!postId) return corsJson(400, { error: "Post id is required." });
  if (!isSafeId(postId)) return corsJson(400, { error: "Invalid post id." });

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const text = (body.body ?? "").trim().slice(0, 2000);
  if (text.length < 2) return corsJson(400, { error: "Post something a little longer." });

  try {
    const client = await table(POSTS_TABLE);
    const existing = await client.getEntity(key, postId);
    if (String(existing.userId ?? "") !== user.userId) {
      return corsJson(403, { error: "You can only edit your own posts." });
    }

    const now = new Date().toISOString();
    await client.updateEntity(
      {
        partitionKey: key,
        rowKey: postId,
        etag: existing.etag,
        body: text,
        updatedAt: now,
      },
      "Merge"
    );

    return corsJson(200, {
      success: true,
      post: {
        id: postId,
        body: text,
        displayName: String(existing.displayName ?? user.displayName),
        userId: user.userId,
        createdAt: String(existing.createdAt ?? ""),
        updatedAt: now,
      },
    });
  } catch (err) {
    context.error("updatePost failed:", err);
    return corsJson(404, { error: "Post not found." });
  }
}

export async function deletePost(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to delete a post." });

  const key = request.params.sailingKey;
  const postId = (request.params.postId || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!postId) return corsJson(400, { error: "Post id is required." });
  if (!isSafeId(postId)) return corsJson(400, { error: "Invalid post id." });

  try {
    const client = await table(POSTS_TABLE);
    const existing = await client.getEntity(key, postId);
    if (String(existing.userId ?? "") !== user.userId) {
      return corsJson(403, { error: "You can only delete your own posts." });
    }

    await client.deleteEntity(key, postId);
    await deleteRepliesForPost(key, postId);

    try {
      const sailings = await table(SAILINGS_TABLE);
      const meta = await sailings.getEntity("sailing", key);
      const next = Math.max(0, Number(meta.postCount ?? 0) - 1);
      await sailings.updateEntity(
        {
          partitionKey: "sailing",
          rowKey: key,
          etag: meta.etag,
          postCount: next,
        },
        "Merge"
      );
    } catch {
      /* best-effort */
    }

    return corsJson(200, { success: true });
  } catch (err) {
    context.error("deletePost failed:", err);
    return corsJson(404, { error: "Post not found." });
  }
}

export async function createReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to reply." });

  const key = request.params.sailingKey;
  const postId = (request.params.postId || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!postId) return corsJson(400, { error: "Post id is required." });
  if (!isSafeId(postId)) return corsJson(400, { error: "Invalid post id." });

  if (!(await assertMember(key, user.userId))) {
    return corsJson(403, { error: "Join this sailing community before replying." });
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

  const text = (body.body ?? "").trim().slice(0, 1500);
  if (text.length < 1) return corsJson(400, { error: "Reply cannot be empty." });

  try {
    const post = (await (await table(POSTS_TABLE)).getEntity(key, postId)) as Record<string, unknown>;
    if (!isContentVisible(post)) return corsJson(404, { error: "Post not found." });
  } catch {
    return corsJson(404, { error: "Post not found." });
  }

  const rowKey = postRowKey();
  const now = new Date().toISOString();

  try {
    await (await table(REPLIES_TABLE)).createEntity({
      partitionKey: key,
      rowKey,
      postId,
      body: text,
      userId: user.userId,
      displayName: user.displayName,
      email: user.email,
      createdAt: now,
    });

    return corsJson(200, {
      success: true,
      reply: {
        id: rowKey,
        postId,
        body: text,
        displayName: user.displayName,
        userId: user.userId,
        createdAt: now,
        updatedAt: "",
      },
    });
  } catch (err) {
    context.error("createReply failed:", err);
    return corsJson(500, { error: "Could not publish your reply." });
  }
}

export async function updateReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to edit a reply." });

  const key = request.params.sailingKey;
  const postId = (request.params.postId || "").trim();
  const replyId = (request.params.replyId || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!postId || !replyId) return corsJson(400, { error: "Post and reply ids are required." });
  if (!isSafeId(postId) || !isSafeId(replyId)) return corsJson(400, { error: "Invalid id." });

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const text = (body.body ?? "").trim().slice(0, 1500);
  if (text.length < 1) return corsJson(400, { error: "Reply cannot be empty." });

  try {
    const client = await table(REPLIES_TABLE);
    const existing = await client.getEntity(key, replyId);
    if (String(existing.postId ?? "") !== postId) {
      return corsJson(404, { error: "Reply not found on this post." });
    }
    if (String(existing.userId ?? "") !== user.userId) {
      return corsJson(403, { error: "You can only edit your own replies." });
    }

    const now = new Date().toISOString();
    await client.updateEntity(
      {
        partitionKey: key,
        rowKey: replyId,
        etag: existing.etag,
        body: text,
        updatedAt: now,
      },
      "Merge"
    );

    return corsJson(200, {
      success: true,
      reply: {
        id: replyId,
        postId,
        body: text,
        displayName: String(existing.displayName ?? user.displayName),
        userId: user.userId,
        createdAt: String(existing.createdAt ?? ""),
        updatedAt: now,
      },
    });
  } catch (err) {
    context.error("updateReply failed:", err);
    return corsJson(404, { error: "Reply not found." });
  }
}

export async function deleteReply(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to delete a reply." });

  const key = request.params.sailingKey;
  const postId = (request.params.postId || "").trim();
  const replyId = (request.params.replyId || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!postId || !replyId) return corsJson(400, { error: "Post and reply ids are required." });
  if (!isSafeId(postId) || !isSafeId(replyId)) return corsJson(400, { error: "Invalid id." });

  try {
    const client = await table(REPLIES_TABLE);
    const existing = await client.getEntity(key, replyId);
    if (String(existing.postId ?? "") !== postId) {
      return corsJson(404, { error: "Reply not found on this post." });
    }
    if (String(existing.userId ?? "") !== user.userId) {
      return corsJson(403, { error: "You can only delete your own replies." });
    }

    await client.deleteEntity(key, replyId);
    return corsJson(200, { success: true });
  } catch (err) {
    context.error("deleteReply failed:", err);
    return corsJson(404, { error: "Reply not found." });
  }
}

async function postsCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return listPosts(request, context);
  if (request.method === "POST") return createPost(request, context);
  return corsJson(204, {});
}

async function postItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "PATCH" || request.method === "PUT") return updatePost(request, context);
  if (request.method === "DELETE") return deletePost(request, context);
  return corsJson(204, {});
}

async function repliesCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "POST") return createReply(request, context);
  return corsJson(204, {});
}

async function replyItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "PATCH" || request.method === "PUT") return updateReply(request, context);
  if (request.method === "DELETE") return deleteReply(request, context);
  return corsJson(204, {});
}

app.http("postsCollection", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/posts",
  handler: postsCollection,
});

app.http("postItem", {
  methods: ["PATCH", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/posts/{postId}",
  handler: postItem,
});

app.http("repliesCollection", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/posts/{postId}/replies",
  handler: repliesCollection,
});

app.http("replyItem", {
  methods: ["PATCH", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/posts/{postId}/replies/{replyId}",
  handler: replyItem,
});
