/** Owner-only click emails for marketplace shops and agent profiles. */

import { escapeHtml, notifyEmail, sendEmail } from "./email";

export const CLICK_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per shop / agent

export function parseVisitCount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/** True when lastNotifyAt is missing or older than the cooldown window. */
export function shouldSendClickNotify(lastNotifyAt: unknown, nowMs = Date.now()): boolean {
  const raw = String(lastNotifyAt ?? "").trim();
  if (!raw) return true;
  const prev = Date.parse(raw);
  if (Number.isNaN(prev)) return true;
  return nowMs - prev >= CLICK_NOTIFY_COOLDOWN_MS;
}

function normalizePath(path: unknown): string {
  const p = String(path ?? "").trim().slice(0, 300);
  return p || "—";
}

export async function notifyMarketplaceClick(opts: {
  shopName: string;
  shopId: string;
  visitCount: number;
  path?: string;
  at?: string;
}): Promise<boolean> {
  const name = String(opts.shopName || opts.shopId || "Shop").trim() || "Shop";
  const id = String(opts.shopId || "").trim();
  const count = Math.max(0, Math.floor(opts.visitCount));
  const when = opts.at && !Number.isNaN(Date.parse(opts.at)) ? opts.at : new Date().toISOString();
  const path = normalizePath(opts.path);
  const subject = `Marketplace click: ${name} (${count} visit${count === 1 ? "" : "s"})`;
  const text = [
    "Someone clicked Visit shop on Cruising Cove.",
    "",
    `Shop: ${name}${id ? ` (${id})` : ""}`,
    `When: ${when}`,
    `Page: ${path}`,
    `Running visit count: ${count}`,
    "",
    "Owner-only notice — the seller is not emailed.",
  ].join("\n");
  const html = `
    <p>Someone clicked <strong>Visit shop</strong> on Cruising Cove.</p>
    <ul>
      <li><strong>Shop:</strong> ${escapeHtml(name)}${id ? ` (${escapeHtml(id)})` : ""}</li>
      <li><strong>When:</strong> ${escapeHtml(when)}</li>
      <li><strong>Page:</strong> ${escapeHtml(path)}</li>
      <li><strong>Running visit count:</strong> ${escapeHtml(String(count))}</li>
    </ul>
    <p>Owner-only notice — the seller is not emailed.</p>
  `;
  return sendEmail(notifyEmail(), subject, html, text);
}

export async function notifyAgentProfileClick(opts: {
  agentName: string;
  agentId: string;
  visitCount: number;
  path?: string;
  at?: string;
}): Promise<boolean> {
  const name = String(opts.agentName || opts.agentId || "Agent").trim() || "Agent";
  const id = String(opts.agentId || "").trim();
  const count = Math.max(0, Math.floor(opts.visitCount));
  const when = opts.at && !Number.isNaN(Date.parse(opts.at)) ? opts.at : new Date().toISOString();
  const path = normalizePath(opts.path);
  const subject = `Agent profile click: ${name} (${count} view${count === 1 ? "" : "s"})`;
  const text = [
    "Someone opened an agent profile on Cruising Cove.",
    "",
    `Agent: ${name}${id ? ` (${id})` : ""}`,
    `When: ${when}`,
    `Page: ${path}`,
    `Running view count: ${count}`,
    "",
    "Owner-only notice — the agent is not emailed.",
  ].join("\n");
  const html = `
    <p>Someone opened an agent profile on Cruising Cove.</p>
    <ul>
      <li><strong>Agent:</strong> ${escapeHtml(name)}${id ? ` (${escapeHtml(id)})` : ""}</li>
      <li><strong>When:</strong> ${escapeHtml(when)}</li>
      <li><strong>Page:</strong> ${escapeHtml(path)}</li>
      <li><strong>Running view count:</strong> ${escapeHtml(String(count))}</li>
    </ul>
    <p>Owner-only notice — the agent is not emailed.</p>
  `;
  return sendEmail(notifyEmail(), subject, html, text);
}
