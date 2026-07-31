import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { TableClient } from "@azure/data-tables";

const SESSIONS_TABLE = "AdminSessions";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function storageTable(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Accepts either REPORT_ACCESS_KEY or a valid admin session token in ?key= (or x-cc-admin-key). */
export async function adminAuthOk(request: {
  query: { get(name: string): string | null };
  headers?: { get(name: string): string | null };
}): Promise<boolean> {
  const key = (
    request.query.get("key") ||
    (request.headers && request.headers.get("x-cc-admin-key")) ||
    ""
  ).trim();
  if (!key) return false;

  const reportKey = process.env.REPORT_ACCESS_KEY || "";
  if (reportKey && safeEqual(key, reportKey)) return true;

  try {
    const client = storageTable(SESSIONS_TABLE);
    await client.createTable();
    const entity = await client.getEntity("session", hashToken(key));
    const expiresAt = String(entity.expiresAt || "");
    if (!expiresAt || Date.parse(expiresAt) < Date.now()) {
      try {
        await client.deleteEntity("session", hashToken(key));
      } catch {
        /* ignore */
      }
      return false;
    }
    return true;
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404) return false;
    throw err;
  }
}

export async function createAdminSession(password: string): Promise<
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; error: string; status: number }
> {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "Admin password login is not configured yet (ADMIN_PASSWORD missing).",
    };
  }
  if (!password || !safeEqual(password, expected)) {
    return { ok: false, status: 401, error: "Incorrect password." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const client = storageTable(SESSIONS_TABLE);
  await client.createTable();
  await client.createEntity({
    partitionKey: "session",
    rowKey: hashToken(token),
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, token, expiresAt };
}

export async function revokeAdminSession(token: string): Promise<void> {
  if (!token) return;
  try {
    const client = storageTable(SESSIONS_TABLE);
    await client.deleteEntity("session", hashToken(token));
  } catch {
    /* ignore missing */
  }
}
