import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { escapeHtml, notifyEmail, sendEmail } from "../lib/email";

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

  const agentLabel = (body.agentName ?? "").trim() || body.agentId.trim();
  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
  const subject = `New agent request: ${agentLabel}`;
  const text = [
    "A guest submitted an agent request on Cruising Cove.",
    "",
    `Agent: ${agentLabel} (${body.agentId.trim()})`,
    `Guest: ${body.guestName.trim()}`,
    `Email: ${body.email.trim()}`,
    `Phone: ${body.phone.trim()}`,
    `Party: ${body.partySize || "—"}`,
    `When: ${body.sailingWindow || "—"}`,
    `Ship / destination: ${body.shipInterest || "—"}`,
    `First-timer: ${body.firstTimer || "—"}`,
    `Notes: ${body.notes || "—"}`,
    "",
    `Lead id: ${leadId}`,
    `Profile: ${site}/agents/profile.html?id=${encodeURIComponent(body.agentId.trim())}`,
  ].join("\n");
  const html = `
    <p>A guest submitted an agent request on Cruising Cove.</p>
    <ul>
      <li><strong>Agent:</strong> ${escapeHtml(agentLabel)} (${escapeHtml(body.agentId.trim())})</li>
      <li><strong>Guest:</strong> ${escapeHtml(body.guestName.trim())}</li>
      <li><strong>Email:</strong> ${escapeHtml(body.email.trim())}</li>
      <li><strong>Phone:</strong> ${escapeHtml(body.phone.trim())}</li>
      <li><strong>Party:</strong> ${escapeHtml(body.partySize || "—")}</li>
      <li><strong>When:</strong> ${escapeHtml(body.sailingWindow || "—")}</li>
      <li><strong>Ship / destination:</strong> ${escapeHtml(body.shipInterest || "—")}</li>
      <li><strong>First-timer:</strong> ${escapeHtml(body.firstTimer || "—")}</li>
      <li><strong>Notes:</strong> ${escapeHtml(body.notes || "—")}</li>
    </ul>
    <p>Lead id: ${escapeHtml(leadId)}<br>
    <a href="${escapeHtml(site)}/agents/profile.html?id=${encodeURIComponent(body.agentId.trim())}">View agent profile</a></p>
  `;
  try {
    const sent = await sendEmail(notifyEmail(), subject, html, text);
    if (!sent) context.warn("Agent lead saved but notify email was not sent (check RESEND_API_KEY / RESEND_FROM_EMAIL).");
  } catch (err) {
    context.error("Agent lead notify email failed:", err);
  }

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
