/** Marketplace shop click-out events + Monday weekly owner reports. */

import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { escapeHtml, notifyEmail, sendEmailResult, type SendEmailResult } from "./email";
import { PUBLISHED_TABLE, table as sellersTable } from "./sellers";

export const CLICKS_TABLE = "SellerShopClicks";

export type UtcWeekWindow = {
  /** Inclusive Monday YYYY-MM-DD (UTC). */
  weekStartYmd: string;
  /** Exclusive next Monday YYYY-MM-DD (UTC). */
  weekEndExclusiveYmd: string;
  /** Inclusive Sunday YYYY-MM-DD (UTC). */
  weekEndYmd: string;
  label: string;
};

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Most recently completed Mon–Sun week in UTC (relative to `now`). */
export function previousUtcWeek(now = new Date()): UtcWeekWindow {
  const day = now.getUTCDay(); // 0=Sun … 1=Mon
  const daysSinceMonday = (day + 6) % 7;
  const thisMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday)
  );
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86_400_000);
  const prevSunday = new Date(thisMonday.getTime() - 86_400_000);
  const weekStartYmd = ymdUtc(prevMonday);
  const weekEndExclusiveYmd = ymdUtc(thisMonday);
  const weekEndYmd = ymdUtc(prevSunday);
  const startLabel = prevMonday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = prevSunday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    weekStartYmd,
    weekEndExclusiveYmd,
    weekEndYmd,
    label: `${startLabel}–${endLabel} (UTC)`,
  };
}

export function clicksTable(): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, CLICKS_TABLE);
}

/** Record one Visit shop click-out. RowKey is time-sortable for week range queries. */
export async function recordShopClick(opts: {
  shopId: string;
  path?: string;
  at?: string;
}): Promise<{ recordedAt: string; day: string }> {
  const shopId = String(opts.shopId || "").trim();
  if (!shopId) throw new Error("shopId is required");
  const recordedAt =
    opts.at && !Number.isNaN(Date.parse(opts.at)) ? opts.at : new Date().toISOString();
  const day = recordedAt.slice(0, 10);
  const path = String(opts.path || "").trim().slice(0, 300);
  const client = clicksTable();
  await client.createTable();
  await client.createEntity({
    partitionKey: shopId,
    rowKey: `${recordedAt}_${randomUUID()}`,
    shopId,
    recordedAt,
    day,
    path,
  });
  return { recordedAt, day };
}

export async function countShopClicksInWeek(
  shopId: string,
  week: UtcWeekWindow
): Promise<number> {
  const client = clicksTable();
  await client.createTable();
  const filter =
    `PartitionKey eq '${shopId.replace(/'/g, "''")}' ` +
    `and RowKey ge '${week.weekStartYmd}' ` +
    `and RowKey lt '${week.weekEndExclusiveYmd}'`;
  let n = 0;
  for await (const _ of client.listEntities({ queryOptions: { filter } })) {
    n += 1;
  }
  return n;
}

export function buildSellerWeeklyClickEmail(opts: {
  shopName: string;
  shopId: string;
  weekClicks: number;
  lifetimeClicks: number;
  week: UtcWeekWindow;
}): { subject: string; html: string; text: string } {
  const name = String(opts.shopName || opts.shopId || "your shop").trim() || "your shop";
  const weekClicks = Math.max(0, Math.floor(opts.weekClicks));
  const lifetime = Math.max(0, Math.floor(opts.lifetimeClicks));
  const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
  const subject =
    weekClicks === 1
      ? `Cruising Cove: 1 shop click last week (${name})`
      : `Cruising Cove: ${weekClicks} shop clicks last week (${name})`;
  const text = [
    `Hi — here’s your weekly Cruising Cove marketplace report for ${name}.`,
    "",
    `Week: ${opts.week.label}`,
    `Visit shop clicks: ${weekClicks}`,
    `Lifetime clicks on Cruising Cove: ${lifetime}`,
    "",
    `Marketplace: ${site}/marketplace/#${opts.shopId}`,
    "",
    "These are click-outs from Cruising Cove to your shop link (not Etsy analytics).",
    "You’re receiving this because your shop is listed on Cruising Cove.",
  ].join("\n");
  const html = `
    <p>Hi — here’s your weekly <strong>Cruising Cove</strong> marketplace report for <strong>${escapeHtml(name)}</strong>.</p>
    <ul>
      <li><strong>Week:</strong> ${escapeHtml(opts.week.label)}</li>
      <li><strong>Visit shop clicks:</strong> ${escapeHtml(String(weekClicks))}</li>
      <li><strong>Lifetime clicks on Cruising Cove:</strong> ${escapeHtml(String(lifetime))}</li>
    </ul>
    <p><a href="${escapeHtml(site)}/marketplace/#${escapeHtml(opts.shopId)}">View your listing</a></p>
    <p style="color:#666;font-size:13px">These are click-outs from Cruising Cove to your shop link (not Etsy analytics).</p>
  `;
  return { subject, html, text };
}

export function buildOwnerWeeklyDigest(opts: {
  week: UtcWeekWindow;
  rows: { shopName: string; shopId: string; weekClicks: number; emailed: boolean }[];
}): { subject: string; html: string; text: string } {
  const total = opts.rows.reduce((sum, r) => sum + r.weekClicks, 0);
  const subject = `Marketplace weekly clicks: ${total} across ${opts.rows.length} shop${opts.rows.length === 1 ? "" : "s"}`;
  const lines = opts.rows.map(
    (r) =>
      `- ${r.shopName} (${r.shopId}): ${r.weekClicks} click${r.weekClicks === 1 ? "" : "s"}${r.emailed ? "" : " · not emailed (no address)"}`
  );
  const text = [
    `Cruising Cove marketplace click report — ${opts.week.label}`,
    "",
    `Total Visit shop clicks: ${total}`,
    "",
    ...lines,
  ].join("\n");
  const htmlRows = opts.rows
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.shopName)}</strong> (${escapeHtml(r.shopId)}): ${escapeHtml(String(r.weekClicks))} click${r.weekClicks === 1 ? "" : "s"}${r.emailed ? "" : " · <em>not emailed (no address)</em>"}</li>`
    )
    .join("");
  const html = `
    <p>Cruising Cove marketplace click report — <strong>${escapeHtml(opts.week.label)}</strong></p>
    <p><strong>Total Visit shop clicks:</strong> ${escapeHtml(String(total))}</p>
    <ul>${htmlRows || "<li>No published shops.</li>"}</ul>
  `;
  return { subject, html, text };
}

export type WeeklyClickRunResult = {
  week: UtcWeekWindow;
  dryRun: boolean;
  shops: number;
  emailed: number;
  skipped: number;
  errors: number;
  details: {
    shopId: string;
    shopName: string;
    weekClicks: number;
    lifetimeClicks: number;
    to?: string;
    action: "sent" | "would_send" | "skipped" | "error";
    error?: string;
  }[];
};

/**
 * Email each published shop owner their previous-week click count.
 * Idempotent via PublishedSellers.lastClickReportWeek = weekStartYmd.
 */
export async function runSellerWeeklyClickReports(
  opts: { dryRun?: boolean; force?: boolean; now?: Date } = {}
): Promise<WeeklyClickRunResult> {
  const dryRun = Boolean(opts.dryRun);
  const force = Boolean(opts.force);
  const week = previousUtcWeek(opts.now || new Date());
  const result: WeeklyClickRunResult = {
    week,
    dryRun,
    shops: 0,
    emailed: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const published = sellersTable(PUBLISHED_TABLE);
  await published.createTable();

  const digestRows: {
    shopName: string;
    shopId: string;
    weekClicks: number;
    emailed: boolean;
  }[] = [];

  for await (const entity of published.listEntities()) {
    const status = String((entity as { status?: unknown }).status || "published");
    if (status && status !== "published") continue;

    const shopId = String(entity.rowKey || "").trim();
    if (!shopId) continue;
    result.shops += 1;

    const shopName = String(
      (entity as { shopName?: unknown }).shopName ||
        (entity as { name?: unknown }).name ||
        shopId
    ).trim();
    const to = String((entity as { emailNotify?: unknown }).emailNotify || "").trim();
    const lifetimeRaw = (entity as { visitCount?: unknown }).visitCount;
    const lifetimeClicks =
      typeof lifetimeRaw === "number"
        ? Math.max(0, Math.floor(lifetimeRaw))
        : typeof lifetimeRaw === "string" && lifetimeRaw.trim()
          ? Math.max(0, Math.floor(Number(lifetimeRaw) || 0))
          : 0;
    const lastWeek = String((entity as { lastClickReportWeek?: unknown }).lastClickReportWeek || "").trim();

    if (!force && lastWeek === week.weekStartYmd) {
      result.skipped += 1;
      result.details.push({
        shopId,
        shopName,
        weekClicks: 0,
        lifetimeClicks,
        action: "skipped",
        error: "already reported for this week",
      });
      continue;
    }

    let weekClicks = 0;
    try {
      weekClicks = await countShopClicksInWeek(shopId, week);
    } catch (err) {
      result.errors += 1;
      result.details.push({
        shopId,
        shopName,
        weekClicks: 0,
        lifetimeClicks,
        action: "error",
        error: err instanceof Error ? err.message : "count failed",
      });
      continue;
    }

    if (!to || !to.includes("@")) {
      result.skipped += 1;
      digestRows.push({ shopName, shopId, weekClicks, emailed: false });
      result.details.push({
        shopId,
        shopName,
        weekClicks,
        lifetimeClicks,
        action: "skipped",
        error: "no emailNotify on published shop",
      });
      if (!dryRun) {
        try {
          await published.updateEntity(
            {
              partitionKey: "directory",
              rowKey: shopId,
              lastClickReportWeek: week.weekStartYmd,
              lastClickReportAt: new Date().toISOString(),
            },
            "Merge"
          );
        } catch {
          /* non-fatal */
        }
      }
      continue;
    }

    const email = buildSellerWeeklyClickEmail({
      shopName,
      shopId,
      weekClicks,
      lifetimeClicks,
      week,
    });

    if (dryRun) {
      result.details.push({
        shopId,
        shopName,
        weekClicks,
        lifetimeClicks,
        to,
        action: "would_send",
      });
      digestRows.push({ shopName, shopId, weekClicks, emailed: true });
      continue;
    }

    const sendResult: SendEmailResult = await sendEmailResult(to, email.subject, email.html, email.text);
    if (!sendResult.ok) {
      result.errors += 1;
      result.details.push({
        shopId,
        shopName,
        weekClicks,
        lifetimeClicks,
        to,
        action: "error",
        error: sendResult.reason,
      });
      continue;
    }

    result.emailed += 1;
    digestRows.push({ shopName, shopId, weekClicks, emailed: true });
    result.details.push({
      shopId,
      shopName,
      weekClicks,
      lifetimeClicks,
      to,
      action: "sent",
    });

    try {
      await published.updateEntity(
        {
          partitionKey: "directory",
          rowKey: shopId,
          lastClickReportWeek: week.weekStartYmd,
          lastClickReportAt: new Date().toISOString(),
        },
        "Merge"
      );
    } catch {
      /* email already sent — next run may duplicate without this stamp */
    }
  }

  // Site-owner digest (always attempt when not dry-run)
  if (!dryRun && digestRows.length) {
    const digest = buildOwnerWeeklyDigest({ week, rows: digestRows });
    await sendEmailResult(notifyEmail(), digest.subject, digest.html, digest.text);
  } else if (dryRun && digestRows.length) {
    result.details.push({
      shopId: "_owner_digest",
      shopName: "Site owner digest",
      weekClicks: digestRows.reduce((s, r) => s + r.weekClicks, 0),
      lifetimeClicks: 0,
      to: notifyEmail(),
      action: "would_send",
    });
  }

  return result;
}

export function weekContainsDay(week: UtcWeekWindow, dayYmd: string): boolean {
  return dayYmd >= week.weekStartYmd && dayYmd < week.weekEndExclusiveYmd;
}
