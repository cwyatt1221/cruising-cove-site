import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const TABLE_NAME = "AgentApplications";

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

export async function listAgentApplications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const key = request.query.get("key");
  if (!process.env.REPORT_ACCESS_KEY || key !== process.env.REPORT_ACCESS_KEY) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const statusFilter = request.query.get("status");

  try {
    const client = getTableClient();
    const applications: Record<string, unknown>[] = [];

    for await (const entity of client.listEntities()) {
      if (statusFilter && entity.status !== statusFilter) continue;

      applications.push({
        id: entity.rowKey,
        submittedAt: entity.submittedAt,
        status: entity.status,
        fullName: entity.fullName,
        agency: entity.agency,
        location: entity.location,
        email: entity.email,
        phone: entity.phone,
        website: entity.website || null,
        photoUrl: entity.photoUrl || null,
        pitch: entity.pitch,
        bio: entity.bio,
        specialties: splitCsv(entity.specialties),
        specialtiesOther: entity.specialtiesOther || "",
        yearsExperience: entity.yearsExperience || "",
        sailingsPlanned: entity.sailingsPlanned || "",
        earmarked: entity.earmarked,
        credentialsNotes: entity.credentialsNotes || "",
        whyChooseMe: entity.whyChooseMe || "",
        highlights: entity.highlights || "",
        chargesFees: entity.chargesFees,
        feeNotes: entity.feeNotes || "",
        socialLinks: {
          instagram: entity.instagramUrl || null,
          facebook: entity.facebookUrl || null,
          tiktok: entity.tiktokUrl || null,
        },
        otherNotes: entity.otherNotes || "",
      });
    }

    applications.sort((a: any, b: any) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    return { status: 200, jsonBody: { totalApplications: applications.length, applications } };
  } catch (err) {
    context.error("listAgentApplications error:", err);
    return { status: 500, jsonBody: { error: "Failed to list applications." } };
  }
}

app.http("listAgentApplications", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "agent-applications",
  handler: listAgentApplications,
});
