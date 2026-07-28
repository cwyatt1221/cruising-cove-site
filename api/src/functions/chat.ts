import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Anthropic from "@anthropic-ai/sdk";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const MAX_QUESTION_LENGTH = 500;
const TABLE_NAME = "ChatQuestions";

const SYSTEM_PROMPT = `You are the Cruising Cove assistant, helping people plan a Disney Cruise Line vacation.

Cruising Cove is an independent, unofficial planning resource. It is not affiliated with, endorsed by, or sponsored by The Walt Disney Company, Disney Cruise Line, or any of their affiliates. Never imply or claim any official Disney affiliation.

Answer clearly and helpfully about DCL ships, staterooms, dining, kids' clubs, shows, ports, departure logistics, budgeting, and travel agents.

If you don't actually know something specific — current exact pricing, a particular stateroom's real guest noise reports, or schedule details that vary by sailing — say so plainly rather than guessing, and suggest the person check the relevant Cruising Cove page or Disney's official site directly.

Keep answers concise: 2-4 sentences unless the question genuinely needs a list.`;

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
    // createTable is safe to call repeatedly; it no-ops if the table already exists.
    await tableClient.createTable();
    tableEnsured = true;
  }
  return tableClient;
}

async function logQuestion(question: string, answer: string, sessionId: string | undefined, context: InvocationContext): Promise<void> {
  try {
    const client = await getTableClient();
    const now = new Date();
    await client.createEntity({
      partitionKey: now.toISOString().slice(0, 10), // yyyy-MM-dd, groups by day
      rowKey: randomUUID(),
      question,
      answer,
      sessionId: sessionId ?? "",
      timestamp: now.toISOString(),
    });
  } catch (err) {
    // Logging failures should never break the user-facing answer.
    context.warn("Failed to log question to Table Storage:", err);
  }
}

export async function chat(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: { question?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const question = (body.question ?? "").trim();
  const sessionId = body.sessionId;

  if (!question) {
    return { status: 400, jsonBody: { error: "A non-empty 'question' field is required." } };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { status: 400, jsonBody: { error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` } };
  }

  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await logQuestion(question, answer, sessionId, context);

    return { status: 200, jsonBody: { answer } };
  } catch (err) {
    context.error("Chat function error:", err);
    return { status: 500, jsonBody: { error: "Something went wrong answering that question. Please try again." } };
  }
}

app.http("chat", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chat",
  handler: chat,
});
