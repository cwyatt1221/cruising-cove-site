import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createAdminSession, revokeAdminSession } from "../lib/adminAuth";

export async function adminLogin(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  try {
    const result = await createAdminSession(String(body.password || ""));
    if (!result.ok) {
      return { status: result.status, jsonBody: { error: result.error } };
    }
    return {
      status: 200,
      jsonBody: {
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
      },
    };
  } catch (err) {
    context.error("adminLogin error:", err);
    return { status: 500, jsonBody: { error: "Could not start an admin session." } };
  }
}

export async function adminLogout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    body = {};
  }
  try {
    await revokeAdminSession(String(body.token || request.query.get("key") || ""));
    return { status: 200, jsonBody: { success: true } };
  } catch (err) {
    context.error("adminLogout error:", err);
    return { status: 500, jsonBody: { error: "Could not end session." } };
  }
}

app.http("adminLogin", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "admin-login",
  handler: adminLogin,
});

app.http("adminLogout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin-logout",
  handler: adminLogout,
});
