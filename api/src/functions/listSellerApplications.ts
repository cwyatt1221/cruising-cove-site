import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { APPLICATIONS_TABLE, adminKeyOk, splitCsv, table } from "../lib/sellers";

export async function listSellerApplications(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminKeyOk(request))) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const statusFilter = request.query.get("status");

  try {
    const client = table(APPLICATIONS_TABLE);
    await client.createTable();
    const applications: Record<string, unknown>[] = [];

    for await (const entity of client.listEntities()) {
      if (statusFilter && entity.status !== statusFilter) continue;

      applications.push({
        id: entity.rowKey,
        partitionKey: entity.partitionKey,
        submittedAt: entity.submittedAt,
        status: entity.status,
        publishedSellerId: entity.publishedSellerId || null,
        featured: Boolean(entity.featured),
        shopName: entity.shopName,
        shopUrl: entity.shopUrl || entity.etsyShopUrl || "",
        ownerName: entity.ownerName,
        email: entity.email,
        shopDescription: entity.shopDescription,
        photoUrls: splitCsv(entity.photoUrls),
        productCategories: splitCsv(entity.productCategories),
        productCategoriesOther: entity.productCategoriesOther || "",
        socialLinks: {
          instagram: entity.instagramUrl || null,
          tiktok: entity.tiktokUrl || null,
          facebook: entity.facebookUrl || null,
        },
        audienceSize: entity.audienceSize || "",
        willingToBarter: entity.willingToBarter || "",
        otherNotes: entity.otherNotes || "",
      });
    }

    applications.sort((a: any, b: any) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    return { status: 200, jsonBody: { totalApplications: applications.length, applications } };
  } catch (err) {
    context.error("listSellerApplications error:", err);
    return { status: 500, jsonBody: { error: "Failed to list applications." } };
  }
}

app.http("listSellerApplications", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "seller-applications",
  handler: listSellerApplications,
});
