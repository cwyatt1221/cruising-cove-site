import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { randomUUID } from "crypto";
import {
  USERS_TABLE,
  SESSIONS_TABLE,
  corsJson,
  hashPassword,
  normalizeEmail,
  newSessionToken,
  requireUser,
  table,
  verifyPassword,
} from "../lib/community";
import { createAdminSession, revokeAdminSession } from "../lib/adminAuth";

const SESSION_DAYS = 30;

async function createSession(userId: string, email: string, displayName: string) {
  const token = newSessionToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  const sessions = await table(SESSIONS_TABLE);
  await sessions.createEntity({
    partitionKey: "session",
    rowKey: token,
    userId,
    email,
    displayName,
    expiresAt: expires.toISOString(),
    createdAt: new Date().toISOString(),
  });
  return { token, expiresAt: expires.toISOString() };
}

export async function communityRegister(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim().slice(0, 40);

  if (!email || !email.includes("@")) return corsJson(400, { error: "A valid email is required." });
  if (password.length < 8) return corsJson(400, { error: "Password must be at least 8 characters." });
  if (displayName.length < 2) return corsJson(400, { error: "Display name must be at least 2 characters." });

  const users = await table(USERS_TABLE);
  try {
    await users.getEntity("user", email);
    return corsJson(409, { error: "An account with that email already exists. Log in instead." });
  } catch {
    // not found — good
  }

  const userId = randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  try {
    await users.createEntity({
      partitionKey: "user",
      rowKey: email,
      userId,
      email,
      displayName,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
    });
    const session = await createSession(userId, email, displayName);
    return corsJson(200, {
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: { userId, email, displayName },
    });
  } catch (err) {
    context.error("communityRegister failed:", err);
    return corsJson(500, { error: "Could not create your account. Please try again." });
  }
}

export async function communityLogin(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  let body: {
    email?: string;
    password?: string;
    scope?: string;
    action?: string;
    token?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  // Site admin password login/logout — reuses this existing SWA route because
  // new app.http() registrations are currently dropped (managed Functions cap).
  if (String(body.scope || "") === "site-admin") {
    const action = String(body.action || "login");
    try {
      if (action === "logout") {
        await revokeAdminSession(String(body.token || ""));
        return corsJson(200, { success: true });
      }
      const result = await createAdminSession(String(body.password || ""));
      if (!result.ok) {
        return corsJson(result.status, { error: result.error });
      }
      return corsJson(200, {
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      context.error("site-admin login failed:", err);
      return corsJson(500, { error: "Could not start an admin session." });
    }
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!email || !password) return corsJson(400, { error: "Email and password are required." });

  try {
    const users = await table(USERS_TABLE);
    const user = await users.getEntity("user", email);
    const ok = verifyPassword(password, String(user.passwordSalt), String(user.passwordHash));
    if (!ok) return corsJson(401, { error: "Email or password is incorrect." });

    const session = await createSession(
      String(user.userId),
      email,
      String(user.displayName ?? "Member")
    );
    return corsJson(200, {
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        userId: String(user.userId),
        email,
        displayName: String(user.displayName ?? "Member"),
      },
    });
  } catch (err) {
    context.error("communityLogin failed:", err);
    return corsJson(401, { error: "Email or password is incorrect." });
  }
}

export async function communityMe(request: HttpRequest): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Not signed in." });
  return corsJson(200, { user });
}

app.http("communityRegister", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/register",
  handler: communityRegister,
});

app.http("communityLogin", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/login",
  handler: communityLogin,
});

app.http("communityMe", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/me",
  handler: communityMe,
});
