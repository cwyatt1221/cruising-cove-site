import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ALLOWED_IMAGE_TYPES, uploadPublicImage } from "../lib/blobUpload";
import { requireUser } from "../lib/community";
import { adminAuthOk } from "../lib/adminAuth";
import { listDecorations, moderateDecoration, submitDecoration } from "../lib/decorations";

interface UploadInput {
  scope?: string;
  action?: string;
  id?: string;
  fileName?: string;
  contentType?: string;
  base64Data?: string;
  caption?: string;
  category?: string;
  ship?: string;
  displayName?: string;
}

function cors(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CC-Token, x-cc-admin-key",
    },
  };
}

async function handleAgentPhotoUpload(
  body: UploadInput,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!body.base64Data || !body.contentType) {
    return cors(400, { error: "contentType and base64Data are required." });
  }
  if (!ALLOWED_IMAGE_TYPES.has(body.contentType)) {
    return cors(400, { error: "Only JPEG, PNG, or WEBP images are allowed." });
  }

  try {
    const result = await uploadPublicImage({
      containerName: "agent-photos",
      contentType: body.contentType,
      base64Data: body.base64Data,
    });
    return cors(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload image.";
    context.error("uploadAgentPhoto error:", err);
    if (message.includes("too large") || message.includes("Only JPEG") || message.includes("empty")) {
      return cors(400, { error: message });
    }
    return cors(500, { error: "Failed to upload image. Please try again." });
  }
}

async function handleDecorationsGet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const status = (request.query.get("status") || "approved").trim();
  if (status !== "approved") {
    if (!(await adminAuthOk(request))) {
      return cors(401, { error: "Missing or invalid admin key." });
    }
  }
  try {
    const photos = await listDecorations(status);
    // Public gallery: never expose submitter email/userId.
    if (status === "approved" && !(await adminAuthOk(request))) {
      return cors(200, {
        photos: photos.map(({ userEmail: _e, userId: _u, ...rest }) => rest),
      });
    }
    return cors(200, { photos });
  } catch (err) {
    context.error("listDecorations failed:", err);
    return cors(500, { error: "Could not load decoration photos." });
  }
}

async function handleDecorationsPost(
  request: HttpRequest,
  body: UploadInput,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const action = String(body.action || "upload").trim();
  if (action === "approve" || action === "reject") {
    if (!(await adminAuthOk(request))) {
      return cors(401, { error: "Missing or invalid admin key." });
    }
    const id = String(body.id || "").trim();
    if (!id) return cors(400, { error: "Photo id is required." });
    try {
      const result = await moderateDecoration(id, action);
      return cors(200, result);
    } catch (err) {
      context.error("moderateDecoration failed:", err);
      return cors(404, { error: "Photo not found." });
    }
  }

  const user = await requireUser(request.headers);
  if (!user) {
    return cors(401, { error: "Sign in required to upload a decoration photo." });
  }
  if (!body.base64Data || !body.contentType) {
    return cors(400, { error: "contentType and base64Data are required." });
  }

  try {
    const result = await submitDecoration({
      userId: user.userId,
      userEmail: user.email,
      displayName: String(body.displayName || user.displayName || "Guest").trim(),
      caption: String(body.caption || "").trim(),
      category: String(body.category || "other").trim(),
      ship: String(body.ship || "").trim(),
      contentType: body.contentType,
      base64Data: body.base64Data,
    });
    return cors(200, {
      success: true,
      ...result,
      message: "Thanks! Your photo was submitted and will appear after approval.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    context.error("submitDecoration failed:", err);
    if (message.includes("too large") || message.includes("Only JPEG") || message.includes("empty")) {
      return cors(400, { error: message });
    }
    return cors(500, { error: "Could not submit your photo. Please try again." });
  }
}

export async function uploadAgentPhoto(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return cors(204, {});

  const queryScope = (request.query.get("scope") || "").trim();

  if (request.method === "GET") {
    if (queryScope === "decorations") return handleDecorationsGet(request, context);
    return cors(405, { error: "Method not allowed." });
  }

  let body: UploadInput = {};
  try {
    body = (await request.json()) as UploadInput;
  } catch {
    return cors(400, { error: "Request body must be valid JSON." });
  }

  const scope = queryScope || String(body.scope || "").trim();
  if (scope === "decorations") {
    return handleDecorationsPost(request, body, context);
  }

  return handleAgentPhotoUpload(body, context);
}

app.http("uploadAgentPhoto", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "agent-photo-upload",
  handler: uploadAgentPhoto,
});
