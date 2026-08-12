/**
 * Review logged ChatQuestions for weak answers and knowledge gaps.
 */
import Anthropic from "@anthropic-ai/sdk";
import { TableClient } from "@azure/data-tables";

const QUESTIONS_TABLE = "ChatQuestions";
const REVIEWS_TABLE = "ChatQuestionReviews";

export type LoggedChatRow = {
  partitionKey: string;
  rowKey: string;
  question: string;
  answer: string;
  sessionId?: string;
  timestamp?: string;
  retrievedPaths?: string;
};

export type ChatReviewResult = {
  partitionKey: string;
  rowKey: string;
  question: string;
  answer: string;
  score: number;
  weak: boolean;
  reasons: string[];
  suggestedFix: string;
  knowledgeGap?: string;
};

function storageTable(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

function dayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export async function listRecentChatQuestions(opts?: {
  days?: number;
  limit?: number;
}): Promise<LoggedChatRow[]> {
  const days = Math.min(Math.max(opts?.days ?? 7, 1), 30);
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const client = storageTable(QUESTIONS_TABLE);
  await client.createTable();

  const rows: LoggedChatRow[] = [];
  for (const pk of dayKeys(days)) {
    const iter = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${pk}'` },
    });
    for await (const entity of iter) {
      rows.push({
        partitionKey: String(entity.partitionKey),
        rowKey: String(entity.rowKey),
        question: String(entity.question || ""),
        answer: String(entity.answer || ""),
        sessionId: entity.sessionId != null ? String(entity.sessionId) : undefined,
        timestamp: entity.timestamp != null ? String(entity.timestamp) : undefined,
        retrievedPaths:
          entity.retrievedPaths != null ? String(entity.retrievedPaths) : undefined,
      });
      if (rows.length >= limit * 3) break;
    }
    if (rows.length >= limit * 3) break;
  }

  rows.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  return rows.slice(0, limit);
}

function heuristicWeak(row: LoggedChatRow): { weak: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const a = row.answer.toLowerCase();
  const q = row.question.toLowerCase();

  if (row.answer.trim().length < 40) reasons.push("Answer is very short.");
  if (/\bi('m| am) not sure\b|\bi don't know\b|\bi’m not sure\b/i.test(row.answer)) {
    reasons.push("Answer admits uncertainty.");
  }
  if (/\bstern\b/.test(q) && /treasure/.test(q) && !/hook|peter pan/i.test(row.answer)) {
    reasons.push("Treasure stern question missing Hook/Peter Pan.");
  }
  if (/\b(cost|price|how much)\b/.test(q) && !/\$|dollar|fare|gratuity/i.test(row.answer)) {
    reasons.push("Cost question without concrete cost framing.");
  }
  if (!/cruisingcove\.com|\/ships\/|\/ports\/|\/planning\//i.test(row.answer)) {
    reasons.push("No Cruising Cove guide link/path in answer.");
  }
  if (/as an ai|language model/i.test(a)) reasons.push("Generic AI disclaimer tone.");

  return { weak: reasons.length >= 2 || reasons.some((r) => r.includes("Treasure stern")), reasons };
}

async function gradeWithModel(
  anthropic: Anthropic,
  row: LoggedChatRow
): Promise<Omit<ChatReviewResult, "partitionKey" | "rowKey" | "question" | "answer">> {
  const heuristic = heuristicWeak(row);
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You review Q&A from Cruising Cove's Disney cruise planning chat.
Return ONLY compact JSON:
{"score":1-5,"weak":true|false,"reasons":["..."],"suggestedFix":"...","knowledgeGap":"..."}
score 5 = excellent grounded answer; 1 = wrong/unhelpful.
Mark weak if inaccurate, vague, missing an obvious guide link, or inventing live prices.`,
      messages: [
        {
          role: "user",
          content: `Question: ${row.question}\n\nAnswer: ${row.answer}`,
        },
      ],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in review response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      score?: number;
      weak?: boolean;
      reasons?: string[];
      suggestedFix?: string;
      knowledgeGap?: string;
    };
    const score = Math.min(5, Math.max(1, Number(parsed.score) || 3));
    const reasons = [
      ...heuristic.reasons,
      ...(Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : []),
    ].slice(0, 6);
    return {
      score,
      weak: Boolean(parsed.weak) || heuristic.weak || score <= 2,
      reasons,
      suggestedFix: String(parsed.suggestedFix || "Tighten answer with fleet/planning knowledge + Open this guide link."),
      knowledgeGap: parsed.knowledgeGap ? String(parsed.knowledgeGap) : undefined,
    };
  } catch {
    return {
      score: heuristic.weak ? 2 : 3,
      weak: heuristic.weak,
      reasons: heuristic.reasons.length ? heuristic.reasons : ["Could not model-grade; heuristic only."],
      suggestedFix: "Add missing facts to knowledge cards and require an Open this guide link.",
    };
  }
}

export async function reviewChatQuestions(opts?: {
  days?: number;
  limit?: number;
  persist?: boolean;
  anthropic?: Anthropic;
}): Promise<{ reviewed: ChatReviewResult[]; weakCount: number }> {
  const rows = await listRecentChatQuestions({ days: opts?.days, limit: opts?.limit });
  const anthropic =
    opts?.anthropic ||
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });

  const reviewed: ChatReviewResult[] = [];
  for (const row of rows) {
    const graded = await gradeWithModel(anthropic, row);
    reviewed.push({
      partitionKey: row.partitionKey,
      rowKey: row.rowKey,
      question: row.question,
      answer: row.answer,
      ...graded,
    });
  }

  if (opts?.persist) {
    const reviews = storageTable(REVIEWS_TABLE);
    await reviews.createTable();
    const now = new Date().toISOString();
    for (const item of reviewed.filter((r) => r.weak)) {
      await reviews.upsertEntity({
        partitionKey: item.partitionKey,
        rowKey: item.rowKey,
        question: item.question,
        answer: item.answer,
        score: item.score,
        weak: true,
        reasons: item.reasons.join(" | "),
        suggestedFix: item.suggestedFix,
        knowledgeGap: item.knowledgeGap || "",
        reviewedAt: now,
      });
    }
  }

  return {
    reviewed,
    weakCount: reviewed.filter((r) => r.weak).length,
  };
}

export function buildKnowledgeGapDigest(results: ChatReviewResult[]): string {
  const weak = results.filter((r) => r.weak);
  if (!weak.length) return "No weak answers in this batch.";
  const lines = weak.map(
    (w, i) =>
      `${i + 1}. Q: ${w.question}\n   Score: ${w.score}\n   Reasons: ${w.reasons.join("; ")}\n   Fix: ${w.suggestedFix}\n   Gap: ${w.knowledgeGap || "(none noted)"}`
  );
  return ["Weak Ask AI First Mate answers to improve:", ...lines].join("\n\n");
}
