import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ALLOWED_IMAGE_TYPES, uploadPublicImage } from "../lib/blobUpload";

interface UploadInput {
  fileName?: string;
  contentType?: string;
  base64Data?: string;
}

export async function uploadAgentPhoto(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: UploadInput;
  try {
    body = (await request.json()) as UploadInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  if (!body.base64Data || !body.contentType) {
    return { status: 400, jsonBody: { error: "contentType and base64Data are required." } };
  }
  if (!ALLOWED_IMAGE_TYPES.has(body.contentType)) {
    return { status: 400, jsonBody: { error: "Only JPEG, PNG, or WEBP images are allowed." } };
  }

  try {
    const result = await uploadPublicImage({
      containerName: "agent-photos",
      contentType: body.contentType,
      base64Data: body.base64Data,
    });
    return { status: 200, jsonBody: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload image.";
    context.error("uploadAgentPhoto error:", err);
    if (
      message.includes("too large") ||
      message.includes("Only JPEG") ||
      message.includes("empty")
    ) {
      return { status: 400, jsonBody: { error: message } };
    }
    return { status: 500, jsonBody: { error: "Failed to upload image. Please try again." } };
  }
}

app.http("uploadAgentPhoto", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent-photo-upload",
  handler: uploadAgentPhoto,
});
