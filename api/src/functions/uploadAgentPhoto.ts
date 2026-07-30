import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";

const CONTAINER_NAME = "agent-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let containerClientPromise: ReturnType<BlobServiceClient["getContainerClient"]> | null = null;
async function getContainerClient() {
  if (!containerClientPromise) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const container = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await container.createIfNotExists({ access: "blob" });
    containerClientPromise = container as any;
  }
  return containerClientPromise!;
}

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
  if (!ALLOWED_TYPES.has(body.contentType)) {
    return { status: 400, jsonBody: { error: "Only JPEG, PNG, or WEBP images are allowed." } };
  }

  const buffer = Buffer.from(body.base64Data, "base64");
  if (buffer.length > MAX_BYTES) {
    return { status: 400, jsonBody: { error: "Image is too large (max 5MB after compression)." } };
  }

  const extension = body.contentType === "image/png" ? "png" : body.contentType === "image/webp" ? "webp" : "jpg";
  const blobName = `${randomUUID()}.${extension}`;

  try {
    const container = await getContainerClient();
    const blockBlobClient = container.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: body.contentType },
    });

    return { status: 200, jsonBody: { url: blockBlobClient.url } };
  } catch (err) {
    context.error("uploadAgentPhoto error:", err);
    return { status: 500, jsonBody: { error: "Failed to upload image. Please try again." } };
  }
}

app.http("uploadAgentPhoto", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent-photo-upload",
  handler: uploadAgentPhoto,
});
