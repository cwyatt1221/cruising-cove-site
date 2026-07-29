import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const TABLE_NAME = "AgentLeads";

interface AgentLeadInput {
  agentId?: string;
  agentName?: string;
  guestName?: string;
  email?: string;
  phone?: string;
  partySize?: string;
  sailingWindow?: string;
  shipInterest?: string;
  notes?: string;
  firstTimer?: string;
  consent?: boolean;
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

export async function submitAgentLead(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: AgentLeadInput;
  try {
    body = (await request.json()) as AgentLeadInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  if (!body.agentId?.trim() || !body.guestName?.trim() || !body.email?.trim() || !body.phone?.trim()) {
    return { status: 400, jsonBody: { error: "Agent, name, email, and phone are required." } };
  }
  if (body.consent !== true) {
    return { status: 400, jsonBody: { error: "Consent to share your contact details with the selected agent is required." } };
  }

  const leadId = randomUUID();
  const now = new Date();

  try {
    const client = await getTableClient();
    await client.createEntity({
      partitionKey: body.agentId.trim(),
      rowKey: leadId,
      status: "locked",
      agentId: body.agentId.trim(),
      agentName: (body.agentName ?? "").trim(),
      guestName: body.guestName.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      partySize: body.partySize ?? "",
      sailingWindow: body.sailingWindow ?? "",
      shipInterest: body.shipInterest ?? "",
      notes: body.notes ?? "",
      firstTimer: body.firstTimer ?? "",
      unlockedAt: "",
      submittedAt: now.toISOString(),
    });
  } catch (err) {
    context.error("Failed to store agent lead:", err);
    return { status: 500, jsonBody: { error: "Something went wrong submitting your request. Please try again." } };
  }

  // Unlock checkout / agent email notify will plug in here next.
  return {
    status: 200,
    jsonBody: {
      success: true,
      leadId,
      message: "Your request was sent. The agent will unlock your contact details to reach out.",
    },
  };
}

app.http("submitAgentLead", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent-lead",
  handler: submitAgentLead,
});
