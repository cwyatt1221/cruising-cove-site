import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  APPLICATIONS_TABLE,
  PUBLISHED_TABLE,
  adminKeyOk,
  earmarkedBool,
  sailingsNumber,
  slugifyName,
  table,
  toPublicAgent,
  yearsNumber,
} from "../lib/agents";

interface ModerateBody {
  partitionKey?: string;
  action?: string;
  featured?: boolean;
  agentId?: string;
}

async function uniqueAgentId(preferred: string): Promise<string> {
  const client = table(PUBLISHED_TABLE);
  await client.createTable();
  let candidate = preferred;
  let n = 2;
  while (true) {
    try {
      await client.getEntity("directory", candidate);
      candidate = `${preferred}-${n}`;
      n += 1;
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404) return candidate;
      throw err;
    }
  }
}

export async function moderateAgentApplication(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminKeyOk(request))) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const rowKey = (request.params.id || "").trim();
  if (!rowKey) return { status: 400, jsonBody: { error: "Application id is required." } };

  let body: ModerateBody;
  try {
    body = (await request.json()) as ModerateBody;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const partitionKey = (body.partitionKey || "").trim();
  const action = (body.action || "").trim().toLowerCase();
  if (!partitionKey) return { status: 400, jsonBody: { error: "partitionKey is required." } };
  if (!["approve", "reject", "unpublish"].includes(action)) {
    return { status: 400, jsonBody: { error: "action must be approve, reject, or unpublish." } };
  }

  try {
    const apps = table(APPLICATIONS_TABLE);
    const published = table(PUBLISHED_TABLE);
    await published.createTable();

    const application = await apps.getEntity(partitionKey, rowKey);
    const now = new Date().toISOString();

    if (action === "reject") {
      await apps.updateEntity(
        {
          partitionKey,
          rowKey,
          status: "rejected",
          moderatedAt: now,
          publishedAgentId: application.publishedAgentId || "",
        },
        "Merge"
      );
      return { status: 200, jsonBody: { success: true, status: "rejected" } };
    }

    if (action === "unpublish") {
      const existingId = String(application.publishedAgentId || "").trim();
      if (existingId) {
        try {
          await published.updateEntity(
            {
              partitionKey: "directory",
              rowKey: existingId,
              status: "unpublished",
              unpublishedAt: now,
            },
            "Merge"
          );
        } catch (err: unknown) {
          const status =
            typeof err === "object" && err && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          if (status !== 404) throw err;
        }
      }
      await apps.updateEntity(
        {
          partitionKey,
          rowKey,
          status: "unpublished",
          moderatedAt: now,
          publishedAgentId: existingId,
        },
        "Merge"
      );
      return { status: 200, jsonBody: { success: true, status: "unpublished" } };
    }

    // approve / publish
    const preferred =
      slugifyName((body.agentId || "").trim()) ||
      slugifyName(String(application.publishedAgentId || "")) ||
      slugifyName(String(application.fullName || "agent"));

    const existingId = String(application.publishedAgentId || "").trim();
    const agentId = existingId || (await uniqueAgentId(preferred));
    const featured = Boolean(body.featured);

    const entity = {
      partitionKey: "directory",
      rowKey: agentId,
      status: "published",
      name: String(application.fullName || "").trim(),
      agency: String(application.agency || "").trim(),
      location: String(application.location || "").trim(),
      emailNotify: String(application.email || "").trim(),
      phone: String(application.phone || "").trim(),
      website: String(application.website || "").trim(),
      photoUrl: String(application.photoUrl || "").trim(),
      pitch: String(application.pitch || "").trim(),
      bio: String(application.bio || "").trim(),
      specialties: String(application.specialties || "").trim(),
      specialtiesOther: String(application.specialtiesOther || "").trim(),
      yearsExperience: String(application.yearsExperience || "").trim(),
      sailingsPlanned: String(application.sailingsPlanned || "").trim(),
      sailingsSailed: String(application.sailingsSailed || "").trim(),
      shipsSailed: String(application.shipsSailed || "").trim(),
      years: yearsNumber(application.yearsExperience) ?? 0,
      sailings: sailingsNumber(application.sailingsPlanned) ?? 0,
      earmarked: earmarkedBool(application.earmarked),
      earmarkedStatus: String(application.earmarked || "").trim(),
      credentialsNotes: String(application.credentialsNotes || "").trim(),
      whyChooseMe: String(application.whyChooseMe || "").trim(),
      highlights: String(application.highlights || "").trim(),
      chargesFees: String(application.chargesFees || "").trim(),
      feeNotes: String(application.feeNotes || "").trim(),
      instagramUrl: String(application.instagramUrl || "").trim(),
      facebookUrl: String(application.facebookUrl || "").trim(),
      tiktokUrl: String(application.tiktokUrl || "").trim(),
      featured,
      sample: false,
      applicationPartitionKey: partitionKey,
      applicationRowKey: rowKey,
      publishedAt: now,
      unpublishedAt: "",
    };

    try {
      await published.createEntity(entity);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 409) {
        await published.updateEntity(entity, "Merge");
      } else {
        throw err;
      }
    }

    await apps.updateEntity(
      {
        partitionKey,
        rowKey,
        status: "approved",
        moderatedAt: now,
        publishedAgentId: agentId,
        featured,
      },
      "Merge"
    );

    const publicAgent = toPublicAgent(entity as unknown as Record<string, unknown>);
    return {
      status: 200,
      jsonBody: {
        success: true,
        status: "approved",
        agent: publicAgent,
        profilePath: `/agents/profile.html?id=${encodeURIComponent(agentId)}`,
      },
    };
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404) return { status: 404, jsonBody: { error: "Application not found." } };
    context.error("moderateAgentApplication error:", err);
    return { status: 500, jsonBody: { error: "Could not update that application." } };
  }
}

app.http("moderateAgentApplication", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent-applications/{id}",
  handler: moderateAgentApplication,
});
