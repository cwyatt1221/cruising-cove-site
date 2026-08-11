/**
 * Send welcome + all sailing-tip emails to an inbox with Resend tag label=Disney.
 * Usage from api/:
 *   set -a && source .sample-env && set +a
 *   TO=cgrove0712@gmail.com node scripts/send-disney-sample-pack.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildSailingEmail } = require("../dist/src/lib/newsletterSailingEmail.js");

const TO = (process.env.TO || process.env.AGENT_LEAD_NOTIFY_EMAIL || "cgrove0712@gmail.com").trim();
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL || "cassondra@cruisingcove.com";
const LABEL = "Disney";

if (!KEY) {
  console.error("RESEND_API_KEY missing");
  process.exit(1);
}

const embarkationDate = "2026-10-16";
const shipSlug = "disney-dream";
const shipLabel = "Disney Dream";
const name = "Bridget Lebers";
const unsubUrl = "https://www.cruisingcove.com/newsletter/unsubscribe.html";

/** todayYmd chosen so days-until falls inside each tip window */
const PACK = [
  { kind: "welcome", todayYmd: "2026-08-09" },
  { kind: "d90", todayYmd: "2026-08-02" }, // ~75 days
  { kind: "d60", todayYmd: "2026-09-01" }, // ~45 days
  { kind: "d30", todayYmd: "2026-09-26" }, // ~20 days
  { kind: "d14", todayYmd: "2026-10-05" }, // ~11 days
  { kind: "d7", todayYmd: "2026-10-12" }, // ~4 days
  { kind: "d0", todayYmd: "2026-10-16" }, // embarkation day
];

async function sendTagged({ to, subject, html, text, kind }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM.includes("<") ? FROM : `Cruising Cove <${FROM}>`,
      to: [to],
      subject,
      html,
      text,
      tags: [
        { name: "label", value: LABEL },
        { name: "kind", value: String(kind).replace(/[^a-zA-Z0-9_-]/g, "") },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: body.slice(0, 300) };
  }
  let id = "";
  try {
    id = JSON.parse(body)?.id || "";
  } catch {
    /* ignore */
  }
  return { ok: true, status: res.status, id };
}

// Live agent/seller cards for the pack
async function cardsFromLiveSite() {
  const site = "https://www.cruisingcove.com";
  const cards = [];
  try {
    const agentsRes = await fetch(`${site}/api/agents`);
    if (agentsRes.ok) {
      const data = await agentsRes.json();
      const agents = Array.isArray(data.agents) ? data.agents : Array.isArray(data) ? data : [];
      agents.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      for (const a of agents) {
        if (!a.name) continue;
        cards.push({
          kind: "agent",
          name: a.name,
          blurb: String(a.pitch || a.agency || "Disney Cruise specialist").slice(0, 140),
          href: `${site}/agents/profile.html?id=${encodeURIComponent(a.id)}`,
        });
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const sellersRes = await fetch(`${site}/api/sellers`);
    if (sellersRes.ok) {
      const data = await sellersRes.json();
      const sellers = Array.isArray(data.sellers) ? data.sellers : Array.isArray(data) ? data : [];
      for (const s of sellers) {
        if (!s.name) continue;
        cards.push({
          kind: "seller",
          name: s.name,
          blurb: String(s.description || "Marketplace shop").slice(0, 140),
          href: s.shopUrl || `${site}/marketplace/`,
        });
      }
    }
  } catch {
    /* ignore */
  }
  return cards;
}

const contactCards = await cardsFromLiveSite();
console.log(`Sending ${PACK.length} emails to ${TO} with label=${LABEL}`);
console.log(`Contact cards: ${contactCards.length}`);

for (const item of PACK) {
  const email = await buildSailingEmail({
    kind: item.kind,
    name,
    shipSlug,
    shipLabel,
    embarkationDate,
    todayYmd: item.todayYmd,
    unsubUrl,
    contactCards,
  });
  // Visible inbox label prefix + Resend tag
  const subject = `[${LABEL}] ${email.subject}`;
  const result = await sendTagged({
    to: TO,
    subject,
    html: email.html,
    text: email.text,
    kind: item.kind,
  });
  console.log(item.kind, subject, result);
  // gentle pacing for Resend
  await new Promise((r) => setTimeout(r, 400));
}

console.log("Done.");
