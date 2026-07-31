import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import Anthropic from "@anthropic-ai/sdk";
import { TableClient, odata } from "@azure/data-tables";
import { adminAuthOk } from "../lib/adminAuth";

const TABLE_NAME = "ChatQuestions";
const DEFAULT_DAYS = 30;
const MAX_QUESTIONS_TO_CLUSTER = 300; // caps the clustering call's input cost

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

let tableClient: TableClient | null = null;
function getTableClient(): TableClient {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  }
  return tableClient;
}

interface LoggedQuestion {
  question: string;
  timestamp: string;
}

interface ExactGroup {
  normalized: string;
  example: string;
  count: number;
}

interface Topic {
  topic: string;
  totalCount: number;
  exampleQuestions: string[];
}

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
}

async function fetchRecentQuestions(days: number): Promise<LoggedQuestion[]> {
  const client = getTableClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffPartition = cutoff.toISOString().slice(0, 10);

  const results: LoggedQuestion[] = [];
  const iterator = client.listEntities<LoggedQuestion & { partitionKey: string }>({
    queryOptions: { filter: odata`PartitionKey ge ${cutoffPartition}` },
  });
  for await (const entity of iterator) {
    if (entity.question) {
      results.push({ question: entity.question, timestamp: entity.timestamp as unknown as string });
    }
  }
  return results;
}

function groupExact(questions: LoggedQuestion[]): ExactGroup[] {
  const map = new Map<string, ExactGroup>();
  for (const q of questions) {
    const key = normalize(q.question);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { normalized: key, example: q.question.trim(), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

async function clusterIntoTopics(groups: ExactGroup[]): Promise<Topic[]> {
  if (groups.length === 0) return [];

  const candidates = groups.slice(0, MAX_QUESTIONS_TO_CLUSTER);
  const listText = candidates.map((g, i) => `${i + 1}. (${g.count}x) ${g.example}`).join("\n");

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: `You group visitor questions from a Disney Cruise Line planning site into FAQ topics.

Each input line has a count in parentheses showing how many times a variant of that question was asked.

Group near-duplicate and closely related questions into topics (e.g. "how old for kids club" and "what age is oceaneer club" belong together). Sum the counts for each topic.

Respond with ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
[{"topic": "short topic label", "totalCount": 12, "exampleQuestions": ["...", "..."]}]

Sort by totalCount descending. Include at most 3 example questions per topic (use the original wording). Return at most 20 topics.`,
    messages: [{ role: "user", content: listText }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned) as Topic[];
  } catch {
    // If Claude's output didn't parse cleanly, fall back to the raw exact-match groups
    // rather than failing the whole report.
    return candidates.slice(0, 20).map((g) => ({
      topic: g.example,
      totalCount: g.count,
      exampleQuestions: [g.example],
    }));
  }
}

export async function topQuestions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const daysParam = request.query.get("days");
  const days = daysParam ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || DEFAULT_DAYS)) : DEFAULT_DAYS;

  try {
    const questions = await fetchRecentQuestions(days);
    const exactGroups = groupExact(questions);
    const topics = await clusterIntoTopics(exactGroups);

    return {
      status: 200,
      jsonBody: {
        rangeDays: days,
        totalQuestionsAnalyzed: questions.length,
        uniqueQuestionVariants: exactGroups.length,
        topics,
      },
    };
  } catch (err) {
    context.error("topQuestions error:", err);
    return { status: 500, jsonBody: { error: "Failed to generate report." } };
  }
}

app.http("topQuestions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reports/top-questions",
  handler: topQuestions,
});
