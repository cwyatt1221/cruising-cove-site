import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  FE_GROUP_SIZE,
  MEMBERS_TABLE,
  SIGNUPS_TABLE,
  SIGNUP_GENERATION,
  SignupType,
  corsJson,
  isSignupType,
  parseSailingKey,
  requireUser,
  signupRowKey,
  table,
} from "../lib/community";
import { adminAuthOk } from "../lib/adminAuth";

type SignupView = {
  type: string;
  userId: string;
  displayName: string;
  cabin: string;
  notes: string;
  joinedAt: string;
  groupNumber: number | null;
};

type FishGroup = {
  groupNumber: number;
  members: SignupView[];
  capacity: number;
  open: boolean;
};

async function assertMember(sailingKey: string, userId: string): Promise<boolean> {
  try {
    await (await table(MEMBERS_TABLE)).getEntity(sailingKey, userId);
    return true;
  } catch {
    return false;
  }
}

function serializeSignup(entity: Record<string, unknown>): SignupView {
  const groupRaw = entity.groupNumber;
  const groupNumber =
    groupRaw === undefined || groupRaw === null || groupRaw === ""
      ? null
      : Number(groupRaw);
  return {
    type: String(entity.type ?? ""),
    userId: String(entity.userId ?? ""),
    displayName: String(entity.displayName ?? "Member"),
    cabin: String(entity.cabin ?? ""),
    notes: String(entity.notes ?? ""),
    joinedAt: String(entity.joinedAt ?? ""),
    groupNumber: Number.isFinite(groupNumber as number) ? (groupNumber as number) : null,
  };
}

function isCurrentGeneration(entity: Record<string, unknown>): boolean {
  const gen = Number(entity.generation ?? 0);
  return gen === SIGNUP_GENERATION;
}

function buildFishGroups(fish: SignupView[]): FishGroup[] {
  const byGroup = new Map<number, SignupView[]>();
  for (const member of fish) {
    const n = member.groupNumber && member.groupNumber > 0 ? member.groupNumber : 1;
    const list = byGroup.get(n) || [];
    list.push(member);
    byGroup.set(n, list);
  }

  const numbers = Array.from(byGroup.keys()).sort((a, b) => a - b);
  if (!numbers.length) {
    return [{ groupNumber: 1, members: [], capacity: FE_GROUP_SIZE, open: true }];
  }

  const groups: FishGroup[] = numbers.map((n) => {
    const members = (byGroup.get(n) || []).slice().sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    return {
      groupNumber: n,
      members,
      capacity: FE_GROUP_SIZE,
      open: false,
    };
  });

  const last = groups[groups.length - 1];
  if (last.members.length >= FE_GROUP_SIZE) {
    last.open = false;
    groups.push({
      groupNumber: last.groupNumber + 1,
      members: [],
      capacity: FE_GROUP_SIZE,
      open: true,
    });
  } else {
    last.open = true;
  }

  return groups;
}

function nextFishGroupNumber(fish: SignupView[]): number {
  if (!fish.length) return 1;
  const maxGroup = Math.max(...fish.map((s) => s.groupNumber || 1));
  const inMax = fish.filter((s) => (s.groupNumber || 1) === maxGroup).length;
  return inMax >= FE_GROUP_SIZE ? maxGroup + 1 : maxGroup;
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
    const fish: SignupView[] = [];
    const pixie: SignupView[] = [];
    const client = await table(SIGNUPS_TABLE);
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      const raw = entity as Record<string, unknown>;
      // Prior generation (test entries) stay in storage but are hidden from the boards.
      if (!isCurrentGeneration(raw)) continue;
      const item = serializeSignup(raw);
      if (item.type === "fish-extender") fish.push(item);
      if (item.type === "pixie-dust") pixie.push(item);
    }
    fish.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.displayName.localeCompare(b.displayName));
    pixie.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const fishGroups = buildFishGroups(fish);
    const openGroup = fishGroups.find((g) => g.open) || fishGroups[fishGroups.length - 1];

    const user = await requireUser(request.headers);
    let myFish = false;
    let myPixie = false;
    let myFishGroup: number | null = null;
    if (user) {
      const mine = fish.find((s) => s.userId === user.userId);
      myFish = !!mine;
      myFishGroup = mine?.groupNumber ?? null;
      myPixie = pixie.some((s) => s.userId === user.userId);
    }

    const payload = {
      fishExtender: fish,
      fishExtenderGroups: fishGroups,
      fishExtenderGroupSize: FE_GROUP_SIZE,
      openFishExtenderGroup: openGroup?.groupNumber ?? 1,
      pixieDust: pixie,
      myFishExtender: myFish,
      myFishExtenderGroup: myFishGroup,
      myPixieDust: myPixie,
    };

    if (typeFilter === "fish-extender") {
      return corsJson(200, { ...payload, pixieDust: [] });
    }
    if (typeFilter === "pixie-dust") {
      return corsJson(200, {
        ...payload,
        fishExtender: [],
        fishExtenderGroups: [],
      });
    }
    return corsJson(200, payload);
  } catch (err) {
    context.error("listSignups failed:", err);
    return corsJson(500, { error: "Could not load sign-ups." });
  }
}

export async function createSignup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
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

    let groupNumber: number | null = null;
    if (type === "fish-extender") {
      const existingFish: SignupView[] = [];
      const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
      for await (const entity of iter) {
        const raw = entity as Record<string, unknown>;
        if (!isCurrentGeneration(raw)) continue;
        const item = serializeSignup(raw);
        if (item.type === "fish-extender") existingFish.push(item);
      }
      groupNumber = nextFishGroupNumber(existingFish);
    }

    await client.createEntity({
      partitionKey: key,
      rowKey,
      type,
      generation: SIGNUP_GENERATION,
      groupNumber: groupNumber ?? undefined,
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
        groupNumber,
      },
    });
  } catch (err) {
    context.error("createSignup failed:", err);
    return corsJson(500, { error: "Could not save your sign-up." });
  }
}

export async function deleteSignup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to leave a sign-up list." });

  const key = request.params.sailingKey;
  const typeRaw = (request.params.type || "").trim();
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });
  if (!isSignupType(typeRaw)) return corsJson(400, { error: "type must be fish-extender or pixie-dust." });

  try {
    const client = await table(SIGNUPS_TABLE);
    // Delete current-generation row; also sweep legacy row keys from earlier tests.
    const keys = [signupRowKey(typeRaw, user.userId), `${typeRaw}_${user.userId}`];
    let deleted = false;
    for (const rowKey of keys) {
      try {
        await client.deleteEntity(key, rowKey);
        deleted = true;
      } catch {
        /* not present */
      }
    }
    if (!deleted) return corsJson(404, { error: "You were not on that list." });
    return corsJson(200, { success: true });
  } catch (err) {
    context.error("deleteSignup failed:", err);
    return corsJson(404, { error: "You were not on that list." });
  }
}

/** Admin: wipe all Fish Extender + Pixie Dust rows for a sailing (current + legacy). */
export async function clearSignups(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  if (!(await adminAuthOk(request))) {
    return corsJson(401, { error: "Unauthorized." });
  }

  const key = request.params.sailingKey;
  if (!key || !parseSailingKey(key)) return corsJson(400, { error: "Invalid sailing key." });

  try {
    const client = await table(SIGNUPS_TABLE);
    let deleted = 0;
    const iter = client.listEntities({ queryOptions: { filter: `PartitionKey eq '${key}'` } });
    for await (const entity of iter) {
      await client.deleteEntity(key, String(entity.rowKey));
      deleted += 1;
    }
    return corsJson(200, { success: true, deleted });
  } catch (err) {
    context.error("clearSignups failed:", err);
    return corsJson(500, { error: "Could not clear sign-ups." });
  }
}

async function signupsCollection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "GET") return listSignups(request, context);
  if (request.method === "POST") return createSignup(request, context);
  if (request.method === "DELETE") return clearSignups(request, context);
  return corsJson(204, {});
}

app.http("signupsCollection", {
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
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
