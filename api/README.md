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

## Community (Phase 1)

On-site sailing boards keyed by Disney ship + embarkation date:

| Route | Purpose |
| --- | --- |
| `POST /api/community/register` | Create account (email + password, scrypt hash) |
| `POST /api/community/login` | Sign in → session token |
| `GET /api/community/me` | Current user |
| `GET /api/community/sailings` | List boards |
| `POST /api/community/sailings` | Create/join a board (auth required) |
| `GET /api/community/sailings/{key}` | Board metadata + membership |
| `GET/POST /api/community/sailings/{key}/posts` | Message board (GET includes nested `replies`) |
| `PATCH/DELETE /api/community/sailings/{key}/posts/{postId}` | Edit / delete own post (delete removes replies) |
| `POST /api/community/sailings/{key}/posts/{postId}/replies` | Reply to a post (members only) |
| `PATCH/DELETE /api/community/sailings/{key}/posts/{postId}/replies/{replyId}` | Edit / delete own reply |
| `GET/POST /api/community/sailings/{key}/signups` | Fish Extender & Pixie Dust lists |
| `DELETE /api/community/sailings/{key}/signups/{type}` | Leave a gift list (`fish-extender` \| `pixie-dust`) |

Tables: `CommunityUsers`, `CommunitySessions`, `CommunitySailings`, `CommunityMembers`, `CommunityPosts`, `CommunityReplies`, `CommunitySignups`.

Requires the same `STORAGE_CONNECTION_STRING` as the rest of the API. Frontend: `/community/`.

Fish Extender sign-ups require a cabin number. Pixie Dust cabin is optional. Cabin and display name are visible to that sailing’s board viewers.

Phase 2 (not built): live chat, DMs, moderation queue, email verification, FE matchmaking pairs.

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

Tables: `AgentApplications`, `PublishedAgents`. Frontend: `/agents/apply.html`, admin review/publish at `/agents/admin.html`, dynamic profiles at `/agents/profile.html?id=…`. Sample cards remain in `assets/agents-data.js` until at least one live agent is published.

## Analytics

| Route | Purpose |
| --- | --- |
| `POST /api/events` | First-party click events (etsy / agent CTAs) |
| `GET /api/events-report?key=…&days=30` | Counts + recent events (`REPORT_ACCESS_KEY`) |

Table: `SiteEvents`. Frontend loads Clarity + click tracker via `/assets/analytics.js`. Heatmaps/recordings: https://clarity.microsoft.com

## What this does NOT do yet
- No aggregation/report of top questions — that's the natural next piece to build.
- No content moderation or per-IP rate limiting beyond a basic question-length cap.
- No admin UI for reviewing logged questions — you'd query the table directly for now
  (Azure Storage Explorer, a free desktop app, is the easiest way to browse it).

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
