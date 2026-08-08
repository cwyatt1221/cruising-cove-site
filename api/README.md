# Cruising Cove chat API

An Azure Function (`POST /api/chat`) that answers visitor questions using Claude Haiku 4.5,
and logs every question + answer to Azure Table Storage so you can find frequently-asked
questions later and add the good ones to the FAQ page.

## My Cruise planner

Personalized sailing dashboard (localStorage + optional account sync):

| Route | Purpose |
| --- | --- |
| `GET/POST /api/planner/trips` | List / upsert trips for the signed-in user |
| `DELETE /api/planner/trips/{tripId}` | Delete a trip |
| `GET/POST /api/planner/reviews` | List approved reviews / create a review (`?type=&id=`) |
| `POST /api/planner/packing-suggestions` | Submit packing item (pending moderation) |
| `GET /api/planner/packing-items` | Approved community packing items |
| `POST /api/planner/shares` | Create a shareable trip snapshot link |
| `GET /api/planner/shares/{token}` | Load a shared trip |
| `POST /api/planner/reminders` | Email reminder for booking-window open |
| `GET /api/planner/reminders/unsubscribe?token=` | Cancel a reminder |
| `GET /api/planner/admin/reviews?key=` | Admin review queue |
| `POST /api/planner/admin/reviews/{id}?key=` | Approve / reject review |

Email reminders require SWA app settings `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optionally `PUBLIC_SITE_URL`. A timer job runs hourly to send due reminders.

Tables: `PlannerTrips`, `PlannerReviews`, `PlannerSuggestions`, `PlannerPackingItems`, `PlannerShares`, `PlannerReminders`.

Frontend: `/planning/my-cruise.html`. Admin UI: `/planning/my-cruise-admin.html`.

## Newsletter & sailing tip drips

| Route / job | Purpose |
| --- | --- |
| `POST /api/newsletter` | Store signup (`NewsletterSignups`); owner notify via Resend |
| `POST /api/newsletter/unsubscribe` | `{ email }` or `{ token }` — mark signup(s) `active: false`, clear `sailingTips` |
| `GET /api/newsletter/unsubscribe?token=` | Same for tokenized tip-email links |
| Timer `newsletterTipsTimer` | Daily **14:00 UTC** — tip emails to **active** subscribers with `sailingTips` + `embarkationDate` |
| `GET/POST /api/newsletter/tips/run?key=…&dryRun=1` | Manual/admin run (`REPORT_ACCESS_KEY`); use `dryRun=1` to preview without sending |

Table: `NewsletterSignups` (partitionKey = email, rowKey = signup id). Fields include `active` (default true / missing = active), `unsubToken`, optional `unsubscribedAt`. Tip idempotency: `tipsSent` JSON array of milestone ids (`d90`, `d60`, `d30`, `d14`, `d7`, `d0`), plus `lastTipSentAt` / `lastTipMilestone` after a send. Past embarkation dates and inactive/unsubscribed rows are skipped (no post-cruise drip in v1). Tip email footers link to `/newsletter/unsubscribe.html?token=…`.

Milestone windows (days until embark, UTC):

| Id | Window | Subject style |
| --- | --- | --- |
| `d90` | 61–90 | `{Ship} sailing tip: 90 days to go` |
| `d60` | 31–60 | …60 days to go |
| `d30` | 15–30 | …30 days to go |
| `d14` | 8–14 | …14 days to go |
| `d7` | 1–7 | …7 days to go |
| `d0` | 0 | …embarkation day |

Tips link to real planning pages (booking windows, Castaway Club, packing list, kids clubs, embarkation checklist, agents, etc.). Requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORAGE_CONNECTION_STRING`; optional `PUBLIC_SITE_URL`, `NEWSLETTER_NOTIFY_EMAIL` (owner notify on signup only — tip emails go to the subscriber).

Frontend signup: homepage / nav newsletter form in `assets/site-nav.js`.

### Local test

```bash
cd api
npm install
npm run test:newsletter-tips   # milestone selection unit tests (no email)
npm start                      # Core Tools; timer fires on its cron while running
# Dry-run against storage (no send):
curl "http://localhost:7071/api/newsletter/tips/run?key=$REPORT_ACCESS_KEY&dryRun=1"
# Live send once (careful — emails real subscribers due today):
curl -X POST "http://localhost:7071/api/newsletter/tips/run?key=$REPORT_ACCESS_KEY"
```

## Community (Phase 1)

On-site sailing boards keyed by Disney ship + embarkation date:

| Route | Purpose |
| --- | --- |
| `POST /api/community/register` | Create account (email + password, scrypt hash) |
| `POST /api/community/login` | Sign in → session token |
| `GET /api/community/me` | Current user |
| `GET /api/community/sailings` | List boards |
| `POST /api/community/sailings` | Create/join a board (auth required) |
| `GET /api/community/sailings/{key}` | Board metadata + membership + `emailNotify` (when member) |
| `PATCH /api/community/sailings/{key}` | Update membership prefs (`emailNotify` boolean) |
| `GET/POST /api/community/sailings/{key}/posts` | Message board (GET includes nested `replies`) |
| `PATCH/DELETE /api/community/sailings/{key}/posts/{postId}` | Edit / delete own post (delete removes replies) |
| `POST /api/community/sailings/{key}/posts/{postId}/replies` | Reply to a post (members only) |
| `PATCH/DELETE /api/community/sailings/{key}/posts/{postId}/replies/{replyId}` | Edit / delete own reply |
| `GET/POST /api/community/sailings/{key}/chat` | Board chat (auth + member; GET list, POST send) |
| `GET/POST /api/community/sailings/{key}/signups` | Fish Extender, Pixie Dust & Book trade lists |
| `DELETE /api/community/sailings/{key}/signups/{type}` | Leave a list (`fish-extender` \| `pixie-dust` \| `book-trade`) |
| `GET/POST /api/community/moderation?key=…` | Admin moderation (`REPORT_ACCESS_KEY` or admin session): feed / mutes / **reports**; hide, delete, mute, unmute |
| `POST /api/community/moderation` `{ action: "report", kind, id, sailingKey, reason? }` | Member report (community session) — writes `CommunityModLog` (`action: "report"`, `status: "pending"`); does **not** hide content; emails admin notify |

Tables: `CommunityUsers`, `CommunitySessions`, `CommunitySailings`, `CommunityMembers`, `CommunityPosts`, `CommunityReplies`, `CommunityChatMessages`, `CommunitySignups`, `CommunityMutes`, `CommunityModLog`.

**Board email notifications (v1):** When someone newly joins a sailing board, posts on it, or sends a board chat message, other members with an email on their community account are emailed via Resend (`sendEmail`). The actor (joiner/poster/chat author) is never emailed. Preference is stored on `CommunityMembers.emailNotify` (boolean, **on by default**; missing/legacy rows treated as on). Members can toggle “Email me about this sailing” on `/community/sailing.html`. Emails are short board links only — no cabin/passport content. Fan-out is best-effort (concurrency-limited); join/post/chat still succeed if Resend fails. Requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optional `PUBLIC_SITE_URL`. Skipped for v1: FE/Pixie/Book trade signup emails, digests, push/SMS, in-app center.

**Board chat (v1):** Per-sailing chat for signed-in members only (`CommunityChatMessages`, partition = sailing key). Messages capped at 500 characters with a soft ~4s rate limit per author. UI on `/community/sailing.html` polls about every 4s while the tab is visible. Out of scope for v1: DMs, reactions, image uploads, typing indicators, delete-own-message.

**Moderation (v1):** Site admins can review **pending member reports**, recent posts and chat (optional `sailingKey` filter), soft-**hide** or soft-**delete** content (`hidden` / `deleted` flags — omitted from public GET posts/chat), and **mute** / **unmute** a member on a board (`CommunityMutes`, PK = sailing key, RK = userId). Muted members receive a clear 403 on post, reply, and chat. Quiet actions are written to `CommunityModLog`. Signed-in board members can **Report** a post, reply, or chat message (optional reason); reports create a pending mod-log entry and notify `AGENT_LEAD_NOTIFY_EMAIL` — content stays visible until an admin acts. Admin UI: `/community/admin.html` (linked from `/admin/`). Skipped for v1: auto-mod / AI, IP bans, full audit UI, DMs.

Requires the same `STORAGE_CONNECTION_STRING` as the rest of the API. Frontend: `/community/`.

Fish Extender sign-ups require a cabin number. Pixie Dust cabin is optional. Book trade (`type: "book-trade"`) accepts optional `cabin`, `bringing`, `bringingNote`, `lookingFor`, `notes`, required `audience` (`kids` \| `adults` \| `both`), and optional `displayName` (defaults to community account name). Cabin and display name are visible to that sailing’s board viewers.

Phase 2 (not built): DMs, email verification, FE matchmaking pairs, gift-list signup emails.

## Agent directory applications

Agents submit a profile card for manual review:

| Route | Purpose |
| --- | --- |
| `POST /api/agent-application` | Submit card application |
| `POST /api/agent-photo-upload` | Profile photo → `agent-photos` blob container |
| `GET /api/agent-applications?key=…` | List apps (`REPORT_ACCESS_KEY`) |
| `POST /api/agent-applications/{id}?key=…` | Approve / reject / unpublish (`REPORT_ACCESS_KEY`) |
| `GET /api/agents` | Public published directory cards |
| `GET /api/agents/{id}` | Public published agent profile |
| `POST /api/agents/{id}/visit` | Increment profile view counter; owner email (rate-limited) |

Tables: `AgentApplications`, `PublishedAgents`. Frontend: `/agents/apply.html`, admin review/publish at `/agents/admin.html`, dynamic profiles at `/agents/profile.html?id=…`. Directory at `/agents/` supports client-side specialty filter chips (unique tokens from live agent specialties, including comma-split “other” text). Sample cards remain in `assets/agents-data.js` until at least one live agent is published. Profile opens call `POST /api/agents/{id}/visit` once per browser session; `visitCount` and `lastNotifyAt` live on `PublishedAgents` and are preserved on re-publish.

## Marketplace seller applications (Curated 10)

Shops apply for one of ten marketplace slots:

| Route | Purpose |
| --- | --- |
| `POST /api/seller-application` | Submit shop application |
| `POST /api/seller-photo-upload` | Product photos → `seller-photos` blob container |
| `GET /api/seller-applications?key=…` | List apps (`REPORT_ACCESS_KEY`) |
| `POST /api/seller-applications/{id}?key=…` | Approve / reject / unpublish (`REPORT_ACCESS_KEY`) |
| `GET /api/sellers` | Public published marketplace cards (max 10) |
| `POST /api/sellers/{id}/visit` | Increment shop visit counter (once per browser session on the client); owner email (rate-limited) |
| `POST /api/sellers/{id}?key=…` | Admin edit categories + social-proof quotes on a live shop |

Tables: `SellerApplications`, `PublishedSellers`. Public card fields include `categories`, `socialProofQuotes`, and `visitCount`. `lastNotifyAt` is stored on the published row for owner-email cooldown (not exposed publicly). Frontend: `/marketplace/sellers/`, admin at `/marketplace/sellers/admin.html`, live directory at `/marketplace/`.

### Owner click notifications (marketplace + agent profiles)

Site owner only (`AGENT_LEAD_NOTIFY_EMAIL`, default `cgrove0712@gmail.com`) — **not** the seller or agent.

| Trigger | Endpoint | Email subject style |
| --- | --- | --- |
| Marketplace **Visit shop** | `POST /api/sellers/{id}/visit` | `Marketplace click: {shop} ({n} visits)` |
| Agent profile open | `POST /api/agents/{id}/visit` | `Agent profile click: {name} ({n} views)` |

Each email includes name/id, timestamp, page URL (`path` JSON body or Referer), and the running counter. Counters increment on every recorded visit; emails are soft-rate-limited to **at most one per shop or agent per hour** (`lastNotifyAt` on the published entity). Existing `agent_request_click` and agent-request form emails are unchanged.

## Analytics

| Route | Purpose |
| --- | --- |
| `POST /api/events` | First-party click events (shop / agent CTAs) |
| `GET /api/events-report?key=…&days=30` | Counts + recent events (`REPORT_ACCESS_KEY`) |

Table: `SiteEvents`. Frontend loads Clarity + click tracker via `/assets/analytics.js`. Heatmaps/recordings: https://clarity.microsoft.com

## What this does NOT do yet
- No aggregation/report of top questions — that's the natural next piece to build.
- No content moderation or per-IP rate limiting beyond a basic question-length cap.
- No admin UI for reviewing logged questions — you'd query the table directly for now
  (Azure Storage Explorer, a free desktop app, is the easiest way to browse it).
- Newsletter post-cruise “leave a review” drip is skipped (v1).

## One-time setup (do this before it will work)

### 1. Get an Anthropic API key
Create one at https://console.anthropic.com if you don't already have one.

### 2. Create an Azure Storage Account (for the question log)
If you don't already have one you want to reuse:
```
az storage account create --name cruisingcovelogs --resource-group <your-resource-group> --sku Standard_LRS
```
Then grab its connection string:
```
az storage account show-connection-string --name cruisingcovelogs --resource-group <your-resource-group>
```
(Table Storage at this volume — a few hundred/thousand rows a month — costs pennies, well
within what you'd notice on a bill.)

### 3. Add both as Application Settings on your Static Web App
These become environment variables the Function can read. In the Azure Portal:
Your Static Web App → Configuration → Application settings → Add:
- `ANTHROPIC_API_KEY` = (from step 1)
- `STORAGE_CONNECTION_STRING` = (from step 2)

Or via CLI:
```
az staticwebapp appsettings set --name <your-swa-name> --setting-names ANTHROPIC_API_KEY="sk-ant-..." STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=..."
```

### 4. Point your GitHub Actions workflow at this folder
Open `.github/workflows/azure-static-web-apps-*.yml` in your repo and check the
`api_location` field. It needs to say:
```yaml
api_location: "api"
```
If that field is currently empty or missing, Azure won't know to build/deploy this
Function alongside your static site.

### 5. Local testing (optional, before pushing)
```bash
cd api
cp local.settings.json.template local.settings.json
# then edit local.settings.json and paste your real key + connection string
npm install
npm start
```
This runs the function locally, usually at `http://localhost:7071/api/chat`. Test it with:
```bash
curl -X POST http://localhost:7071/api/chat -H "Content-Type: application/json" -d '{"question":"What ages are allowed in the Oceaneer Club?"}'
```

## Reading the logged questions later
Every question lands in a table called `ChatQuestions`, partitioned by day
(`yyyy-MM-dd`), with columns: `question`, `answer`, `sessionId`, `timestamp`.
Azure Storage Explorer (free, from Microsoft) is the simplest way to browse this
without writing a query tool.
