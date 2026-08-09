import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { adminAuthOk } from "../lib/adminAuth";
import { runSellerWeeklyClickReports } from "../lib/sellerClicks";

/** Mondays 14:00 UTC — weekly shop-click report to each store owner. */
export async function sellerClickWeeklyTimer(timer: Timer, context: InvocationContext): Promise<void> {
  void timer;
  try {
    const summary = await runSellerWeeklyClickReports({ dryRun: false });
    context.log(
      `sellerClickWeeklyTimer: week=${summary.week.weekStartYmd} shops=${summary.shops} emailed=${summary.emailed} skipped=${summary.skipped} errors=${summary.errors}`
    );
  } catch (err) {
    context.error("sellerClickWeeklyTimer failed:", err);
  }
}

/**
 * Manual / dry-run: GET /api/sellers/clicks/weekly-run?key=…&dryRun=1
 * Optional force=1 to re-send even if lastClickReportWeek already matches.
 */
export async function sellerClickWeeklyRun(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return { status: 401, jsonBody: { error: "Unauthorized." } };
  }

  const dryParam = (request.query.get("dryRun") || request.query.get("dry") || "").toLowerCase();
  const dryRun = dryParam === "1" || dryParam === "true" || dryParam === "yes";
  const forceParam = (request.query.get("force") || "").toLowerCase();
  const force = forceParam === "1" || forceParam === "true" || forceParam === "yes";

  try {
    const summary = await runSellerWeeklyClickReports({ dryRun, force });
    return {
      status: 200,
      jsonBody: {
        success: true,
        ...summary,
        message: dryRun
          ? "Dry run only — no emails sent and lastClickReportWeek was not updated."
          : "Weekly click report run complete.",
      },
    };
  } catch (err) {
    context.error("sellerClickWeeklyRun failed:", err);
    return { status: 500, jsonBody: { error: "Weekly click report run failed." } };
  }
}

app.timer("sellerClickWeeklyTimer", {
  schedule: "0 0 14 * * 1", // Mondays 14:00 UTC
  handler: sellerClickWeeklyTimer,
});

app.http("sellerClickWeeklyRun", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "sellers/clicks/weekly-run",
  handler: sellerClickWeeklyRun,
});
