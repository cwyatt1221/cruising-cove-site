import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const TABLE_NAME = "CreatorApplications";

// ---- Scoring weights (matches the founder's stated framework) ----
const WEIGHT_EXPERIENCE = 0.30;
const WEIGHT_ENGAGEMENT = 0.25;
const WEIGHT_CONTENT_QUALITY = 0.25; // requires human review — see below
const WEIGHT_COMMUNITY_FIT = 0.20;   // requires human review — see below
const PENDING_DIMENSION_PLACEHOLDER = 50; // neutral midpoint used only until reviewed

interface ApplicationInput {
  name?: string;
  creatorName?: string;
  email?: string;
  website?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  contentTypes?: string[];
  contentTypesOther?: string;
  youtubeFollowers?: number;
  instagramFollowers?: number;
  tiktokFollowers?: number;
  otherFollowers?: number;
  avgViews?: number;
  cruisesCount?: string; // "0" | "1-3" | "4-10" | "10+"
  shipsExperienced?: string[];
  shipsOther?: string;
  expertiseAreas?: string[];
  participationInterests?: string[];
  participationOther?: string;
  bestTip?: string;
  uniqueness?: string;
  partnershipInterests?: string[];
  whyJoin?: string;
}

let tableClient: TableClient | null = null;
async function getTableClient(): Promise<TableClient> {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    await tableClient.createTable();
  }
  return tableClient;
}

function cruiseTierScore(tier: string | undefined): number {
  switch (tier) {
    case "0": return 10;
    case "1-3": return 40;
    case "4-10": return 70;
    case "10+": return 100;
    default: return 0;
  }
}

/** 30% factor: cruise count tier, weighted with breadth of ships experienced. */
function computeExperienceScore(cruisesCount: string | undefined, shipsExperienced: string[]): number {
  const tierScore = cruiseTierScore(cruisesCount);
  const breadthScore = Math.min(100, (shipsExperienced.length / 8) * 100);
  return Math.round(tierScore * 0.7 + breadthScore * 0.3);
}

/**
 * 25% factor: audience engagement, NOT raw follower count.
 * If avgViews is provided, uses actual engagement rate (views / followers) — this is
 * the whole point of the founder's stated philosophy that a smaller engaged audience
 * beats a larger passive one. Falls back to a capped, log-scaled follower score only
 * when no view data is available, since raw reach alone is a much weaker signal.
 */
function computeEngagementScore(
  followers: { youtube?: number; instagram?: number; tiktok?: number; other?: number },
  avgViews?: number
): number {
  const totalFollowers = [followers.youtube, followers.instagram, followers.tiktok, followers.other]
    .map((n) => (typeof n === "number" && n > 0 ? n : 0))
    .reduce((a, b) => a + b, 0);

  if (avgViews && avgViews > 0 && totalFollowers > 0) {
    const rate = avgViews / totalFollowers;
    if (rate >= 0.15) return 100;
    if (rate >= 0.05) return 75;
    if (rate >= 0.01) return 50;
    return 25;
  }

  if (totalFollowers <= 0) return 0;
  // Capped at 60 (not 100) since follower count alone, without engagement data,
  // is deliberately treated as a weaker signal per the founder's own framework.
  return Math.round(Math.min(60, Math.log10(totalFollowers + 1) * 15));
}

/** Suggested, not granted — the human reviewer confirms these at approval time. */
function suggestBadges(input: ApplicationInput): string[] {
  const badges: string[] = [];
  const ships = input.shipsExperienced ?? [];
  const expertise = input.expertiseAreas ?? [];
  const participation = input.participationInterests ?? [];

  if (input.cruisesCount === "10+") badges.push("Disney Cruise Expert");
  if (ships.length >= 5 || expertise.includes("Ship tours")) badges.push("Ship Specialist");
  if (expertise.includes("Port adventures") && participation.includes("Share port adventure reviews")) {
    badges.push("Port Adventure Expert");
  }
  // "Founding Creator" is a launch-cohort decision, not data-derived — granted manually.
  return badges;
}

function csv(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}

export async function submitCreatorApplication(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: ApplicationInput;
  try {
    body = (await request.json()) as ApplicationInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  if (!body.name?.trim() || !body.creatorName?.trim() || !body.email?.trim() || !body.website?.trim()) {
    return { status: 400, jsonBody: { error: "Name, creator name, email, and website are required." } };
  }

  const experienceScore = computeExperienceScore(body.cruisesCount, body.shipsExperienced ?? []);
  const engagementScore = computeEngagementScore(
    {
      youtube: body.youtubeFollowers,
      instagram: body.instagramFollowers,
      tiktok: body.tiktokFollowers,
      other: body.otherFollowers,
    },
    body.avgViews
  );

  // Content quality and community fit can't be honestly computed from form data alone —
  // a neutral placeholder is used and the score is flagged as provisional until reviewed.
  const provisionalTotal = Math.round(
    experienceScore * WEIGHT_EXPERIENCE +
    engagementScore * WEIGHT_ENGAGEMENT +
    PENDING_DIMENSION_PLACEHOLDER * WEIGHT_CONTENT_QUALITY +
    PENDING_DIMENSION_PLACEHOLDER * WEIGHT_COMMUNITY_FIT
  );

  const suggestedBadges = suggestBadges(body);

  try {
    const client = await getTableClient();
    const now = new Date();
    await client.createEntity({
      partitionKey: now.toISOString().slice(0, 10),
      rowKey: randomUUID(),
      status: "pending",
      name: body.name.trim(),
      creatorName: body.creatorName.trim(),
      email: body.email.trim(),
      website: body.website.trim(),
      youtubeUrl: body.youtubeUrl ?? "",
      instagramUrl: body.instagramUrl ?? "",
      tiktokUrl: body.tiktokUrl ?? "",
      facebookUrl: body.facebookUrl ?? "",
      contentTypes: csv(body.contentTypes),
      contentTypesOther: body.contentTypesOther ?? "",
      youtubeFollowers: body.youtubeFollowers ?? 0,
      instagramFollowers: body.instagramFollowers ?? 0,
      tiktokFollowers: body.tiktokFollowers ?? 0,
      otherFollowers: body.otherFollowers ?? 0,
      avgViews: body.avgViews ?? 0,
      cruisesCount: body.cruisesCount ?? "",
      shipsExperienced: csv(body.shipsExperienced),
      shipsOther: body.shipsOther ?? "",
      expertiseAreas: csv(body.expertiseAreas),
      participationInterests: csv(body.participationInterests),
      participationOther: body.participationOther ?? "",
      bestTip: body.bestTip ?? "",
      uniqueness: body.uniqueness ?? "",
      partnershipInterests: csv(body.partnershipInterests),
      whyJoin: body.whyJoin ?? "",
      experienceScore,
      engagementScore,
      contentQualityScore: null as unknown as number, // set on manual review
      communityFitScore: null as unknown as number,   // set on manual review
      autoScoreSoFar: provisionalTotal,
      scorePending: true,
      suggestedBadges: csv(suggestedBadges),
      confirmedBadges: "",
      submittedAt: now.toISOString(),
    });
  } catch (err) {
    context.error("Failed to store creator application:", err);
    return { status: 500, jsonBody: { error: "Something went wrong submitting your application. Please try again." } };
  }

  return { status: 200, jsonBody: { success: true } };
}

app.http("submitCreatorApplication", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "creator-application",
  handler: submitCreatorApplication,
});
