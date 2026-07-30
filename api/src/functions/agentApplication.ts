import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const TABLE_NAME = "AgentApplications";

interface AgentApplicationInput {
  fullName?: string;
  agency?: string;
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  photoUrl?: string;
  pitch?: string;
  bio?: string;
  specialties?: string[];
  specialtiesOther?: string;
  yearsExperience?: string;
  sailingsPlanned?: string;
  earmarked?: string; // "yes" | "no" | "in-progress"
  credentialsNotes?: string;
  whyChooseMe?: string;
  highlights?: string; // newline-separated bullets
  chargesFees?: string; // "no" | "yes" | "sometimes"
  feeNotes?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  otherNotes?: string;
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

function csv(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}

export async function submitAgentApplication(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: AgentApplicationInput;
  try {
    body = (await request.json()) as AgentApplicationInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  if (!body.fullName?.trim() || !body.agency?.trim() || !body.location?.trim()) {
    return { status: 400, jsonBody: { error: "Name, agency, and location are required." } };
  }
  if (!body.email?.trim() || !body.phone?.trim()) {
    return { status: 400, jsonBody: { error: "Email and phone are required." } };
  }
  if (!body.pitch?.trim() || !body.bio?.trim()) {
    return { status: 400, jsonBody: { error: "Pitch and bio are required for your directory card." } };
  }
  if (!body.photoUrl?.trim()) {
    return { status: 400, jsonBody: { error: "A profile photo is required." } };
  }
  if (!body.specialties || body.specialties.length === 0) {
    return { status: 400, jsonBody: { error: "Select at least one specialty." } };
  }
  if (!body.whyChooseMe?.trim()) {
    return { status: 400, jsonBody: { error: "Tell families why they should choose you." } };
  }
  if (!body.chargesFees) {
    return { status: 400, jsonBody: { error: "Please tell us whether you charge planning fees." } };
  }
  if (!body.earmarked) {
    return { status: 400, jsonBody: { error: "Please tell us about your EarMarked / Disney specialist status." } };
  }

  try {
    const client = await getTableClient();
    const now = new Date();
    await client.createEntity({
      partitionKey: now.toISOString().slice(0, 10),
      rowKey: randomUUID(),
      status: "pending",
      fullName: body.fullName.trim(),
      agency: body.agency.trim(),
      location: body.location.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      website: (body.website ?? "").trim(),
      photoUrl: body.photoUrl.trim(),
      pitch: body.pitch.trim().slice(0, 280),
      bio: body.bio.trim().slice(0, 1200),
      specialties: csv(body.specialties),
      specialtiesOther: (body.specialtiesOther ?? "").trim().slice(0, 200),
      yearsExperience: (body.yearsExperience ?? "").trim().slice(0, 20),
      sailingsPlanned: (body.sailingsPlanned ?? "").trim().slice(0, 40),
      earmarked: body.earmarked,
      credentialsNotes: (body.credentialsNotes ?? "").trim().slice(0, 800),
      whyChooseMe: body.whyChooseMe.trim().slice(0, 800),
      highlights: (body.highlights ?? "").trim().slice(0, 800),
      chargesFees: body.chargesFees,
      feeNotes: (body.feeNotes ?? "").trim().slice(0, 400),
      instagramUrl: (body.instagramUrl ?? "").trim(),
      facebookUrl: (body.facebookUrl ?? "").trim(),
      tiktokUrl: (body.tiktokUrl ?? "").trim(),
      otherNotes: (body.otherNotes ?? "").trim().slice(0, 800),
      submittedAt: now.toISOString(),
    });
  } catch (err) {
    context.error("Failed to store agent application:", err);
    return { status: 500, jsonBody: { error: "Something went wrong submitting your application. Please try again." } };
  }

  return { status: 200, jsonBody: { success: true } };
}

app.http("submitAgentApplication", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent-application",
  handler: submitAgentApplication,
});
