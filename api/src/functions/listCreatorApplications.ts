import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const TABLE_NAME = "CreatorApplications";

let tableClient: TableClient | null = null;
function getTableClient(): TableClient {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  }
  return tableClient;
}

function splitCsv(value: unknown): string[] {
  const str = typeof value === "string" ? value : "";
  return str ? str.split(", ").filter(Boolean) : [];
}

export async function listCreatorApplications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Reuses REPORT_ACCESS_KEY — same admin-only gate as the top-questions report,
  // to avoid piling up separate secrets for the same person (you).
  const key = request.query.get("key");
  if (!process.env.REPORT_ACCESS_KEY || key !== process.env.REPORT_ACCESS_KEY) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const statusFilter = request.query.get("status"); // optional: "pending" | "approved" | "rejected"

  try {
    const client = getTableClient();
    const applications: Record<string, unknown>[] = [];

    for await (const entity of client.listEntities()) {
      if (statusFilter && entity.status !== statusFilter) continue;

      applications.push({
        id: entity.rowKey,
        submittedAt: entity.submittedAt,
        status: entity.status,
        name: entity.name,
        creatorName: entity.creatorName,
        email: entity.email,
        website: entity.website,
        socialLinks: {
          youtube: entity.youtubeUrl || null,
          instagram: entity.instagramUrl || null,
          tiktok: entity.tiktokUrl || null,
          facebook: entity.facebookUrl || null,
        },
        contentTypes: splitCsv(entity.contentTypes),
        followers: {
          youtube: entity.youtubeFollowers,
          instagram: entity.instagramFollowers,
          tiktok: entity.tiktokFollowers,
          other: entity.otherFollowers,
        },
        avgViews: entity.avgViews,
        cruisesCount: entity.cruisesCount,
        shipsExperienced: splitCsv(entity.shipsExperienced),
        expertiseAreas: splitCsv(entity.expertiseAreas),
        participationInterests: splitCsv(entity.participationInterests),
        bestTip: entity.bestTip,
        uniqueness: entity.uniqueness,
        partnershipInterests: splitCsv(entity.partnershipInterests),
        whyJoin: entity.whyJoin,
        scoring: {
          experienceScore: entity.experienceScore,
          engagementScore: entity.engagementScore,
          contentQualityScore: entity.contentQualityScore,
          communityFitScore: entity.communityFitScore,
          autoScoreSoFar: entity.autoScoreSoFar,
          scorePending: entity.scorePending,
        },
        suggestedBadges: splitCsv(entity.suggestedBadges),
        confirmedBadges: splitCsv(entity.confirmedBadges),
      });
    }

    applications.sort((a: any, b: any) => (b.scoring.autoScoreSoFar ?? 0) - (a.scoring.autoScoreSoFar ?? 0));

    return {
      status: 200,
      jsonBody: {
        totalApplications: applications.length,
        applications,
      },
    };
  } catch (err) {
    context.error("listCreatorApplications error:", err);
    return { status: 500, jsonBody: { error: "Failed to list applications." } };
  }
}

app.http("listCreatorApplications", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "creator-applications",
  handler: listCreatorApplications,
});
