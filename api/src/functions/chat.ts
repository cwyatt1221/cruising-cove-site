import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Anthropic from "@anthropic-ai/sdk";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { buildChatSystemPrompt } from "../lib/chatPrompt";
import { buildAnthropicMessages, normalizeHistory } from "../lib/chatHistory";
import { retrievePageSnippets } from "../lib/siteRetrieval";

const MAX_QUESTION_LENGTH = 500;
const TABLE_NAME = "ChatQuestions";

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set in the Function App's application settings.");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

let tableClient: TableClient | null = null;
let tableEnsured = false;
async function getTableClient(): Promise<TableClient> {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("STORAGE_CONNECTION_STRING is not set in the Function App's application settings.");
    }
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  }
  if (!tableEnsured) {
    await tableClient.createTable();
    tableEnsured = true;
  }
  return tableClient;
}

async function logQuestion(
  question: string,
  answer: string,
  sessionId: string | undefined,
  context: InvocationContext,
  meta?: { retrievedPaths?: string[]; historyTurns?: number }
): Promise<void> {
  try {
    const client = await getTableClient();
    const now = new Date();
    await client.createEntity({
      partitionKey: now.toISOString().slice(0, 10),
      rowKey: randomUUID(),
      question,
      answer,
      sessionId: sessionId ?? "",
      timestamp: now.toISOString(),
      retrievedPaths: (meta?.retrievedPaths || []).join(","),
      historyTurns: meta?.historyTurns ?? 0,
      needsReview: false,
    });
  } catch (err) {
    context.warn("Failed to log question to Table Storage:", err);
  }
}

function corsJson(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  };
}

export async function chat(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return corsJson(204, {});
  }

  let body: { question?: string; sessionId?: string; history?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const question = (body.question ?? "").trim();
  const sessionId = body.sessionId;
  const history = normalizeHistory(body.history);

  if (!question) {
    return corsJson(400, { error: "A non-empty 'question' field is required." });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return corsJson(400, { error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` });
  }

  try {
    const snippets = await retrievePageSnippets(question, { limit: 2 });
    const system = buildChatSystemPrompt(question, snippets);
    const messages = buildAnthropicMessages(history, question);

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system,
      messages,
    });

    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await logQuestion(question, answer, sessionId, context, {
      retrievedPaths: snippets.map((s) => s.path),
      historyTurns: history.length,
    });

    return corsJson(200, {
      answer,
      guides: snippets.map((s) => ({ title: s.title, url: s.url, path: s.path })),
    });
  } catch (err) {
    context.error("Chat function error:", err);
    return corsJson(500, { error: "Something went wrong answering that question. Please try again." });
  }
}

app.http("chat", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "chat",
  handler: chat,
});
