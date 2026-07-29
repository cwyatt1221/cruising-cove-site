import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  MEMBERS_TABLE,
  SIGNUPS_TABLE,
  SignupType,
  corsJson,
  isSignupType,
  parseSailingKey,
  requireUser,
  signupRowKey,
  table,
} from "../lib/community";

async function assertMember(sailingKey: string, userId: string): Promise<boolean> {
  try {
    await (await table(MEMBERS_TABLE)).getEntity(sailingKey, userId);
    return true;
  } catch {
    return false;
  }
}

function serializeSignup(entity: Record<string, unknown>) {
  return {
    type: String(entity.type ?? ""),
    userId: String(entity.userId ?? ""),
    displayName: String(entity.displayName ?? "Member"),
    cabin: String(entity.cabin ?? ""),
    notes: String(entity.notes ?? ""),
    joinedAt: String(entity.joinedAt ?? ""),
  };
}

export async function listSignups(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  const typeFilter = (request.query.get("type") || "all").trim();
  if (typeFilter !== "all" && !isSignupType(typeFilter)) {
    return corsJson(400, { error: "type must be fish-extender, pixie-dust, or all." });
  }

  try {
    const fish: ReturnType<typeof serializeSignup>[] = [];
    const pixie: ReturnType<typeof serializeSignup>[] = [];
    const client = await table(SIGNUPS_TABLE);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      const item = serializeSignup(entity as Record<string, unknown>);
      if (item.type === "fish-extender") fish.push(item);
      if (item.type === "pixie-dust") pixie.push(item);
    }
    fish.sort((a, b) => a.displayName.localeCompare(b.displayName));
    pixie.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const user = await requireUser(request.headers.get("authorization"));
    let myFish = false;
    let myPixie = false;
    if (user) {
      myFish = fish.some((s) => s.userId === user.userId);
      myPixie = pixie.some((s) => s.userId === user.userId);
    }

    if (typeFilter === "fish-extender") {
      return corsJson(200, { fishExtender: fish, pixieDust: [], myFishExtender: myFish, myPixieDust: myPixie });
    }
    if (typeFilter === "pixie-dust") {
      return corsJson(200, { fishExtender: [], pixieDust: pixie, myFishExtender: myFish, myPixieDust: myPixie });
    }
    return corsJson(200, {
      fishExtender: fish,
      pixieDust: pixie,
      myFishExtender: myFish,
      myPixieDust: myPixie,
    });
  } catch (err) {
    context.error("listSignups failed:", err);
    return corsJson(500, { error: "Could not load sign-ups." });
  }
}

export async function createSignup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers.get("authorization"));
  if (!user) return corsJson(401, { error: "Sign in to join Fish Extender or Pixie Dust." });

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  if (!(await assertMember(key, user.userId))) {
    return corsJson(403, { error: "Join this sailing community before signing up." });
  }

  let body: { type?: string; cabin?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const typeRaw = (body.type ?? "").trim();
  if (!isSignupType(typeRaw)) {
    return corsJson(400, { error: "type must be fish-extender or pixie-dust." });
  }
  const type: SignupType = typeRaw;

  const cabin = (body.cabin ?? "").trim().slice(0, 20);
  const notes = (body.notes ?? "").trim().slice(0, 280);

  if (type === "fish-extender" && !cabin) {
    return corsJson(400, { error: "Cabin number is required for Fish Extender so gifts can find you." });
  }

  const rowKey = signupRowKey(type, user.userId);
  const now = new Date().toISOString();
  const client = await table(SIGNUPS_TABLE);

  try {
    try {
      await client.getEntity(key, rowKey);
      return corsJson(409, {
        error:
          type === "fish-extender"
            ? "You’re already on the Fish Extender list for this sailing."
            : "You’re already on the Pixie Dust list for this sailing.",
      });
    } catch {
      /* not signed up yet */
    }

    await client.createEntity({
      partitionKey: key,
      rowKey,
      type,
      userId: user.userId,
      displayName: user.displayName,
      email: user.email,
      cabin,
      notes,
      joinedAt: now,
    });

    return corsJson(200, {
      success: true,
      signup: {
        type,
        userId: user.userId,
        displayName: user.displayName,
        cabin,
        notes,
        joinedAt: now,
      },
    });
  } catch (err) {
    context.error("createSignup failed:", err);
    return corsJson(500, { error: "Could not save your sign-up." });
  }
}

export async function deleteSignup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers.get("authorization"));
  if (!user) return corsJson(401, { error: "Sign in to leave a sign-up list." });

  const key = request.params.sailingKey;
  const typeRaw = (request.params.type || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!isSignupType(typeRaw)) return corsJson(400, { error: "type must be fish-extender or pixie-dust." });

  try {
    await (await table(SIGNUPS_TABLE)).deleteEntity(key, signupRowKey(typeRaw, user.userId));
    return corsJson(200, { success: true });
  } catch (err) {
    context.error("deleteSignup failed:", err);
    return corsJson(404, { error: "You were not on that list." });
  }
}

async function signupsCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return listSignups(request, context);
  if (request.method === "POST") return createSignup(request, context);
  return corsJson(204, {});
}

app.http("signupsCollection", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/signups",
  handler: signupsCollection,
});

app.http("deleteSignup", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "community/sailings/{sailingKey}/signups/{type}",
  handler: deleteSignup,
});
