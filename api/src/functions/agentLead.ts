import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient, odata } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { escapeHtml, notifyEmail, sendEmail } from "../lib/email";
import { requireUser } from "../lib/community";
import { adminAuthOk } from "../lib/adminAuth";

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
        return cors(200, { locks: list });
      } catch (err) {
        context.error("list agent locks failed:", err);
        return cors(500, { error: "Could not list locked requests." });
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
    return cors(500, { error: "Something went wrong submitting your request. Please try again." });
  }

  const agentLabel = agentName || agentId;
  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
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
    `Unlock in admin: ${site}/agents/admin.html`,
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
    <a href="${escapeHtml(site)}/agents/admin.html">Open agent admin to unlock</a> ·
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
