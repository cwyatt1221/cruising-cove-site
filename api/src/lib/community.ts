import { TableClient } from "@azure/data-tables";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const USERS_TABLE = "CommunityUsers";
export const SESSIONS_TABLE = "CommunitySessions";
export const SAILINGS_TABLE = "CommunitySailings";
export const MEMBERS_TABLE = "CommunityMembers";
export const POSTS_TABLE = "CommunityPosts";
export const SIGNUPS_TABLE = "CommunitySignups";

export type SignupType = "fish-extender" | "pixie-dust";

export function isSignupType(value: string): value is SignupType {
  return value === "fish-extender" || value === "pixie-dust";
}

export function signupRowKey(type: SignupType, userId: string): string {
  return `${type}_${userId}`;
}

const clients = new Map<string, TableClient>();

export async function table(name: string): Promise<TableClient> {
  let client = clients.get(name);
  if (!client) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    client = TableClient.fromConnectionString(connectionString, name);
    await client.createTable();
    clients.set(name, client);
  }
  return client;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const realSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, realSalt, 64).toString("hex");
  return { hash, salt: realSalt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sailingKey(shipSlug: string, embarkDate: string): string {
  const ship = shipSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const date = embarkDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Embark date must be YYYY-MM-DD.");
  }
  if (!ship) throw new Error("Ship is required.");
  return `${ship}_${date}`;
}

export function parseSailingKey(key: string): { shipSlug: string; embarkDate: string } | null {
  const m = key.match(/^([a-z0-9-]+)_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { shipSlug: m[1], embarkDate: m[2] };
}

export function shipLabel(slug: string): string {
  const map: Record<string, string> = {
    "disney-wish": "Disney Wish",
    "disney-treasure": "Disney Treasure",
    "disney-destiny": "Disney Destiny",
    "disney-dream": "Disney Dream",
    "disney-fantasy": "Disney Fantasy",
    "disney-magic": "Disney Magic",
    "disney-wonder": "Disney Wonder",
    "disney-adventure": "Disney Adventure",
  };
  return map[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function requireUser(authHeader: string | null): Promise<{
  userId: string;
  email: string;
  displayName: string;
} | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const sessions = await table(SESSIONS_TABLE);
  try {
    const session = await sessions.getEntity("session", token);
    const expiresAt = String(session.expiresAt ?? "");
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      await sessions.deleteEntity("session", token).catch(() => undefined);
      return null;
    }
    return {
      userId: String(session.userId),
      email: String(session.email ?? ""),
      displayName: String(session.displayName ?? "Member"),
    };
  } catch {
    return null;
  }
}

export function corsJson(status: number, body: unknown): {
  status: number;
  jsonBody: unknown;
  headers: Record<string, string>;
} {
  return {
    status,
    jsonBody: body,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    },
  };
}

export function postRowKey(): string {
  // Reverse-time prefix so newest-first scans are natural with lexicographic order
  const inverted = String(9_999_999_999_999 - Date.now()).padStart(13, "0");
  return `${inverted}_${randomBytes(6).toString("hex")}`;
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
