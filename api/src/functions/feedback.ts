import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { escapeHtml, notifyOwnerOfSubmitError, safeField, sendEmail } from "../lib/email";

interface FeedbackInput {
  name?: string;
  email?: string;
  message?: string;
  pageUrl?: string;
}

function feedbackNotifyEmail(): string {
  return (
    process.env.FEEDBACK_NOTIFY_EMAIL ||
    process.env.AGENT_LEAD_NOTIFY_EMAIL ||
    "cgrove0712@gmail.com"
  ).trim();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitFeedback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: FeedbackInput;
  try {
    body = (await request.json()) as FeedbackInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const pageUrl = String(body.pageUrl ?? "").trim().slice(0, 500);

  if (!email || !looksLikeEmail(email)) {
    return { status: 400, jsonBody: { error: "A valid email address is required." } };
  }
  if (!message || message.length < 2) {
    return { status: 400, jsonBody: { error: "Please enter your feedback message." } };
  }

  const to = feedbackNotifyEmail();
  const subject = pageUrl
    ? `Cruising Cove feedback — ${pageUrl.replace(/^https?:\/\//, "").slice(0, 80)}`
    : "Cruising Cove feedback";

  const text = [
    "New feedback submitted on Cruising Cove.",
    "",
    `Name: ${name || "—"}`,
    `Email: ${email}`,
    `Page: ${pageUrl || "—"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const html = `
    <p>New feedback submitted on Cruising Cove.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(name || "—")}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Page:</strong> ${
        pageUrl
          ? `<a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>`
          : "—"
      }</li>
    </ul>
    <p><strong>Message</strong></p>
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `;

  try {
    const sent = await sendEmail(to, subject, html, text);
    if (!sent) {
      context.warn("Feedback email not sent (check RESEND_API_KEY / RESEND_FROM_EMAIL).");
      try {
        await notifyOwnerOfSubmitError({
          form: "Site feedback",
          error: "Resend sendEmail returned false",
          source: "api/feedback",
          path: pageUrl,
          httpStatus: 502,
          context: { email: safeField(email), name: safeField(name) },
        });
      } catch (notifyErr) {
        context.error("Feedback error notify failed:", notifyErr);
      }
      return {
        status: 502,
        jsonBody: { error: "Could not send your feedback right now. Please try again." },
      };
    }
  } catch (err) {
    context.error("Failed to send feedback email:", err);
    const messageText = err instanceof Error ? err.message : String(err);
    try {
      await notifyOwnerOfSubmitError({
        form: "Site feedback",
        error: messageText,
        source: "api/feedback",
        path: pageUrl,
        httpStatus: 500,
        context: { email: safeField(email), name: safeField(name) },
      });
    } catch (notifyErr) {
      context.error("Feedback error notify failed:", notifyErr);
    }
    return {
      status: 500,
      jsonBody: { error: "Something went wrong sending your feedback. Please try again." },
    };
  }

  return {
    status: 200,
    jsonBody: {
      success: true,
      message: "Thanks — your feedback was sent.",
    },
  };
}

app.http("submitFeedback", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "feedback",
  handler: submitFeedback,
});
