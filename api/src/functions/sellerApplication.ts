import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

const TABLE_NAME = "SellerApplications";
const MAX_PHOTOS = 4;

interface SellerApplicationInput {
  shopName?: string;
  etsyShopUrl?: string;
  ownerName?: string;
  email?: string;
  shopDescription?: string;
  photoUrls?: string[];
  productCategories?: string[];
  productCategoriesOther?: string;
  confirmNoUnlicensedCharacterMerch?: boolean;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  audienceSize?: string;
  whyFeature?: string;
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

  if (!body.shopName?.trim() || !body.etsyShopUrl?.trim() || !body.ownerName?.trim() || !body.email?.trim()) {
    return { status: 400, jsonBody: { error: "Shop name, Etsy shop URL, owner name, and email are required." } };
  }

  // Required attestation — matches the site's category restriction policy: featured
  // placement is limited to non-Disney-IP items, whether the arrangement is paid or barter.
  if (body.confirmNoUnlicensedCharacterMerch !== true) {
    return {
      status: 400,
      jsonBody: { error: "You must confirm the items submitted for featured placement don't include unlicensed Disney character merchandise." },
    };
  }

  if (!body.productCategories || body.productCategories.length === 0) {
    return { status: 400, jsonBody: { error: "Select at least one product category." } };
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
      etsyShopUrl: body.etsyShopUrl.trim(),
      ownerName: body.ownerName.trim(),
      email: body.email.trim(),
      shopDescription: body.shopDescription ?? "",
      photoUrls: csv(photoUrls),
      productCategories: csv(body.productCategories),
      productCategoriesOther: body.productCategoriesOther ?? "",
      confirmNoUnlicensedCharacterMerch: true,
      instagramUrl: body.instagramUrl ?? "",
      tiktokUrl: body.tiktokUrl ?? "",
      facebookUrl: body.facebookUrl ?? "",
      audienceSize: body.audienceSize ?? "",
      whyFeature: body.whyFeature ?? "",
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
