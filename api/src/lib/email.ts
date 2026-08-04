/** Shared Resend helper for transactional site emails. */

export function notifyEmail(): string {
  return (process.env.AGENT_LEAD_NOTIFY_EMAIL || "cgrove0712@gmail.com").trim();
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Cruising Cove <onboarding@resend.dev>";
  if (!key || !to) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  return res.ok;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Sanitize a short field for owner error emails (no secrets). */
export function safeField(value: unknown, max = 120): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Email the site owner when an application / agent-request submit fails.
 * Never include passwords or payment data — those fields are not collected.
 */
export async function notifyOwnerOfSubmitError(opts: {
  form: string;
  error: string;
  source?: string;
  path?: string;
  httpStatus?: number | string;
  context?: Record<string, unknown>;
}): Promise<boolean> {
  const when = new Date().toISOString();
  const form = safeField(opts.form, 80) || "Unknown form";
  const error = safeField(opts.error, 400) || "Unknown error";
  const source = safeField(opts.source, 80);
  const path = safeField(opts.path, 200);
  const statusRaw = opts.httpStatus;
  const status =
    statusRaw === undefined || statusRaw === null || statusRaw === ""
      ? ""
      : String(statusRaw).slice(0, 8);

  const contextLines: string[] = [];
  const contextHtml: string[] = [];
  const ctx = opts.context || {};
  for (const key of Object.keys(ctx).slice(0, 12)) {
    const val = safeField(ctx[key], 200);
    if (!val) continue;
    const label = safeField(key, 40);
    contextLines.push(`${label}: ${val}`);
    contextHtml.push(`<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}</li>`);
  }

  const subject = `Submit error: ${form}`;
  const text = [
    "A Cruising Cove application / request submit failed.",
    "",
    `Form: ${form}`,
    `When: ${when}`,
    source ? `Source: ${source}` : "",
    path ? `Path: ${path}` : "",
    status ? `HTTP status: ${status}` : "",
    `Error: ${error}`,
    "",
    ...(contextLines.length ? ["Context:", ...contextLines] : []),
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>A Cruising Cove application / request submit <strong>failed</strong>.</p>
    <ul>
      <li><strong>Form:</strong> ${escapeHtml(form)}</li>
      <li><strong>When:</strong> ${escapeHtml(when)}</li>
      ${source ? `<li><strong>Source:</strong> ${escapeHtml(source)}</li>` : ""}
      ${path ? `<li><strong>Path:</strong> ${escapeHtml(path)}</li>` : ""}
      ${status ? `<li><strong>HTTP status:</strong> ${escapeHtml(status)}</li>` : ""}
      <li><strong>Error:</strong> ${escapeHtml(error)}</li>
    </ul>
    ${contextHtml.length ? `<p><strong>Context</strong></p><ul>${contextHtml.join("")}</ul>` : ""}
  `;

  return sendEmail(notifyEmail(), subject, html, text);
}
