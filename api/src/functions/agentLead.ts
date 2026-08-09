import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient, odata } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { escapeHtml, notifyEmail, notifyOwnerOfSubmitError, safeField, sendEmail, sendEmailResult } from "../lib/email";
import { requireUser } from "../lib/community";
import { adminAuthOk } from "../lib/adminAuth";
import { PUBLISHED_TABLE, table as agentsTable } from "../lib/agents";

const LEADS_TABLE = "AgentLeads";
const LOCKS_TABLE = "AgentRequestLocks";

interface AgentLeadInput {
  action?: string;
  userId?: string;
  leadId?: string;
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

type LeadEntity = Record<string, unknown>;

function table(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

async function leadsClient(): Promise<TableClient> {
  const client = table(LEADS_TABLE);
  await client.createTable();
  return client;
}

async function locksClient(): Promise<TableClient> {
  const client = table(LOCKS_TABLE);
  await client.createTable();
  return client;
}

async function getActiveLock(userId: string) {
  try {
    const locks = await locksClient();
    const entity = await locks.getEntity("user", userId);
    if (String(entity.status || "") !== "locked") return null;
    return {
      locked: true as const,
      userId,
      agentId: String(entity.agentId || ""),
      agentName: String(entity.agentName || ""),
      leadId: String(entity.leadId || ""),
      guestName: String(entity.guestName || ""),
      email: String(entity.email || ""),
      submittedAt: String(entity.submittedAt || ""),
    };
  } catch {
    return null;
  }
}

function serializeLead(entity: LeadEntity) {
  return {
    leadId: String(entity.rowKey || ""),
    agentId: String(entity.agentId || entity.partitionKey || ""),
    agentName: String(entity.agentName || ""),
    status: String(entity.status || ""),
    guestName: String(entity.guestName || ""),
    email: String(entity.email || ""),
    phone: String(entity.phone || ""),
    partySize: String(entity.partySize || ""),
    sailingWindow: String(entity.sailingWindow || ""),
    shipInterest: String(entity.shipInterest || ""),
    notes: String(entity.notes || ""),
    firstTimer: String(entity.firstTimer || ""),
    userId: String(entity.userId || ""),
    userEmail: String(entity.userEmail || ""),
    userDisplayName: String(entity.userDisplayName || ""),
    submittedAt: String(entity.submittedAt || ""),
    unlockedAt: String(entity.unlockedAt || ""),
    agentEmailedAt: String(entity.agentEmailedAt || ""),
    agentEmailedTo: String(entity.agentEmailedTo || ""),
    agentEmailCount: Number(entity.agentEmailCount || 0) || 0,
    lastAgentEmailStatus: String(entity.lastAgentEmailStatus || ""),
  };
}

async function listLocks() {
  const locks = await locksClient();
  const list = [];
  for await (const entity of locks.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${"user"} and status eq ${"locked"}` },
  })) {
    list.push({
      userId: String(entity.rowKey),
      agentId: String(entity.agentId || ""),
      agentName: String(entity.agentName || ""),
      leadId: String(entity.leadId || ""),
      guestName: String(entity.guestName || ""),
      email: String(entity.email || ""),
      submittedAt: String(entity.submittedAt || ""),
      status: "locked",
    });
  }
  list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return list;
}

async function listLeads() {
  const leads = await leadsClient();
  const list = [];
  for await (const entity of leads.listEntities()) {
    list.push(serializeLead(entity as LeadEntity));
  }
  list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return list;
}

async function agentNotifyEmail(agentId: string): Promise<{ email: string; name: string }> {
  try {
    const client = agentsTable(PUBLISHED_TABLE);
    await client.createTable();
    const entity = await client.getEntity("directory", agentId);
    return {
      email: String(entity.emailNotify || entity.email || "").trim(),
      name: String(entity.name || entity.fullName || "").trim(),
    };
  } catch {
    return { email: "", name: "" };
  }
}

function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

function leadEmailBodies(lead: ReturnType<typeof serializeLead>) {
  const agentLabel = lead.agentName || lead.agentId;
  const site = siteBase();
  const subject = `New Disney cruise guest request via Cruising Cove — ${lead.guestName || "Guest"}`;
  const text = [
    "A guest requested you through Cruising Cove.",
    "",
    `Guest: ${lead.guestName || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Phone: ${lead.phone || "—"}`,
    `Account name: ${lead.userDisplayName || "—"}`,
    `Account email: ${lead.userEmail || "—"}`,
    "",
    `Party: ${lead.partySize || "—"}`,
    `When they hope to sail: ${lead.sailingWindow || "—"}`,
    `Ship / destination: ${lead.shipInterest || "—"}`,
    `First Disney cruise: ${lead.firstTimer || "—"}`,
    `Notes: ${lead.notes || "—"}`,
    "",
    `Submitted: ${lead.submittedAt || "—"}`,
    `Your Cruising Cove profile: ${site}/agents/profile.html?id=${encodeURIComponent(lead.agentId)}`,
    "",
    "You can reply directly to the guest email above. Cruising Cove does not take a cut — Disney pays your commission as usual.",
  ].join("\n");
  const html = `
    <p>A guest requested <strong>${escapeHtml(agentLabel)}</strong> through Cruising Cove.</p>
    <h3 style="font-family:Georgia,serif;color:#1a2a4a;">Guest details</h3>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(lead.guestName || "—")}</li>
      <li><strong>Email:</strong> <a href="mailto:${escapeHtml(lead.email || "")}">${escapeHtml(lead.email || "—")}</a></li>
      <li><strong>Phone:</strong> ${escapeHtml(lead.phone || "—")}</li>
      <li><strong>Cruising Cove account:</strong> ${escapeHtml(lead.userDisplayName || "—")} &lt;${escapeHtml(lead.userEmail || "—")}&gt;</li>
    </ul>
    <h3 style="font-family:Georgia,serif;color:#1a2a4a;">Sailing interests</h3>
    <ul>
      <li><strong>Party:</strong> ${escapeHtml(lead.partySize || "—")}</li>
      <li><strong>When:</strong> ${escapeHtml(lead.sailingWindow || "—")}</li>
      <li><strong>Ship / destination:</strong> ${escapeHtml(lead.shipInterest || "—")}</li>
      <li><strong>First Disney cruise:</strong> ${escapeHtml(lead.firstTimer || "—")}</li>
      <li><strong>Notes:</strong> ${escapeHtml(lead.notes || "—")}</li>
    </ul>
    <p style="color:#555;">Submitted ${escapeHtml(lead.submittedAt || "—")}<br>
    <a href="${escapeHtml(site)}/agents/profile.html?id=${encodeURIComponent(lead.agentId)}">Your Cruising Cove profile</a></p>
    <p>Reply directly to the guest. Cruising Cove does not take a cut — Disney pays your commission as usual.</p>
  `;
  return { subject, text, html };
}

function cors(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CC-Token, x-cc-admin-key",
    },
  };
}

export async function agentLeadHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return cors(204, {});

  if (request.method === "GET") {
    if (await adminAuthOk(request)) {
      try {
        const [locks, leads] = await Promise.all([listLocks(), listLeads()]);
        return cors(200, { locks, leads });
      } catch (err) {
        context.error("list agent locks/leads failed:", err);
        return cors(500, { error: "Could not list guest requests." });
      }
    }

    const user = await requireUser(request.headers);
    if (!user) return cors(401, { error: "Sign in required." });
    const lock = await getActiveLock(user.userId);
    return cors(200, lock || { locked: false });
  }

  let body: AgentLeadInput;
  try {
    body = (await request.json()) as AgentLeadInput;
  } catch {
    return cors(400, { error: "Request body must be valid JSON." });
  }

  if (String(body.action || "") === "unlock") {
    if (!(await adminAuthOk(request))) {
      return cors(401, { error: "Missing or invalid admin key." });
    }
    const userId = String(body.userId || "").trim();
    if (!userId) return cors(400, { error: "userId is required." });
    try {
      const locks = await locksClient();
      const now = new Date().toISOString();
      try {
        const existing = await locks.getEntity("user", userId);
        await locks.updateEntity(
          {
            partitionKey: "user",
            rowKey: userId,
            ...existing,
            status: "unlocked",
            unlockedAt: now,
          },
          "Replace"
        );
      } catch {
        return cors(404, { error: "No lock found for that user." });
      }

      const leadId = String(body.leadId || "").trim();
      const agentId = String(body.agentId || "").trim();
      if (leadId && agentId) {
        try {
          const leads = await leadsClient();
          const lead = await leads.getEntity(agentId, leadId);
          await leads.updateEntity(
            {
              ...lead,
              partitionKey: agentId,
              rowKey: leadId,
              status: "unlocked",
              unlockedAt: now,
            },
            "Replace"
          );
        } catch {
          /* lead row optional */
        }
      }

      return cors(200, { success: true, unlocked: true, userId });
    } catch (err) {
      context.error("unlock agent request failed:", err);
      return cors(500, { error: "Could not unlock request." });
    }
  }

  if (String(body.action || "") === "email-agent") {
    if (!(await adminAuthOk(request))) {
      return cors(401, { error: "Missing or invalid admin key." });
    }
    const leadId = String(body.leadId || "").trim();
    const agentId = String(body.agentId || "").trim();
    if (!leadId || !agentId) return cors(400, { error: "leadId and agentId are required." });

    try {
      const leads = await leadsClient();
      let leadEntity: LeadEntity;
      try {
        leadEntity = (await leads.getEntity(agentId, leadId)) as LeadEntity;
      } catch {
        return cors(404, { error: "Request form not found." });
      }

      const lead = serializeLead(leadEntity);
      const agent = await agentNotifyEmail(agentId);
      if (!agent.email || !agent.email.includes("@")) {
        return cors(400, {
          error:
            "This agent has no notification email on file. Add emailNotify on their published profile, then try again.",
        });
      }

      const { subject, text, html } = leadEmailBodies(lead);
      const result = await sendEmailResult(agent.email, subject, html, text);
      const now = new Date().toISOString();
      const count = (Number(leadEntity.agentEmailCount || 0) || 0) + (result.ok ? 1 : 0);

      await leads.updateEntity(
        {
          ...leadEntity,
          partitionKey: agentId,
          rowKey: leadId,
          agentEmailedAt: result.ok ? now : String(leadEntity.agentEmailedAt || ""),
          agentEmailedTo: result.ok ? agent.email : String(leadEntity.agentEmailedTo || ""),
          agentEmailCount: count,
          lastAgentEmailStatus: result.ok ? "sent" : `failed: ${result.reason}`,
          lastAgentEmailAttemptAt: now,
        },
        "Replace"
      );

      if (!result.ok) {
        context.warn("email-agent failed:", result.reason);
        return cors(502, { error: `Could not email agent: ${result.reason}` });
      }

      // Optional owner receipt so you know a lead was forwarded.
      try {
        await sendEmail(
          notifyEmail(),
          `Forwarded agent request to ${lead.agentName || agentId}`,
          `<p>You emailed the guest request for <strong>${escapeHtml(lead.guestName || "guest")}</strong> to <strong>${escapeHtml(agent.email)}</strong> (${escapeHtml(lead.agentName || agentId)}).</p>`,
          `Forwarded guest request for ${lead.guestName || "guest"} to ${agent.email} (${lead.agentName || agentId}).`
        );
      } catch (err) {
        context.warn("email-agent owner receipt failed:", err);
      }

      return cors(200, {
        success: true,
        emailedTo: agent.email,
        emailedAt: now,
        lead: serializeLead({
          ...leadEntity,
          agentEmailedAt: now,
          agentEmailedTo: agent.email,
          agentEmailCount: count,
          lastAgentEmailStatus: "sent",
        }),
      });
    } catch (err) {
      context.error("email-agent failed:", err);
      return cors(500, { error: "Could not email this form to the agent." });
    }
  }

  const user = await requireUser(request.headers);
  if (!user) {
    return cors(401, { error: "Sign in required to request an agent." });
  }

  if (!body.agentId?.trim() || !body.guestName?.trim() || !body.email?.trim() || !body.phone?.trim()) {
    return cors(400, { error: "Agent, name, email, and phone are required." });
  }
  if (body.consent !== true) {
    return cors(400, { error: "Consent to share your contact details with the selected agent is required." });
  }

  const existing = await getActiveLock(user.userId);
  if (existing) {
    return cors(409, {
      error:
        "You already requested an agent. Other request buttons stay locked until Cruising Cove unlocks your account.",
      lock: existing,
    });
  }

  const leadId = randomUUID();
  const now = new Date();
  const agentId = body.agentId.trim();
  const agentName = (body.agentName ?? "").trim();
  const guestName = body.guestName.trim();
  const email = body.email.trim();

  try {
    const leads = await leadsClient();
    await leads.createEntity({
      partitionKey: agentId,
      rowKey: leadId,
      status: "locked",
      agentId,
      agentName,
      guestName,
      email,
      phone: body.phone.trim(),
      partySize: body.partySize ?? "",
      sailingWindow: body.sailingWindow ?? "",
      shipInterest: body.shipInterest ?? "",
      notes: body.notes ?? "",
      firstTimer: body.firstTimer ?? "",
      userId: user.userId,
      userEmail: user.email,
      userDisplayName: user.displayName,
      unlockedAt: "",
      submittedAt: now.toISOString(),
      agentEmailedAt: "",
      agentEmailedTo: "",
      agentEmailCount: 0,
      lastAgentEmailStatus: "",
      lastAgentEmailAttemptAt: "",
    });

    const locks = await locksClient();
    await locks.upsertEntity(
      {
        partitionKey: "user",
        rowKey: user.userId,
        status: "locked",
        agentId,
        agentName,
        leadId,
        guestName,
        email,
        submittedAt: now.toISOString(),
        unlockedAt: "",
      },
      "Replace"
    );
  } catch (err) {
    context.error("Failed to store agent lead:", err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      const sent = await notifyOwnerOfSubmitError({
        form: "Travel agent request",
        error: message,
        source: "api/agent-lead",
        httpStatus: 500,
        context: {
          agentId: safeField(agentId),
          agentName: safeField(agentName),
          guestName: safeField(guestName),
          email: safeField(email),
          userId: safeField(user.userId),
        },
      });
      if (!sent) context.warn("Agent lead error notify email not sent (check RESEND_API_KEY).");
    } catch (notifyErr) {
      context.error("Agent lead error notify failed:", notifyErr);
    }
    return cors(500, { error: "Something went wrong submitting your request. Please try again." });
  }

  const agentLabel = agentName || agentId;
  const site = siteBase();
  const subject = `New agent request: ${agentLabel}`;
  const text = [
    "A signed-in guest submitted an agent request on Cruising Cove.",
    "",
    `Agent: ${agentLabel} (${agentId})`,
    `Guest: ${guestName}`,
    `Email: ${email}`,
    `Phone: ${body.phone.trim()}`,
    `Account: ${user.displayName} <${user.email}> (${user.userId})`,
    `Party: ${body.partySize || "—"}`,
    `When: ${body.sailingWindow || "—"}`,
    `Ship / destination: ${body.shipInterest || "—"}`,
    `First-timer: ${body.firstTimer || "—"}`,
    `Notes: ${body.notes || "—"}`,
    "",
    `Lead id: ${leadId}`,
    `Review & email agent: ${site}/agents/admin.html`,
    `Profile: ${site}/agents/profile.html?id=${encodeURIComponent(agentId)}`,
  ].join("\n");
  const html = `
    <p>A signed-in guest submitted an agent request on Cruising Cove.</p>
    <ul>
      <li><strong>Agent:</strong> ${escapeHtml(agentLabel)} (${escapeHtml(agentId)})</li>
      <li><strong>Guest:</strong> ${escapeHtml(guestName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(body.phone.trim())}</li>
      <li><strong>Account:</strong> ${escapeHtml(user.displayName)} &lt;${escapeHtml(user.email)}&gt;</li>
      <li><strong>Party:</strong> ${escapeHtml(body.partySize || "—")}</li>
      <li><strong>When:</strong> ${escapeHtml(body.sailingWindow || "—")}</li>
      <li><strong>Ship / destination:</strong> ${escapeHtml(body.shipInterest || "—")}</li>
      <li><strong>First-timer:</strong> ${escapeHtml(body.firstTimer || "—")}</li>
      <li><strong>Notes:</strong> ${escapeHtml(body.notes || "—")}</li>
    </ul>
    <p>Other agent request buttons stay locked for this account until you unlock them.</p>
    <p>Lead id: ${escapeHtml(leadId)}<br>
    <a href="${escapeHtml(site)}/agents/admin.html">Open agent admin to review &amp; email the agent</a> ·
    <a href="${escapeHtml(site)}/agents/profile.html?id=${encodeURIComponent(agentId)}">View agent profile</a></p>
  `;
  try {
    const sent = await sendEmail(notifyEmail(), subject, html, text);
    if (!sent) context.warn("Agent lead saved but notify email was not sent (check RESEND_API_KEY / RESEND_FROM_EMAIL).");
  } catch (err) {
    context.error("Agent lead notify email failed:", err);
  }

  return cors(200, {
    success: true,
    leadId,
    locked: true,
    agentId,
    message:
      "Your request was sent. Other agent request buttons are locked until Cruising Cove unlocks your account.",
  });
}

app.http("submitAgentLead", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "agent-lead",
  handler: agentLeadHandler,
});
