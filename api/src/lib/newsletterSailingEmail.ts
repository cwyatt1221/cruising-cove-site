import { PUBLISHED_TABLE as AGENTS_TABLE, table as agentsTable, toPublicAgent } from "./agents";
import { escapeHtml } from "./email";
import { recentNewsletterArticles } from "./newsletterArticles";
import {
  MILESTONES,
  TipMilestoneId,
  daysUntilEmbark,
  getMilestoneTipContent,
  shipShortName,
  tipSubject,
} from "./newsletterTips";
import { climateForPort, formatClimate, monthFromYmd } from "./portClimate";
import { lookupSailing } from "./sailingCatalog";
import { PUBLISHED_TABLE as SELLERS_TABLE, table as sellersTable, toPublicSeller } from "./sellers";

export type ContactCard = {
  kind: "agent" | "seller";
  name: string;
  blurb: string;
  href: string;
};

export type SailingEmailContent = { subject: string; html: string; text: string };

function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

function todayYmdUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type ShipTip = { text: string; path?: string; linkLabel?: string };

const SHIP_TIPS: Record<string, ShipTip[]> = {
  "disney-dream": [
    {
      text: "Dream-class ships run rotational dining, the AquaDuck, and Remy for adults — skim the ship guide so you know what’s onboard before you board.",
      path: "/ships/disney-dream.html",
      linkLabel: "Disney Dream ship guide",
    },
    {
      text: "Use our dining overview, kids clubs guide, and packing list so sea days and Bahamian ports feel planned instead of rushed.",
      path: "/dining/",
      linkLabel: "Dining guide",
    },
    {
      text: "For a short Bahamian sailing, pack light layers for evenings, reef-safe sunscreen, and a soft costume option if it’s Halloween on the High Seas.",
      path: "/planning/disney-cruise-packing-list.html",
      linkLabel: "Packing list",
    },
  ],
  "disney-fantasy": [
    {
      text: "Fantasy mirrors much of Dream’s layout with its own entertainment lineup — use the ship guide for dining rooms and AquaDuck timing.",
      path: "/ships/disney-fantasy.html",
      linkLabel: "Disney Fantasy ship guide",
    },
  ],
  "disney-wish": [
    {
      text: "Wish-class ships bring AquaMouse, Marvel dining, and new kids clubs — the ship guide is the fastest orientation.",
      path: "/ships/disney-wish.html",
      linkLabel: "Disney Wish ship guide",
    },
  ],
  "disney-treasure": [
    {
      text: "Treasure is Wish-class with its own theming — check dining and kids clubs on the ship guide before you lock reservations.",
      path: "/ships/disney-treasure.html",
      linkLabel: "Disney Treasure ship guide",
    },
  ],
  "disney-destiny": [
    {
      text: "Destiny is Wish-class with Heroes & Villains theming — the ship guide covers Grand Hall moments most guests walk past.",
      path: "/ships/disney-destiny.html",
      linkLabel: "Disney Destiny ship guide",
    },
  ],
  "disney-believe": [
    {
      text: "Believe is the fourth Wish-class ship (expected late 2027) — start with what’s confirmed, then watch for venue and homeport announcements.",
      path: "/ships/disney-believe.html",
      linkLabel: "Disney Believe ship guide",
    },
  ],
  "disney-adventure": [
    {
      text: "Adventure sails from Singapore with a different dining map than Wish-class — the ship guide is the fastest orientation.",
      path: "/ships/disney-adventure.html",
      linkLabel: "Disney Adventure ship guide",
    },
  ],
};

function defaultShipTips(shipLabel: string): ShipTip[] {
  const short = shipShortName(shipLabel) || "your ship";
  return [
    {
      text: `Start with our ${short} ship guide for dining, kids clubs, and what to expect on a sea day.`,
      path: "/ships/",
      linkLabel: "Ship guides",
    },
    {
      text: "Use My Cruise on Cruising Cove for packing, sign-ups, and a checklist timed to your embarkation date.",
      path: "/planning/my-cruise.html",
      linkLabel: "My Cruise planner",
    },
    {
      text: "Skim kids clubs and the packing list early so embarkation week is calmer.",
      path: "/planning/kids-clubs.html",
      linkLabel: "Kids clubs guide",
    },
  ];
}

/** Load all published agents + marketplace sellers for Meet the Cove cards. */
export async function loadContactCards(opts: { maxAgents?: number; maxSellers?: number } = {}): Promise<ContactCard[]> {
  const maxAgents = opts.maxAgents ?? 25;
  const maxSellers = opts.maxSellers ?? 10;
  const site = siteBase();
  const agentCards: ContactCard[] = [];
  const sellerCards: ContactCard[] = [];
  try {
    const agents = agentsTable(AGENTS_TABLE);
    await agents.createTable();
    const rows: ReturnType<typeof toPublicAgent>[] = [];
    for await (const entity of agents.listEntities()) {
      const a = toPublicAgent(entity as Record<string, unknown>);
      if (!a.name) continue;
      rows.push(a);
    }
    rows.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const a of rows.slice(0, maxAgents)) {
      agentCards.push({
        kind: "agent",
        name: a.name,
        blurb: (a.pitch || a.agency || "Disney Cruise specialist").slice(0, 140),
        href: `${site}/agents/profile.html?id=${encodeURIComponent(a.id)}`,
      });
    }
  } catch {
    /* local / missing storage */
  }
  try {
    const sellers = sellersTable(SELLERS_TABLE);
    await sellers.createTable();
    const rows: ReturnType<typeof toPublicSeller>[] = [];
    for await (const entity of sellers.listEntities()) {
      const row = entity as Record<string, unknown>;
      if (row.status && row.status !== "published") continue;
      const s = toPublicSeller(row);
      if (!s.name) continue;
      rows.push(s);
    }
    rows.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const s of rows.slice(0, maxSellers)) {
      sellerCards.push({
        kind: "seller",
        name: s.name,
        blurb: (s.description || (s.categories || []).slice(0, 2).join(", ") || "Marketplace shop").slice(
          0,
          140
        ),
        href: s.shopUrl || `${site}/marketplace/`,
      });
    }
  } catch {
    /* local / missing storage */
  }
  return [...agentCards, ...sellerCards];
}

export type BuildSailingEmailOpts = {
  kind: "welcome" | TipMilestoneId;
  name: string;
  shipSlug: string;
  shipLabel: string;
  embarkationDate: string;
  unsubUrl?: string;
  /** Override for tests / local sample without Azure */
  contactCards?: ContactCard[];
  todayYmd?: string;
};

function greetingLine(name: string, shipLabel: string, kind: BuildSailingEmailOpts["kind"]): string {
  const who = name.trim() || "there";
  const ship = shipLabel.trim();
  if (kind === "welcome") {
    return ship
      ? `Hi ${who} — welcome to Cruising Cove. You’re on the list for your ${ship} sailing.`
      : `Hi ${who} — welcome to Cruising Cove.`;
  }
  return ship
    ? `Hi ${who} — your ${ship} sailing is coming up.`
    : `Hi ${who} — your Disney cruise is coming up.`;
}

export async function buildSailingEmail(opts: BuildSailingEmailOpts): Promise<SailingEmailContent> {
  const site = siteBase();
  const today = opts.todayYmd || todayYmdUtc();
  const unsub =
    (opts.unsubUrl || "").trim() || `${site}/newsletter/unsubscribe.html`;
  const cards = opts.contactCards ?? (await loadContactCards());
  const sailing = lookupSailing(opts.shipSlug, opts.embarkationDate);
  const daysUntil = daysUntilEmbark(opts.embarkationDate, today);
  const month = monthFromYmd(opts.embarkationDate) ?? monthFromYmd(today) ?? 10;
  const articles = recentNewsletterArticles(today);
  const shipTips = SHIP_TIPS[opts.shipSlug] || defaultShipTips(opts.shipLabel);

  const shipPath = opts.shipSlug ? `/ships/${opts.shipSlug}.html` : "/ships/";
  const shipGuideLabel = opts.shipLabel
    ? `${opts.shipLabel} ship guide`
    : "Ship guides";

  const milestoneContent =
    opts.kind === "welcome"
      ? {
          paragraphs: [
            "Here’s a snapshot of your sailing, a few ship tips, and people who can help — agents and marketplace shops at the bottom.",
            "We’ll also send short sailing tips at key milestones (about 90, 60, 30, 14, and 7 days out, plus embarkation day) — not a weekly blast.",
          ],
          links: [
            { label: shipGuideLabel, path: shipPath },
            { label: "Dining guide", path: "/dining/" },
            { label: "Kids clubs guide", path: "/planning/kids-clubs.html" },
            { label: "Packing list", path: "/planning/disney-cruise-packing-list.html" },
            { label: "My Cruise planner", path: "/planning/my-cruise.html" },
            { label: "Community sailing boards", path: "/community/" },
          ],
        }
      : getMilestoneTipContent(opts.kind, {
          embarkationDate: opts.embarkationDate,
        });

  const milestone = opts.kind === "welcome" ? null : MILESTONES.find((m) => m.id === opts.kind);
  const finalSubject =
    opts.kind === "welcome"
      ? opts.shipLabel
        ? `Welcome aboard — your ${shipShortName(opts.shipLabel) || opts.shipLabel} sailing tips`
        : "Welcome to Cruising Cove"
      : tipSubject(opts.shipLabel, milestone!);

  const greet = greetingLine(opts.name, opts.shipLabel, opts.kind);

  const textParts: string[] = [greet, ""];
  if (daysUntil !== null && daysUntil >= 0 && opts.embarkationDate) {
    textParts.push(
      `Embarkation: ${opts.embarkationDate}${daysUntil === 0 ? " (today!)" : ` · ${daysUntil} day${daysUntil === 1 ? "" : "s"} to go`}.`
    );
    textParts.push("");
  }

  textParts.push("This week in DCL planning");
  for (const a of articles) {
    textParts.push(`- ${a.title}: ${site}${a.path}`);
  }
  textParts.push("");

  textParts.push(`Tips for ${opts.shipLabel || "your ship"}`);
  for (const t of shipTips) {
    textParts.push(
      t.path ? `- ${t.text} (${site}${t.path}${t.linkLabel ? ` — ${t.linkLabel}` : ""})` : `- ${t.text}`
    );
  }
  textParts.push("");

  if (sailing) {
    textParts.push("Your sailing snapshot");
    textParts.push(
      `${sailing.nights}-night sailing from ${sailing.departurePort}${sailing.theme ? ` · ${sailing.theme}` : ""}`
    );
    if (/halloween/i.test(sailing.theme || "")) {
      textParts.push(
        "Halloween on the High Seas tip: pack a soft costume for Mouse-querade night and expect festive décor / character moments throughout the sailing."
      );
    }
    for (const p of sailing.ports) {
      const climate = climateForPort(p.portId, month);
      textParts.push(
        `- ${p.dayLabel}: ${p.name}${climate ? ` (${formatClimate(climate)} that time of year)` : ""}`
      );
      const ideas = sailing.excursionsByPort[p.portId] || [];
      for (const ex of ideas.slice(0, 3)) {
        textParts.push(`  · ${ex.name}${ex.price ? ` (${ex.price})` : ""} — ${ex.summary}`);
      }
    }
    textParts.push(
      "Confirm your exact itinerary in My Reservations / the Disney Cruise Line Navigator app — this snapshot is a planning aid."
    );
    textParts.push("");
  } else if (opts.shipSlug && opts.embarkationDate) {
    textParts.push("Your sailing snapshot");
    textParts.push(
      "We’re still confirming the exact port list for this embarkation date. Ship tips below still apply — check My Reservations for your official itinerary."
    );
    textParts.push("");
  }

  textParts.push(opts.kind === "welcome" ? "Getting started" : "Your tip for this stage");
  for (const p of milestoneContent.paragraphs) textParts.push(p);
  textParts.push("");
  textParts.push("Helpful links:");
  for (const l of milestoneContent.links) textParts.push(`- ${l.label}: ${site}${l.path}`);
  textParts.push("");

  if (opts.shipSlug && opts.embarkationDate) {
    const key = `${opts.shipSlug}_${opts.embarkationDate}`;
    textParts.push(`Sailing community board: ${site}/community/sailing.html?key=${encodeURIComponent(key)}`);
    textParts.push("");
  }

  textParts.push("Meet the Cove — agents & marketplace");
  if (cards.length) {
    for (const c of cards) {
      textParts.push(`- ${c.kind === "agent" ? "Agent" : "Shop"}: ${c.name} — ${c.blurb} · ${c.href}`);
    }
  } else {
    textParts.push(`- Find an agent: ${site}/agents/`);
    textParts.push(`- Marketplace: ${site}/marketplace/`);
  }
  textParts.push("");
  textParts.push("— Cruising Cove");
  textParts.push(site);
  textParts.push(`Unsubscribe: ${unsub}`);
  textParts.push(
    "Cruising Cove is an independent planning site and is not affiliated with The Walt Disney Company or Disney Cruise Line."
  );

  const newsHtml = articles
    .map(
      (a) =>
        `<li style="margin:0 0 10px"><a href="${site}${escapeHtml(a.path)}" style="color:#1a2a4a;font-weight:600">${escapeHtml(a.title)}</a><br><span style="color:#555;font-size:14px">${escapeHtml(a.excerpt)}</span></li>`
    )
    .join("");

  const shipTipsHtml = shipTips
    .map((t) => {
      const link =
        t.path && t.linkLabel
          ? ` <a href="${site}${escapeHtml(t.path)}" style="color:#1a2a4a">${escapeHtml(t.linkLabel)}</a>`
          : "";
      return `<li style="margin:0 0 8px">${escapeHtml(t.text)}${link}</li>`;
    })
    .join("");

  let sailingHtml = "";
  if (sailing) {
    const halloweenHtml = /halloween/i.test(sailing.theme || "")
      ? `<p style="margin:0 0 14px;padding:12px 14px;background:#fff8e8;border-left:3px solid #c9a24b">Halloween on the High Seas: pack a soft costume for <strong>Mouse-querade</strong> night and expect festive décor and character moments throughout the sailing.</p>`
      : "";
    const portBlocks = sailing.ports
      .map((p) => {
        const climate = climateForPort(p.portId, month);
        const ideas = (sailing.excursionsByPort[p.portId] || [])
          .slice(0, 3)
          .map(
            (ex) =>
              `<li style="margin:0 0 6px"><strong>${escapeHtml(ex.name)}</strong>${ex.price ? ` · ${escapeHtml(ex.price)}` : ""} — ${escapeHtml(ex.summary)}</li>`
          )
          .join("");
        return `<div style="margin:0 0 16px">
          <p style="margin:0 0 6px"><strong>${escapeHtml(p.dayLabel)} — ${escapeHtml(p.name)}</strong>${
            climate ? `<br><span style="color:#555;font-size:14px">Typical for this month: ${escapeHtml(formatClimate(climate))} <em>(climate average, not a forecast)</em></span>` : ""
          }</p>
          <ul style="margin:0;padding-left:18px">${ideas}</ul>
        </div>`;
      })
      .join("");
    sailingHtml = `
      <h2 style="font-size:18px;color:#1a2a4a;margin:28px 0 10px">Your sailing snapshot</h2>
      <p style="margin:0 0 12px">${escapeHtml(String(sailing.nights))}-night sailing from ${escapeHtml(sailing.departurePort)}${
        sailing.theme ? ` · <em>${escapeHtml(sailing.theme)}</em>` : ""
      }</p>
      ${halloweenHtml}
      ${portBlocks}
      <p style="font-size:13px;color:#666;margin:8px 0 0">Confirm your exact itinerary in My Reservations / the Disney Cruise Line Navigator app — this snapshot is a planning aid.</p>
    `;
  } else if (opts.shipSlug && opts.embarkationDate) {
    sailingHtml = `
      <h2 style="font-size:18px;color:#1a2a4a;margin:28px 0 10px">Your sailing snapshot</h2>
      <p>We’re still confirming the exact port list for this embarkation date. Check My Reservations for your official itinerary — ship tips below still apply.</p>
    `;
  }

  const tipParas = milestoneContent.paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("");
  const tipLinks = milestoneContent.links
    .map((l) => `<li><a href="${site}${escapeHtml(l.path)}" style="color:#1a2a4a">${escapeHtml(l.label)}</a></li>`)
    .join("");

  const communityHtml =
    opts.shipSlug && opts.embarkationDate
      ? `<p style="margin:20px 0"><a href="${site}/community/sailing.html?key=${encodeURIComponent(
          `${opts.shipSlug}_${opts.embarkationDate}`
        )}" style="color:#1a2a4a;font-weight:600">Open your sailing community board</a> — chat with others on the same cruise.</p>`
      : "";

  const cardsHtml = cards.length
    ? cards
        .map(
          (c) => `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #e8e2d4;vertical-align:top">
            <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#c9a24b;margin-bottom:4px">${
              c.kind === "agent" ? "Travel agent" : "Marketplace"
            }</div>
            <a href="${escapeHtml(c.href)}" style="color:#1a2a4a;font-weight:700;font-size:16px;text-decoration:none">${escapeHtml(c.name)}</a>
            <div style="color:#555;font-size:14px;margin-top:4px">${escapeHtml(c.blurb)}</div>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td style="padding:8px 0"><a href="${site}/agents/">Find an agent</a> · <a href="${site}/marketplace/">Browse the marketplace</a></td></tr>`;

  const daysLine =
    daysUntil !== null && daysUntil >= 0 && opts.embarkationDate
      ? `<p style="margin:0 0 18px;color:#555">Embarkation <strong>${escapeHtml(opts.embarkationDate)}</strong>${
          daysUntil === 0 ? " — today!" : ` · ${daysUntil} day${daysUntil === 1 ? "" : "s"} to go`
        }</p>`
      : "";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f0e1;font-family:Georgia,'Times New Roman',serif;color:#1a2a4a">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px 40px;background:#faf7ee">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c9a24b">Cruising Cove</p>
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3">${escapeHtml(greet)}</p>
    ${daysLine}
    <h2 style="font-size:18px;color:#1a2a4a;margin:24px 0 10px">This week in DCL planning</h2>
    <ul style="margin:0;padding-left:18px">${newsHtml}</ul>
    <h2 style="font-size:18px;color:#1a2a4a;margin:28px 0 10px">Tips for ${escapeHtml(opts.shipLabel || "your ship")}</h2>
    <ul style="margin:0;padding-left:18px">${shipTipsHtml}</ul>
    ${sailingHtml}
    <h2 style="font-size:18px;color:#1a2a4a;margin:28px 0 10px">${
      opts.kind === "welcome" ? "Getting started" : "Your tip for this stage"
    }</h2>
    ${tipParas}
    <p style="margin:16px 0 6px"><strong>Helpful links</strong></p>
    <ul style="margin:0;padding-left:18px">${tipLinks}</ul>
    ${communityHtml}
    <h2 style="font-size:18px;color:#1a2a4a;margin:28px 0 10px">Meet the Cove</h2>
    <p style="margin:0 0 12px;color:#555;font-size:14px">Travel agents and marketplace shops from Cruising Cove — no extra cost to book with an agent vs Disney direct.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cardsHtml}</table>
    <p style="font-size:12px;color:#666;margin:28px 0 0;line-height:1.5">— Cruising Cove · <a href="${site}" style="color:#1a2a4a">${escapeHtml(site)}</a><br>
    <a href="${escapeHtml(unsub)}" style="color:#1a2a4a">Unsubscribe</a><br>
    Cruising Cove is an independent planning site and is not affiliated with The Walt Disney Company or Disney Cruise Line.</p>
  </div>
</body></html>`;

  return {
    subject: finalSubject,
    html,
    text: textParts.join("\n"),
  };
}
