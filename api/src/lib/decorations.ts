import { TableClient, odata } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { ALLOWED_IMAGE_TYPES, uploadPublicImage } from "./blobUpload";
import { escapeHtml, notifyEmail, sendEmail } from "./email";

const TABLE = "DecorationPhotos";
const COMMENTS_TABLE = "DecorationComments";
const CONTAINER = "decoration-photos";

export type DecorationCategory = "door" | "fish-extender" | "other";

function table(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

async function photosClient(): Promise<TableClient> {
  const c = table(TABLE);
  await c.createTable();
  return c;
}

async function commentsClient(): Promise<TableClient> {
  const c = table(COMMENTS_TABLE);
  await c.createTable();
  return c;
}

function toPublic(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey || ""),
    photoUrl: String(entity.photoUrl || ""),
    caption: String(entity.caption || ""),
    category: String(entity.category || "other"),
    ship: String(entity.ship || ""),
    displayName: String(entity.displayName || "Guest"),
    status: String(entity.status || "pending"),
    createdAt: String(entity.createdAt || ""),
    reviewedAt: String(entity.reviewedAt || ""),
    userId: String(entity.userId || ""),
    userEmail: String(entity.userEmail || ""),
  };
}

function commentToPublic(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey || ""),
    photoId: String(entity.photoId || entity.partitionKey || ""),
    body: String(entity.body || ""),
    displayName: String(entity.displayName || "Guest"),
    status: String(entity.status || "pending"),
    createdAt: String(entity.createdAt || ""),
    userId: String(entity.userId || ""),
    userEmail: String(entity.userEmail || ""),
  };
}

export async function listDecorations(status: string): Promise<ReturnType<typeof toPublic>[]> {
  const c = await photosClient();
  const want = status === "all" ? "" : status || "approved";
  const list = [];
  for await (const entity of c.listEntities({
    queryOptions: want
      ? { filter: odata`PartitionKey eq ${"photo"} and status eq ${want}` }
      : { filter: odata`PartitionKey eq ${"photo"}` },
  })) {
    list.push(toPublic(entity as Record<string, unknown>));
  }
  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

export async function getDecoration(id: string): Promise<ReturnType<typeof toPublic> | null> {
  try {
    const c = await photosClient();
    const entity = await c.getEntity("photo", id);
    return toPublic(entity as Record<string, unknown>);
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404) return null;
    throw err;
  }
}

export async function submitDecoration(opts: {
  userId?: string;
  userEmail?: string;
  displayName: string;
  caption: string;
  category: string;
  ship: string;
  contentType: string;
  base64Data: string;
}): Promise<{ id: string; status: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(opts.contentType)) {
    throw new Error("Only JPEG, PNG, or WEBP images are allowed.");
  }
  const category =
    opts.category === "door" || opts.category === "fish-extender" ? opts.category : "other";
  const uploaded = await uploadPublicImage({
    containerName: CONTAINER,
    contentType: opts.contentType,
    base64Data: opts.base64Data,
  });

  const id = randomUUID();
  const now = new Date().toISOString();
  const displayName = opts.displayName.slice(0, 60) || "Guest";
  const userEmail = (opts.userEmail || "").slice(0, 120);
  const c = await photosClient();
  await c.createEntity({
    partitionKey: "photo",
    rowKey: id,
    status: "pending",
    photoUrl: uploaded.url,
    caption: opts.caption.slice(0, 240),
    category,
    ship: opts.ship.slice(0, 80),
    displayName,
    userId: opts.userId || "",
    userEmail,
    createdAt: now,
    reviewedAt: "",
  });

  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
  const fromLine = userEmail ? `${displayName} <${userEmail}>` : displayName;
  const subject = "New gallery photo pending approval";
  const text = [
    "A guest uploaded a photo to the Cruising Cove gallery.",
    "",
    `From: ${fromLine}`,
    `Ship: ${opts.ship || "—"}`,
    `Caption: ${opts.caption || "—"}`,
    "",
    `Review: ${site}/gallery/admin.html`,
  ].join("\n");
  const html = `
    <p>A guest uploaded a photo to the Cruising Cove gallery.</p>
    <ul>
      <li><strong>From:</strong> ${escapeHtml(fromLine)}</li>
      <li><strong>Ship:</strong> ${escapeHtml(opts.ship || "—")}</li>
      <li><strong>Caption:</strong> ${escapeHtml(opts.caption || "—")}</li>
    </ul>
    <p><img src="${escapeHtml(uploaded.url)}" alt="Gallery preview" style="max-width:320px;height:auto;border-radius:2px;"></p>
    <p><a href="${escapeHtml(site)}/gallery/admin.html">Review in admin</a></p>
  `;
  try {
    await sendEmail(notifyEmail(), subject, html, text);
  } catch {
    /* non-fatal */
  }

  return { id, status: "pending" };
}

export async function moderateDecoration(
  id: string,
  action: "approve" | "reject"
): Promise<{ success: true; status: string }> {
  const c = await photosClient();
  const entity = await c.getEntity("photo", id);
  const status = action === "approve" ? "approved" : "rejected";
  await c.updateEntity(
    {
      ...entity,
      partitionKey: "photo",
      rowKey: id,
      status,
      reviewedAt: new Date().toISOString(),
    },
    "Replace"
  );
  return { success: true, status };
}

export async function listComments(
  photoId: string,
  status: string
): Promise<ReturnType<typeof commentToPublic>[]> {
  const c = await commentsClient();
  const want = status === "all" ? "" : status || "approved";
  const list = [];
  for await (const entity of c.listEntities({
    queryOptions: want
      ? { filter: odata`PartitionKey eq ${photoId} and status eq ${want}` }
      : { filter: odata`PartitionKey eq ${photoId}` },
  })) {
    list.push(commentToPublic(entity as Record<string, unknown>));
  }
  list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return list;
}

export async function listCommentsByStatus(
  status: string
): Promise<ReturnType<typeof commentToPublic>[]> {
  const c = await commentsClient();
  const want = status === "all" ? "" : status || "pending";
  const list = [];
  for await (const entity of c.listEntities({
    queryOptions: want ? { filter: odata`status eq ${want}` } : undefined,
  })) {
    list.push(commentToPublic(entity as Record<string, unknown>));
  }
  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

export async function submitComment(opts: {
  photoId: string;
  userId: string;
  userEmail: string;
  displayName: string;
  body: string;
}): Promise<{ id: string; status: string }> {
  const photo = await getDecoration(opts.photoId);
  if (!photo || photo.status !== "approved") {
    throw new Error("Photo not found.");
  }
  const body = opts.body.trim().slice(0, 800);
  if (body.length < 2) throw new Error("Comment is too short.");

  const id = randomUUID();
  const now = new Date().toISOString();
  const c = await commentsClient();
  await c.createEntity({
    partitionKey: opts.photoId,
    rowKey: id,
    photoId: opts.photoId,
    body,
    displayName: opts.displayName.slice(0, 60) || "Guest",
    userId: opts.userId,
    userEmail: opts.userEmail.slice(0, 120),
    status: "pending",
    createdAt: now,
    reviewedAt: "",
  });

  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
  try {
    await sendEmail(
      notifyEmail(),
      "New gallery photo comment pending approval",
      `<p>New comment on a gallery photo.</p>
       <ul>
         <li><strong>From:</strong> ${escapeHtml(opts.displayName)} &lt;${escapeHtml(opts.userEmail)}&gt;</li>
         <li><strong>Comment:</strong> ${escapeHtml(body)}</li>
       </ul>
       <p><a href="${escapeHtml(site)}/gallery/admin.html">Review in admin</a></p>`,
      [
        "New comment on a gallery photo.",
        "",
        `From: ${opts.displayName} <${opts.userEmail}>`,
        `Comment: ${body}`,
        "",
        `Review: ${site}/gallery/admin.html`,
      ].join("\n")
    );
  } catch {
    /* non-fatal */
  }

  return { id, status: "pending" };
}

export async function moderateComment(
  photoId: string,
  commentId: string,
  action: "approve" | "reject"
): Promise<{ success: true; status: string }> {
  const c = await commentsClient();
  const entity = await c.getEntity(photoId, commentId);
  const status = action === "approve" ? "approved" : "rejected";
  await c.updateEntity(
    {
      ...entity,
      partitionKey: photoId,
      rowKey: commentId,
      status,
      reviewedAt: new Date().toISOString(),
    },
    "Replace"
  );
  return { success: true, status };
}
