import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  SAILINGS_TABLE,
  MEMBERS_TABLE,
  corsJson,
  parseSailingKey,
  requireUser,
  sailingKey,
  shipLabel,
  table,
} from "../lib/community";
import { notifyMembersOfJoin, wantsEmailNotify } from "../lib/communityNotify";

const SHIPS = [
  "disney-wish",
  "disney-treasure",
  "disney-destiny",
  "disney-dream",
  "disney-fantasy",
  "disney-magic",
  "disney-wonder",
  "disney-adventure",
];

export async function listSailings(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  try {
    const client = await table(SAILINGS_TABLE);
    const items: Array<Record<string, unknown>> = [];
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq 'sailing'` } });
    for await (const entity of iter) {
      items.push({
        key: String(entity.rowKey),
        shipSlug: String(entity.shipSlug ?? ""),
        shipName: String(entity.shipName ?? ""),
        embarkDate: String(entity.embarkDate ?? ""),
        departurePort: String(entity.departurePort ?? ""),
        nights: String(entity.nights ?? ""),
        title: String(entity.title ?? ""),
        memberCount: Number(entity.memberCount ?? 0),
        postCount: Number(entity.postCount ?? 0),
        createdAt: String(entity.createdAt ?? ""),
      });
    }
    items.sort((a, b) => String(a.embarkDate).localeCompare(String(b.embarkDate)));
    return corsJson(200, { sailings: items, ships: SHIPS.map((s) => ({ slug: s, name: shipLabel(s) })) });
  } catch (err) {
    context.error("listSailings failed:", err);
    return corsJson(500, { error: "Could not load sailings." });
  }
}

export async function createOrJoinSailing(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to join a sailing community." });

  let body: {
    shipSlug?: string;
    embarkDate?: string;
    departurePort?: string;
    nights?: string;
    title?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  let key: string;
  try {
    key = sailingKey(body.shipSlug ?? "", body.embarkDate ?? "");
  } catch (err) {
    return corsJson(400, { error: err instanceof Error ? err.message : "Invalid sailing." });
  }

  const parsed = parseSailingKey(key)!;
  const sailings = await table(SAILINGS_TABLE);
  const members = await table(MEMBERS_TABLE);
  const now = new Date().toISOString();
  const shipName = shipLabel(parsed.shipSlug);
  const departurePort = (body.departurePort ?? "").trim().slice(0, 80);
  const nights = (body.nights ?? "").trim().slice(0, 10);
  const title =
    (body.title ?? "").trim().slice(0, 80) ||
    `${shipName} · ${parsed.embarkDate}${departurePort ? ` · ${departurePort}` : ""}`;

  try {
    let created = false;
    try {
      await sailings.getEntity("sailing", key);
    } catch {
      await sailings.createEntity({
        partitionKey: "sailing",
        rowKey: key,
        shipSlug: parsed.shipSlug,
        shipName,
        embarkDate: parsed.embarkDate,
        departurePort,
        nights,
        title,
        memberCount: 0,
        postCount: 0,
        createdAt: now,
        createdBy: user.userId,
      });
      created = true;
    }

    let joinedNow = false;
    let emailNotify = true;
    try {
      const existingMember = await members.getEntity(key, user.userId);
      emailNotify = wantsEmailNotify(existingMember.emailNotify);
    } catch {
      await members.createEntity({
        partitionKey: key,
        rowKey: user.userId,
        email: user.email,
        displayName: user.displayName,
        joinedAt: now,
        emailNotify: true,
      });
      joinedNow = true;
      emailNotify = true;
      try {
        const meta = await sailings.getEntity("sailing", key);
        await sailings.updateEntity(
          {
            partitionKey: "sailing",
            rowKey: key,
            etag: meta.etag,
            memberCount: Number(meta.memberCount ?? 0) + 1,
          },
          "Merge"
        );
      } catch {
        /* best-effort count */
      }
    }

    const meta = await sailings.getEntity("sailing", key);
    if (joinedNow) {
      // Await fan-out so Azure doesn't freeze mid-send; failures never fail join.
      await notifyMembersOfJoin({
        sailingKey: key,
        actorUserId: user.userId,
        actorName: user.displayName,
        shipName: String(meta.shipName ?? shipName),
        embarkDate: String(meta.embarkDate ?? parsed.embarkDate),
        log: (...args) => context.warn(String(args[0]), ...args.slice(1)),
      });
    }

    return corsJson(200, {
      success: true,
      created,
      sailing: {
        key,
        shipSlug: String(meta.shipSlug),
        shipName: String(meta.shipName),
        embarkDate: String(meta.embarkDate),
        departurePort: String(meta.departurePort ?? ""),
        nights: String(meta.nights ?? ""),
        title: String(meta.title),
        memberCount: Number(meta.memberCount ?? 0),
        postCount: Number(meta.postCount ?? 0),
      },
      emailNotify,
    });
  } catch (err) {
    context.error("createOrJoinSailing failed:", err);
    return corsJson(500, { error: "Could not join that sailing community." });
  }
}

export async function getSailing(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  try {
    const sailings = await table(SAILINGS_TABLE);
    const meta = await sailings.getEntity("sailing", key);
    const user = await requireUser(request.headers);
    let isMember = false;
    let emailNotify: boolean | null = null;
    if (user) {
      try {
        const member = await (await table(MEMBERS_TABLE)).getEntity(key, user.userId);
        isMember = true;
        emailNotify = wantsEmailNotify(member.emailNotify);
      } catch {
        isMember = false;
      }
    }
    return corsJson(200, {
      sailing: {
        key,
        shipSlug: String(meta.shipSlug),
        shipName: String(meta.shipName),
        embarkDate: String(meta.embarkDate),
        departurePort: String(meta.departurePort ?? ""),
        nights: String(meta.nights ?? ""),
        title: String(meta.title),
        memberCount: Number(meta.memberCount ?? 0),
        postCount: Number(meta.postCount ?? 0),
      },
      isMember,
      emailNotify,
      user,
    });
  } catch (err) {
    context.error("getSailing failed:", err);
    return corsJson(404, { error: "Sailing community not found." });
  }
}

/** PATCH membership prefs — currently emailNotify only. */
export async function updateSailingMembership(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to update sailing preferences." });

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  let body: { emailNotify?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  if (typeof body.emailNotify !== "boolean") {
    return corsJson(400, { error: "emailNotify (boolean) is required." });
  }

  try {
    const members = await table(MEMBERS_TABLE);
    const existing = await members.getEntity(key, user.userId);
    await members.updateEntity(
      {
        partitionKey: key,
        rowKey: user.userId,
        etag: existing.etag,
        emailNotify: body.emailNotify,
      },
      "Merge"
    );
    return corsJson(200, { success: true, emailNotify: body.emailNotify });
  } catch (err) {
    context.error("updateSailingMembership failed:", err);
    return corsJson(403, { error: "Join this sailing community before updating preferences." });
  }
}

// SWA managed Functions only keep one registration per route — combine methods.
async function sailingsCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return listSailings(request, context);
  if (request.method === "POST") return createOrJoinSailing(request, context);
  return corsJson(204, {});
}

async function sailingItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return getSailing(request, context);
  if (request.method === "PATCH" || request.method === "PUT") {
    return updateSailingMembership(request, context);
  }
  return corsJson(204, {});
}

app.http("sailingsCollection", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings",
  handler: sailingsCollection,
});

app.http("getSailing", {
  methods: ["GET", "PATCH", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}",
  handler: sailingItem,
});
