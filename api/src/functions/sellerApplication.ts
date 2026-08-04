import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const TABLE_NAME = "SellerApplications";
const MAX_PHOTOS = 4;

interface SellerApplicationInput {
  shopName?: string;
  shopUrl?: string;
  /** @deprecated use shopUrl */
  etsyShopUrl?: string;
  ownerName?: string;
  email?: string;
  shopDescription?: string;
  photoUrls?: string[];
  productCategories?: string[];
  productCategoriesOther?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  audienceSize?: string;
  willingToBarter?: string; // "yes" | "no" | "maybe"
  otherNotes?: string;
}

let tableClient: TableClient | null = null;
async function getTableClient(): Promise<TableClient> {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    await tableClient.createTable();
  }
  return tableClient;
}

function csv(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}

export async function submitSellerApplication(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: SellerApplicationInput;
  try {
    body = (await request.json()) as SellerApplicationInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const shopUrl = String(body.shopUrl || body.etsyShopUrl || "").trim();
  if (!body.shopName?.trim() || !shopUrl || !body.ownerName?.trim() || !body.email?.trim()) {
    return { status: 400, jsonBody: { error: "Shop name, shop URL, owner name, and email are required." } };
  }

  if (!body.shopDescription?.trim()) {
    return { status: 400, jsonBody: { error: "A directory description is required." } };
  }

  if (!body.photoUrls || body.photoUrls.length < 1) {
    return { status: 400, jsonBody: { error: "Upload at least one product photo." } };
  }

  const productCategories = Array.isArray(body.productCategories)
    ? body.productCategories.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const productCategoriesOther = String(body.productCategoriesOther ?? "").trim();
  if (productCategories.length === 0 && !productCategoriesOther) {
    return { status: 400, jsonBody: { error: "Select at least one product category (or describe one under Other)." } };
  }

  const photoUrls = (body.photoUrls ?? []).slice(0, MAX_PHOTOS);

  try {
    const client = await getTableClient();
    const now = new Date();
    await client.createEntity({
      partitionKey: now.toISOString().slice(0, 10),
      rowKey: randomUUID(),
      status: "pending",
      shopName: body.shopName.trim(),
      shopUrl,
      etsyShopUrl: shopUrl, // legacy column for existing admin/readers
      ownerName: body.ownerName.trim(),
      email: body.email.trim(),
      shopDescription: body.shopDescription ?? "",
      photoUrls: csv(photoUrls),
      productCategories: csv(productCategories),
      productCategoriesOther: productCategoriesOther,
      instagramUrl: body.instagramUrl ?? "",
      tiktokUrl: body.tiktokUrl ?? "",
      facebookUrl: body.facebookUrl ?? "",
      audienceSize: body.audienceSize ?? "",
      willingToBarter: body.willingToBarter ?? "",
      otherNotes: body.otherNotes ?? "",
      submittedAt: now.toISOString(),
    });
  } catch (err) {
    context.error("Failed to store seller application:", err);
    return { status: 500, jsonBody: { error: "Something went wrong submitting your application. Please try again." } };
  }

  return { status: 200, jsonBody: { success: true } };
}

app.http("submitSellerApplication", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "seller-application",
  handler: submitSellerApplication,
});
