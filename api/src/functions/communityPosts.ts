import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  MEMBERS_TABLE,
  POSTS_TABLE,
  SAILINGS_TABLE,
  corsJson,
  parseSailingKey,
  postRowKey,
  requireUser,
  table,
} from "../lib/community";

async function assertMember(sailingKey: string, userId: string): Promise<boolean> {
  try {
    await (await table(MEMBERS_TABLE)).getEntity(sailingKey, userId);
    return true;
  } catch {
    return false;
  }
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

export async function listPosts(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  try {
    const posts: ReturnType<typeof serializePost>[] = [];
    const client = await table(POSTS_TABLE);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      posts.push(serializePost(entity as Record<string, unknown>));
      if (posts.length >= 100) break;
    }
    return corsJson(200, { posts });
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

    try {
      const sailings = await table(SAILINGS_TABLE);
      const meta = await sailings.getEntity("sailing", key);
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

    return corsJson(200, {
      success: true,
      post: {
        id: rowKey,
        body: text,
        displayName: user.displayName,
        userId: user.userId,
        createdAt: now,
        updatedAt: "",
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

  try {
    const client = await table(POSTS_TABLE);
    const existing = await client.getEntity(key, postId);
    if (String(existing.userId ?? "") !== user.userId) {
      return corsJson(403, { error: "You can only delete your own posts." });
    }

    await client.deleteEntity(key, postId);

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
