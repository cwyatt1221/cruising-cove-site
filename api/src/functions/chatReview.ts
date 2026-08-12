import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Anthropic from "@anthropic-ai/sdk";
import { adminAuthOk } from "../lib/adminAuth";
import {
  buildKnowledgeGapDigest,
  listRecentChatQuestions,
  reviewChatQuestions,
} from "../lib/chatReview";

function corsJson(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-cc-admin-key",
    },
  };
}

export async function chatReview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  if (!(await adminAuthOk(request))) {
    return corsJson(401, { error: "Admin key required." });
  }

  const days = Number(request.query.get("days") || "7") || 7;
  const limit = Number(request.query.get("limit") || "30") || 30;

  try {
    if (request.method === "GET") {
      const rows = await listRecentChatQuestions({ days, limit });
      return corsJson(200, { count: rows.length, rows });
    }

    const body = (await request.json().catch(() => ({}))) as {
      days?: number;
      limit?: number;
      persist?: boolean;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return corsJson(503, { error: "ANTHROPIC_API_KEY is not configured." });
    }

    const result = await reviewChatQuestions({
      days: body.days ?? days,
      limit: body.limit ?? limit,
      persist: body.persist !== false,
      anthropic: new Anthropic({ apiKey }),
    });

    return corsJson(200, {
      reviewed: result.reviewed.length,
      weakCount: result.weakCount,
      weak: result.reviewed.filter((r) => r.weak),
      digest: buildKnowledgeGapDigest(result.reviewed),
    });
  } catch (err) {
    context.error("chatReview failed:", err);
    return corsJson(500, { error: "Could not review chat questions." });
  }
}

app.http("chatReview", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "chat/review",
  handler: chatReview,
});
