import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseConnectionString(connectionString: string): { accountName: string; accountKey: string } {
  const parts: Record<string, string> = {};
  for (const segment of connectionString.split(";")) {
    if (!segment) continue;
    const i = segment.indexOf("=");
    if (i <= 0) continue;
    parts[segment.slice(0, i)] = segment.slice(i + 1);
  }
  if (!parts.AccountName || !parts.AccountKey) {
    throw new Error("STORAGE_CONNECTION_STRING must include AccountName and AccountKey.");
  }
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

const containers = new Map<string, ReturnType<BlobServiceClient["getContainerClient"]>>();

async function getContainerClient(containerName: string) {
  const cached = containers.get(containerName);
  if (cached) return cached;

  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const container = blobServiceClient.getContainerClient(containerName);

  // Newer storage accounts often disallow anonymous public access. Create the
  // container privately, then optionally upgrade to public blob read.
  await container.createIfNotExists();
  try {
    await container.setAccessPolicy("blob");
  } catch {
    // Keep private; callers return a long-lived read SAS URL instead.
  }

  containers.set(containerName, container);
  return container;
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadPublicImage(opts: {
  containerName: string;
  contentType: string;
  base64Data: string;
}): Promise<{ url: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(opts.contentType)) {
    throw new Error("Only JPEG, PNG, or WEBP images are allowed.");
  }

  const buffer = Buffer.from(opts.base64Data, "base64");
  if (!buffer.length) throw new Error("Image data was empty.");
  if (buffer.length > MAX_BYTES) throw new Error("Image is too large (max 5MB after compression).");

  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  const { accountName, accountKey } = parseConnectionString(connectionString);
  const credential = new StorageSharedKeyCredential(accountName, accountKey);

  const blobName = `${randomUUID()}.${extensionFor(opts.contentType)}`;
  const container = await getContainerClient(opts.containerName);
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: opts.contentType },
  });

  // Prefer a plain public URL when the container allows anonymous read.
  try {
    const props = await container.getProperties();
    if (props.blobPublicAccess === "blob" || props.blobPublicAccess === "container") {
      return { url: blockBlobClient.url };
    }
  } catch {
    // Fall through to SAS.
  }

  const expiresOn = new Date();
  expiresOn.setFullYear(expiresOn.getFullYear() + 10);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: opts.containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return { url: `${blockBlobClient.url}?${sas}` };
}
