# PRD: Content Module — Telegram Analysis

**Status:** Approved (2026-03-17)
**Author:** Dmitrii Vasichev
**Created:** 2026-03-17
**Last Updated:** 2026-03-17
**Portal:** Task Manager Oncoschool

---

## 1. Overview

The Content module is a new top-level section in the Task Manager Oncoschool portal. It serves as a container for content-related tooling used by the project team.

The first sub-module — **Telegram Analysis** — enables the team to extract posts and comments from public Telegram channels via a userbot (Pyrofork), store them locally, and run LLM-powered analysis using configurable prompts. The primary use case is audience research: identifying pain points, needs, objections, and behavioral patterns from patient community discussions to inform marketing, product, and content strategy.

The module is designed for internal use by 2–3 team members, with role-based access control and a single shared Telegram account managed by an admin.

---

## 2. Problem Statement

The Oncoschool project regularly needs to analyze discussions in Telegram channels — patient communities, doctor channels, and the project's own channel — to understand the audience's pain points, needs, and objections. Today this is done manually (copy-paste into ChatGPT), which is:

- **Time-consuming:** manually collecting comments from ~10 channels across different time periods.
- **Non-repeatable:** no stored data, so every new analysis starts from scratch.
- **Non-scalable:** can't easily re-run analysis with a different prompt or compare periods.
- **Ad-hoc:** no history of past analyses, no shared access for the team.

The Content module solves this by providing a permanent, integrated toolset within the existing portal.

---

## 3. Goals & Non-Goals

### Goals

- Enable team members to extract text content (posts and/or comments) from a configured list of public Telegram channels for a specified date range.
- Provide incremental loading: avoid re-downloading content that already exists in the database.
- Offer a prompt library for reusable analysis templates, plus the ability to write one-off prompts.
- Run LLM-based analysis with per-feature AI provider/model configuration and present results as rendered Markdown with download option.
- Maintain a full history of analysis runs for reference and auditing.
- Protect the connected Telegram account from ban through rate limiting and safe usage patterns.
- Secure Telegram session data with encryption and server-side storage.

### Non-Goals

- Automated/scheduled parsing (cron-based extraction).
- Comparison or diffing between analysis reports across different periods.
- Dashboard or aggregated metrics on extracted content.
- Media content extraction (images, videos, documents) — text only.
- External user access — internal team only.
- Real-time monitoring of channels.

---

## 4. User Stories

### Access & Navigation

- **US-1:** As a team member without Content access, I do not see the "Content" menu item at all.
- **US-2:** As a team member with access to "Telegram Analysis", I see "Content" in the main navigation, and inside it — the "Telegram Analysis" sub-section.
- **US-3:** As an admin, I can grant access to sub-sections of Content per user or per department, and assign either "operator" or "editor" role within each sub-section.

### Telegram Connection (Admin)

- **US-4:** As an admin, I can configure the Telegram userbot connection (api_id, api_hash, phone number) in the portal settings and complete the authorization flow (code/2FA).
- **US-5:** As an admin, I can see the current connection status (connected / disconnected / error) without being able to copy session data.

### Channel Management (Editor)

- **US-6:** As an editor, I can add, edit, and remove Telegram channels from the monitored list.
- **US-7:** As an editor or operator, I can view the data inventory: which channels have data loaded, for which periods, and how many posts/comments are stored.

### Prompt Library

- **US-8:** As an editor, I can create, edit, and delete saved prompts in the prompt library.
- **US-9:** As an operator, I can browse and select prompts from the library when configuring an analysis run.
- **US-10:** As an operator or editor, I can write a one-off prompt without saving it to the library.

### Analysis Flow

- **US-11:** As an operator or editor, I can configure an analysis run: select channels, date range (from–to), content type (posts / comments / both), and a prompt.
- **US-12:** When I click "Prepare Analysis", I see a summary: total content available, how much is already in the database, how much needs to be downloaded.
- **US-13:** When I click "Run Analysis", the system downloads missing content (with safe rate limiting) and then runs the LLM analysis.
- **US-14:** I see a progress indicator during both the download and analysis phases.
- **US-15:** When analysis is complete, I see the result rendered as Markdown in the portal interface.
- **US-16:** I can download the analysis result as a `.md` file.

### History

- **US-17:** As an operator or editor, I can view a history of all past analysis runs, including: date, channels, period, content type, prompt used, and the result.
- **US-18:** I can re-open and re-read any past analysis result.

---

## 5. Detailed Requirements

### 5.1 Functional Requirements

#### 5.1.1 Navigation & Access Control

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | "Content" appears as a top-level menu item, visible only to users with access to at least one sub-section. | Must |
| FR-2 | Content is a container for sub-sections. First sub-section: "Telegram Analysis". | Must |
| FR-3 | Access to each sub-section is granted per user or per department by an admin. | Must |
| FR-4 | Each sub-section has two roles: **operator** (run analysis, use existing prompts) and **editor** (all operator permissions + manage prompts + manage channel list). | Must |
| FR-5 | The access model is extensible: future sub-sections within Content follow the same operator/editor pattern. | Should |

#### 5.1.2 Telegram Connection (Admin Settings)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6 | Admin settings include a "Telegram Connection" section for configuring the userbot. | Must |
| FR-7 | Configuration fields entered via admin UI: api_id, api_hash, phone number. No environment variables required — the admin configures everything through the portal interface. | Must |
| FR-8 | Authorization flow: admin enters api_id + api_hash + phone → system initiates Pyrofork login → admin enters the code received in Telegram (and 2FA password if enabled) → session established. | Must |
| FR-9 | Session is persisted as an encrypted StringSession in the database (not as a file). This ensures persistence across Railway redeploys. Re-authorization is not required on every use. | Must |
| FR-10 | Admin can see connection status: connected / disconnected / error (with error details). | Must |
| FR-11 | Admin can disconnect and re-connect (e.g., to change account or update api_id/api_hash). | Should |
| FR-12 | api_id, api_hash, and session string are stored encrypted in the database. They are never exposed as plaintext in logs, API responses, or UI (after initial entry). | Must |
| FR-13 | On the admin UI, after connection is established: api_hash is masked (e.g., `••••••ab3f`), phone is partially masked (e.g., `+7•••••1234`). Session data is never transmitted to the client. | Must |

#### 5.1.3 Channel Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | Editors can manage a list of monitored Telegram channels (add / edit / remove). | Must |
| FR-15 | Channel entry: channel username or link + display name. | Must |
| FR-16 | System validates that the channel is accessible by the connected userbot account. | Should |
| FR-17 | Data inventory view: table showing each channel, loaded date ranges, and post/comment counts. | Must |

#### 5.1.4 Prompt Library

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-18 | Editors can create, edit, and delete prompts. | Must |
| FR-19 | Prompt fields: title, description (optional), prompt text (Markdown-enabled). | Must |
| FR-20 | Operators can browse and select prompts from the library. | Must |
| FR-21 | Any user (operator or editor) can write a one-off prompt in the analysis configuration without saving it. | Must |

#### 5.1.5 Analysis Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-22 | Analysis configuration form: select channels (multi-select), date range (from–to), content type (posts / comments / both), prompt (from library or one-off). | Must |
| FR-23 | "Prepare Analysis" button: system checks the database, calculates what data exists and what needs to be downloaded, and shows a summary. | Must |
| FR-24 | Summary includes: total items for analysis, items already in DB, items to be downloaded, breakdown by channel. | Must |
| FR-25 | "Run Analysis" button: system downloads missing content via Pyrofork, then sends data to LLM for analysis. | Must |
| FR-25a | Only one download operation per channel is allowed at a time. If another analysis run requires the same channel, it waits or fails with a clear message. This prevents excessive Telegram API load and deduplication conflicts. | Must |
| FR-26 | Real-time progress indicator via Server-Sent Events (SSE) for both download and analysis phases. | Must |
| FR-27 | Analysis result is rendered as Markdown in the portal UI. | Must |
| FR-28 | Download button exports the result as a `.md` file. | Must |

#### 5.1.6 Incremental Loading & Deduplication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Each post/comment is stored with: channel_id, telegram_message_id, message_date, content_type (post/comment), text, loaded_at timestamp. | Must |
| FR-30 | Uniqueness constraint: channel_id + telegram_message_id. No duplicates. | Must |
| FR-31 | On download, the system checks which message_ids already exist for the requested channel and date range, and only fetches missing ones. | Must |
| FR-32 | For partially overlapping periods (e.g., DB has Jan–Mar, request is Feb–Apr), only the non-overlapping portion (Apr) is fetched. | Must |

#### 5.1.7 Chunking & Synthesis

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-33 | If the total content exceeds the context window of the selected LLM provider/model, the system automatically splits the content into chunks. | Must |
| FR-34 | Each chunk is analyzed separately with the same prompt. | Must |
| FR-35 | After all chunks are processed, the system makes a final LLM call to synthesize intermediate results into one consolidated report. | Must |
| FR-36 | The user receives a single final report — intermediate chunk results are not exposed. | Must |

#### 5.1.8 History

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-37 | All analysis runs are saved with: timestamp, channels, date range, content type, prompt (snapshot), AI provider/model used, result (Markdown), user who ran it. | Must |
| FR-38 | History view: sortable/filterable list of past runs. | Must |
| FR-39 | User can open any past run to view the full result. | Must |
| FR-40 | User can re-download the result as `.md` from history. | Should |

#### 5.1.9 AI Provider Configuration (Admin Settings — Portal-Wide Change)

This requirement extends beyond the Content module — it is a portal-wide settings redesign that replaces the current single-provider selection.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-41 | Replace the current single AI provider/model selector in admin settings with a **table-based configuration** where each row represents a portal feature and columns are provider + model. | Must |
| FR-42 | Initial feature rows: "Meetings: Summary" (existing), "Telegram Analysis" (new). New features are added to the table as the portal evolves. | Must |
| FR-43 | A **"Default"** row at the bottom of the table sets the provider/model for any feature that has not been explicitly configured. | Must |
| FR-44 | Each row allows selecting: provider (Anthropic / OpenAI / Gemini) and model (list dynamically filtered by selected provider). | Must |
| FR-45 | The existing Meetings summary functionality must be migrated to the new per-feature format. Current setting becomes the value for the "Meetings: Summary" row and the "Default" row, preserving backward compatibility. | Must |
| FR-46 | When running Telegram Analysis, the system uses the provider/model configured for the "Telegram Analysis" row. If not explicitly set, falls back to "Default". | Must |
| FR-47 | The chunking strategy (section 6.4) must respect the context window size of the specific model selected for the feature, not a hardcoded value. | Must |

#### 5.1.10 Data Retention

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-48 | Raw content (posts/comments) is automatically deleted 90 days after the **loaded_at** date (the date when data was imported into the system), regardless of when the content was originally posted in Telegram. | Must |
| FR-49 | This means: content loaded today is guaranteed to be available for 90 days for re-analysis with different prompts. Content that was originally posted 2 years ago in Telegram but loaded today still gets the full 90-day window. | Must |
| FR-50 | Analysis results (in history) are NOT subject to auto-deletion — they are retained indefinitely. | Must |
| FR-51 | Cleanup runs as a background job (e.g., daily via APScheduler, consistent with the portal's existing job infrastructure). | Should |

### 5.2 Non-Functional Requirements

#### 5.2.1 Telegram Account Protection

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | Configurable delay between API requests to different channels (default: 2–5 seconds). | Must |
| NFR-2 | Large first-time downloads (e.g., 3 months of history) must be split into smaller batches with pauses between them. | Must |
| NFR-3 | FloodWaitError handling: if Telegram returns a flood wait, the system pauses for the exact requested duration before retrying. No aggressive retries. | Must |
| NFR-4 | Session reuse: the system maintains a persistent session and does not create a new one on each operation. | Must |
| NFR-5 | Configurable rate limits for download speed (requests per minute / messages per batch), adjustable in admin settings. | Should |
| NFR-6 | Logging of all Telegram API interactions for debugging ban-related issues. | Should |

#### 5.2.2 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-7 | Telegram session stored as encrypted StringSession in the database (not as a file), ensuring persistence across container redeploys. | Must |
| NFR-8 | api_id, api_hash, and session string stored encrypted at rest in the database. Encryption key stored as environment variable (TELEGRAM_ENCRYPTION_KEY). | Must |
| NFR-9 | Session data is not accessible or downloadable through the admin UI. Admin sees only connection status. | Must |
| NFR-10 | Access control enforced on both frontend (UI visibility) and backend (API authorization). | Must |

#### 5.2.3 Performance

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-11 | Analysis of up to 500 comments should complete within 3 minutes (excluding download time). | Should |
| NFR-12 | The UI must remain responsive during long-running operations (download + analysis), with progress feedback. | Must |
| NFR-13 | Chunking strategy should maximize context utilization per LLM call while staying within token limits. | Should |

---

## 6. Technical Architecture

### 6.1 Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui | Consistent with existing portal |
| Backend | FastAPI, SQLAlchemy 2.0 async, Alembic | Consistent with existing portal |
| Database | PostgreSQL (Supabase) | Existing instance, new tables |
| Telegram | Pyrofork (active Pyrogram fork) | Userbot, MTProto API, StringSession in DB |
| AI | Multi-provider (Anthropic / OpenAI / Gemini) | Per-feature provider/model configuration (see FR-41–FR-47) |
| Deployment | Vercel (frontend) + Railway (backend) | Existing infrastructure |

### 6.2 Why Pyrofork

Evaluated options as of March 2026:

- **Telethon v1 (1.42.0):** GitHub repository archived Feb 21, 2026. Moved to Codeberg. Maintenance-only mode (layer updates and critical bugs). No new features. Functional but declining.
- **Telethon v2 (2.0.0a0):** Alpha, breaking changes from v1, not recommended for production.
- **Pyrogram (original):** Officially discontinued, marked inactive.
- **Pyrofork (v2.3.69, Dec 2025):** Actively maintained Pyrogram fork with fresh releases, new Telegram feature support, clean async API, type hints. Best balance of active development and API stability.

Fallback: if Pyrofork development stalls, migration to Telethon v1 is straightforward — both use the same MTProto protocol and similar abstractions.

### 6.3 New Database Tables

```
telegram_channels
├── id (PK)
├── username (unique)
├── display_name
├── created_at
└── updated_at

telegram_content
├── id (PK)
├── channel_id (FK → telegram_channels)
├── telegram_message_id
├── content_type (enum: post | comment)
├── text
├── message_date (original date in Telegram)
├── loaded_at (date imported into system)
├── UNIQUE(channel_id, telegram_message_id)
└── INDEX(channel_id, message_date)

telegram_session (single-row table for encrypted credentials and session)
├── id (PK, always 1)
├── api_id_encrypted (text — encrypted api_id)
├── api_hash_encrypted (text — encrypted api_hash)
├── phone_number (string — stored partially masked for display, e.g., +7•••••1234)
├── session_string_encrypted (text — encrypted Pyrofork StringSession)
├── status (enum: connected | disconnected | error)
├── error_message (nullable)
├── connected_at
└── updated_at

analysis_prompts
├── id (PK)
├── title
├── description (nullable)
├── text
├── created_by (FK → team_members)
├── created_at
└── updated_at

analysis_runs
├── id (PK)
├── channels (JSONB — list of channel IDs)
├── date_from
├── date_to
├── content_type (enum: posts | comments | all)
├── prompt_id (FK → analysis_prompts, nullable — null for one-off)
├── prompt_snapshot (text — frozen copy of prompt at run time)
├── ai_provider (string — provider used for this run)
├── ai_model (string — model used for this run)
├── result_markdown (text)
├── status (enum: preparing | downloading | analyzing | completed | failed)
├── error_message (nullable)
├── run_by (FK → team_members)
├── created_at
└── completed_at

content_access
├── id (PK)
├── sub_section (enum — e.g., telegram_analysis)
├── member_id (FK → team_members, nullable)
├── department_id (FK → departments, nullable)
├── role (enum: operator | editor)
├── CHECK(member_id IS NOT NULL OR department_id IS NOT NULL)
└── created_at

ai_feature_config (portal-wide, replaces existing single-provider setting)
├── id (PK)
├── feature_key (unique, e.g., 'default', 'meetings_summary', 'telegram_analysis')
├── display_name (e.g., 'Meetings: Summary', 'Telegram Analysis')
├── provider (enum: anthropic | openai | gemini)
├── model (string — e.g., 'claude-sonnet-4-20250514', 'gpt-4o')
├── updated_by (FK → team_members)
└── updated_at

Migration note: existing single-provider setting is migrated into two rows:
  - feature_key='default' (same provider/model as before)
  - feature_key='meetings_summary' (same provider/model as before)
New row added: feature_key='telegram_analysis' (initially null — falls back to default)
```

### 6.4 Chunking Strategy

1. Calculate total token count of selected content (rough estimate: 1 token ≈ 4 characters for Russian text).
2. Reserve tokens for: system prompt + user prompt + expected output (configurable margin, e.g., 30% of context window for output).
3. Split content into chunks that fit within the remaining context budget.
4. Each chunk is processed independently with the full prompt.
5. Intermediate results are collected and passed to a final synthesis call with a meta-prompt: "Consolidate these partial analysis results into a single coherent report following the same structure."
6. Final consolidated report is returned to the user.

### 6.5 Telegram Download Flow

```
User clicks "Prepare Analysis"
  │
  ├─ Query DB: what content exists for selected channels + date range
  ├─ Calculate: what's missing
  ├─ Return summary to UI
  │
User clicks "Run Analysis"
  │
  ├─ POST /analysis/run → creates analysis_run record (status=preparing), returns run ID
  ├─ Client connects to GET /analysis/{id}/stream (SSE)
  ├─ Background task starts:
  │   │
  │   ├─ Acquire per-channel download lock (if locked → fail with "channel busy" message)
  │   ├─ For each channel with missing data:
  │   │   ├─ Connect via Pyrofork (reuse encrypted StringSession from DB)
  │   │   ├─ Fetch messages for missing date ranges
  │   │   │   ├─ Batch size: configurable (default 100 per request)
  │   │   │   ├─ Delay between batches: configurable (default 2–5 sec)
  │   │   │   ├─ On FloodWaitError: sleep for requested duration
  │   │   │   └─ Filter: text-only (skip media-only messages)
  │   │   ├─ Deduplicate against DB (by telegram_message_id)
  │   │   ├─ Insert new content with loaded_at = now()
  │   │   ├─ SSE event: download progress (channel, messages fetched, total estimated)
  │   │   └─ Pause before next channel (configurable delay)
  │   ├─ Release channel locks
  │   │
  │   ├─ Collect all content from DB for the full requested range
  │   ├─ Chunk if needed (see 6.4)
  │   ├─ SSE event: analysis started (chunk N of M)
  │   ├─ Send to LLM via existing multi-provider infrastructure
  │   ├─ Synthesize if chunked
  │   ├─ Save result to analysis_runs
  │   └─ SSE event: completed (with result or result ID)
  │
  └─ Client renders Markdown result
```

---

## 7. API Design

### 7.1 Key Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/content/telegram/channels` | operator, editor | List configured channels with data inventory |
| POST | `/api/content/telegram/channels` | editor | Add a channel |
| PUT | `/api/content/telegram/channels/{id}` | editor | Update channel |
| DELETE | `/api/content/telegram/channels/{id}` | editor | Remove channel |
| GET | `/api/content/telegram/prompts` | operator, editor | List prompts |
| POST | `/api/content/telegram/prompts` | editor | Create prompt |
| PUT | `/api/content/telegram/prompts/{id}` | editor | Update prompt |
| DELETE | `/api/content/telegram/prompts/{id}` | editor | Delete prompt |
| POST | `/api/content/telegram/analysis/prepare` | operator, editor | Calculate data availability, return summary |
| POST | `/api/content/telegram/analysis/run` | operator, editor | Execute download + analysis, returns run ID |
| GET | `/api/content/telegram/analysis/{id}/stream` | operator, editor | SSE endpoint — real-time progress updates |
| GET | `/api/content/telegram/analysis/history` | operator, editor | List past analysis runs |
| GET | `/api/content/telegram/analysis/{id}` | operator, editor | Get full analysis result |
| GET | `/api/content/telegram/analysis/{id}/download` | operator, editor | Download result as .md |
| GET | `/api/content/telegram/data-inventory` | operator, editor | Channels × date ranges × counts |
| POST | `/api/admin/telegram/connect` | admin | Initiate Telegram authorization |
| POST | `/api/admin/telegram/verify` | admin | Submit auth code / 2FA |
| GET | `/api/admin/telegram/status` | admin | Connection status |
| POST | `/api/admin/telegram/disconnect` | admin | Terminate session |
| GET | `/api/admin/ai-config` | admin | List all feature → provider/model mappings |
| PUT | `/api/admin/ai-config/{feature_key}` | admin | Update provider/model for a specific feature |

---

## 8. Out of Scope

- Automated/scheduled parsing (cron-based channel monitoring).
- Comparison or diffing between reports from different analysis runs.
- Dashboard with aggregated metrics on extracted content.
- Media content (images, videos, voice messages, documents) — text only.
- External user access — the Content module is strictly internal.
- Real-time channel monitoring or streaming updates.
- Multiple simultaneous Telegram accounts.

---

## 9. Risks & Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Telegram account ban | High — blocks all data extraction, affects personal account | Rate limiting, delays, FloodWait handling, session reuse, batch downloads. Consider a dedicated phone number in the future. |
| Pyrofork project abandonment | Medium — no library updates for new Telegram API changes | Fallback to Telethon v1 (Codeberg). Core functionality (reading channels) is stable MTProto and unlikely to break. |
| LLM token limits for large datasets | Medium — analysis quality degrades with too many chunks | Chunking + synthesis strategy. Allow user to narrow date range or channel selection. |
| Session & credentials security | High — leaked session or api_hash = full account access | All credentials (api_id, api_hash, session string) encrypted in DB with server-side encryption key (env var). Never exposed via API/UI after initial entry. |

### Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Should we consider a dedicated (non-personal) Telegram account to isolate ban risk? | Deferred — using personal account for now |
| OQ-2 | What is the optimal default batch size and delay for Telegram downloads? May need tuning after initial testing. | To be determined during implementation |
| OQ-3 | Should analysis results be searchable (full-text search across history)? | Deferred — not in scope for initial release |
| OQ-4 | Token estimation for Russian text — need to validate the 1:4 char-to-token ratio against actual provider tokenizers. | To be validated |
