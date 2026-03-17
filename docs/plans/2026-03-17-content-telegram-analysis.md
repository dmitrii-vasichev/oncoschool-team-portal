# Implementation Plan: Content Module — Telegram Analysis

**PRD:** `docs/prd-content-telegram-analysis.md`
**Created:** 2026-03-17
**Phases:** 8 (C1–C8)

---

## Architecture Decisions

### Adapting to Existing Project

| Aspect | Existing Pattern | New Module |
|--------|-----------------|------------|
| Auth | JWT + `get_current_user` / `require_moderator` / `require_admin` | New `require_content_access(role)` dependency |
| Models | SQLAlchemy 2.0, `mapped_column`, UUID PKs | Same, new models in `models.py` |
| Repositories | Class-based, `async def method(session, ...)` | Same pattern for new tables |
| Services | Stateless classes, injected session | Same; TelegramService is stateful (Pyrofork client) |
| AI | Single provider in `app_settings["ai_provider"]` | Migrated to `ai_feature_config` table, per-feature |
| Scheduling | APScheduler (ReminderService pattern) | Same for data retention cleanup |
| API | FastAPI routers, `/api/` prefix | New sub-router `/api/content/telegram/` |
| Frontend | Next.js 14 App Router, shadcn/ui | New `/content/telegram-analysis` route |
| Permissions | `PermissionService` static methods | Extended with `has_content_access(member, section, role)` |

### Encryption

- `TELEGRAM_ENCRYPTION_KEY` — env var, Fernet symmetric key
- Used for: api_id, api_hash, session_string in `telegram_session` table
- Utility: `app/utils/encryption.py` (encrypt/decrypt helpers)

### SSE Implementation

- FastAPI `StreamingResponse` with `text/event-stream` content type
- Events: `progress` (download/analysis phases), `completed`, `error`
- Frontend: native `EventSource` API
- Background task updates analysis_run status in DB; SSE endpoint reads and streams

### Channel Download Lock

- In-memory `asyncio.Lock` per channel_id (dict of locks)
- Acquired before download, released after
- If locked → return 409 Conflict with "channel is currently being downloaded"

---

## Phase C1: Database Models & Migrations

**Scope:** New SQLAlchemy models, Alembic migration, enums, encryption utility.

### Tasks

1. **Encryption utility** — `backend/app/utils/encryption.py`
   - `encrypt(plaintext: str) -> str` (Fernet, base64)
   - `decrypt(ciphertext: str) -> str`
   - Key from `settings.TELEGRAM_ENCRYPTION_KEY`

2. **Config update** — `backend/app/config.py`
   - Add `TELEGRAM_ENCRYPTION_KEY: str = ""` (required for Content module)

3. **New models** in `backend/app/db/models.py`:
   - `TelegramSession` (single-row, encrypted fields)
   - `TelegramChannel` (username, display_name)
   - `TelegramContent` (channel FK, message_id, text, content_type, message_date, loaded_at)
   - `AnalysisPrompt` (title, description, text, created_by FK → TeamMember)
   - `AnalysisRun` (channels JSONB, date range, prompt snapshot, AI info, result, status, run_by FK → TeamMember)
   - `ContentAccess` (sub_section enum, member_id FK, department_id FK, role enum, CHECK constraint)
   - `AIFeatureConfig` (feature_key unique, display_name, provider, model, updated_by FK → TeamMember)

4. **Enums:**
   - `ContentType`: post, comment
   - `AnalysisContentType`: posts, comments, all
   - `AnalysisStatus`: preparing, downloading, analyzing, completed, failed
   - `ContentSubSection`: telegram_analysis (extensible)
   - `ContentRole`: operator, editor

5. **Alembic migration** — `026_content_module_tables.py`
   - Create all 7 new tables
   - Data migration: read `app_settings["ai_provider"]` → insert into `ai_feature_config` (default + meetings_summary rows)
   - Add `ai_feature_config` row for `telegram_analysis` (null provider/model — falls back to default)
   - Indexes: `telegram_content(channel_id, message_date)`, `telegram_content(loaded_at)` for retention cleanup

6. **Repositories** — `backend/app/db/repositories.py`
   - `TelegramSessionRepository` (get, upsert)
   - `TelegramChannelRepository` (CRUD, list with content stats)
   - `TelegramContentRepository` (bulk insert, get by channel+date range, delete expired, get existing message_ids)
   - `AnalysisPromptRepository` (CRUD)
   - `AnalysisRunRepository` (create, update status, list with filters, get by id)
   - `ContentAccessRepository` (get access for member, grant, revoke, list)
   - `AIFeatureConfigRepository` (get by feature_key, get with default fallback, upsert)

### Files Created/Modified
- NEW: `backend/app/utils/__init__.py`
- NEW: `backend/app/utils/encryption.py`
- MODIFIED: `backend/app/config.py` (add TELEGRAM_ENCRYPTION_KEY)
- MODIFIED: `backend/app/db/models.py` (7 new models + enums)
- NEW: `backend/alembic/versions/026_content_module_tables.py`
- MODIFIED: `backend/app/db/repositories.py` (7 new repository classes)

### Verification
- `alembic upgrade head` — no errors
- `alembic downgrade -1` — clean rollback
- Models importable, repositories instantiable
- Migration preserves existing AI settings in new table

---

## Phase C2: AI Config Redesign + Content Access Service

**Scope:** Migrate AI settings from `app_settings` JSONB to `ai_feature_config` table. Build content access control. Update existing AIService and Settings API.

### Tasks

1. **AIFeatureConfigService** — `backend/app/services/ai_config_service.py`
   - `get_config(session, feature_key) -> AIFeatureConfig` (with default fallback)
   - `get_all_configs(session) -> list[AIFeatureConfig]`
   - `update_config(session, feature_key, provider, model, updated_by) -> AIFeatureConfig`
   - `get_provider_for_feature(session, feature_key) -> tuple[str, str]` (provider, model)

2. **Update AIService** — `backend/app/services/ai_service.py`
   - Replace `_get_current_provider(session)` to accept optional `feature_key` parameter
   - Default: reads from `ai_feature_config` table (feature_key → provider/model)
   - Fallback chain: feature-specific → "default" row → first available provider
   - Update `parse_meeting_summary()` to use `feature_key="meetings_summary"`
   - Keep backward compatibility for bot commands

3. **ContentAccessService** — `backend/app/services/content_access_service.py`
   - `has_access(session, member, sub_section) -> ContentRole | None`
     - Checks direct member_id match OR department_id match (member's department + extra_departments)
     - Returns highest role (editor > operator) or None
   - `is_editor(session, member, sub_section) -> bool`
   - `is_operator_or_editor(session, member, sub_section) -> bool`
   - `grant_access(session, sub_section, member_id?, department_id?, role) -> ContentAccess`
   - `revoke_access(session, access_id) -> None`
   - `list_access(session, sub_section?) -> list[ContentAccess]`

4. **FastAPI dependencies** — `backend/app/api/deps.py` (new file)
   - `require_content_operator(sub_section)` — returns dependency that checks operator+ access
   - `require_content_editor(sub_section)` — returns dependency that checks editor access

5. **Admin AI Config API** — `backend/app/api/admin.py` (new file)
   - `GET /api/admin/ai-config` — list all feature configs (require_admin)
   - `PUT /api/admin/ai-config/{feature_key}` — update provider/model (require_admin)

6. **Content Access Admin API** — `backend/app/api/admin.py` (same file)
   - `GET /api/admin/content-access` — list all access grants (require_admin)
   - `POST /api/admin/content-access` — grant access (require_admin)
   - `DELETE /api/admin/content-access/{id}` — revoke access (require_admin)

7. **Update existing Settings API** — `backend/app/api/settings.py`
   - `GET /api/settings/ai` — now reads from `ai_feature_config` (default row)
   - `POST /api/settings/ai` — now writes to both `ai_feature_config` (default row) AND `app_settings` (backward compat for bot)
   - Deprecation: old endpoint still works but writes to new table

8. **Update PermissionService** — `backend/app/services/permission_service.py`
   - Add `can_access_content(member) -> bool` (static, checks if member has any content access — used for sidebar visibility)

### Files Created/Modified
- NEW: `backend/app/services/ai_config_service.py`
- NEW: `backend/app/services/content_access_service.py`
- NEW: `backend/app/api/deps.py`
- NEW: `backend/app/api/admin.py`
- MODIFIED: `backend/app/services/ai_service.py` (feature_key support)
- MODIFIED: `backend/app/api/settings.py` (read/write from new table)
- MODIFIED: `backend/app/services/permission_service.py` (content access check)
- MODIFIED: `backend/app/api/router.py` (include admin router)

### Verification
- `GET /api/admin/ai-config` returns default + meetings_summary + telegram_analysis rows
- `PUT /api/admin/ai-config/meetings_summary` updates provider/model
- Existing `GET /api/settings/ai` still works (reads from new table)
- Meeting summary parsing still uses correct provider after migration
- Content access grant/revoke works, checked via dependency

---

## Phase C3: Telegram Connection Service + Admin API

**Scope:** Pyrofork integration, encrypted session management, admin connection flow.

### Tasks

1. **Add Pyrofork dependency** — `backend/pyproject.toml`
   - `pyrofork` + `tgcrypto` (for faster encryption)
   - `cryptography` (for Fernet encryption, if not already present)

2. **TelegramConnectionService** — `backend/app/services/telegram_connection_service.py`
   - Manages Pyrofork client lifecycle
   - `get_status(session) -> dict` (connected/disconnected/error, phone masked)
   - `initiate_connection(session, api_id, api_hash, phone) -> dict` (sends code, returns state)
   - `verify_code(session, code, password?) -> dict` (completes auth, saves encrypted session)
   - `disconnect(session) -> None` (terminates session, clears DB)
   - `get_client(session) -> Client | None` (returns connected Pyrofork client, reusing session)
   - Internal: encrypts api_id, api_hash, session_string before DB storage
   - Internal: in-memory client cache (singleton, lazy init from DB session string)
   - Handle: `SessionPasswordNeeded` (2FA), connection errors

3. **Admin Telegram API** — `backend/app/api/admin.py` (extend)
   - `POST /api/admin/telegram/connect` — body: {api_id, api_hash, phone} → initiates auth
   - `POST /api/admin/telegram/verify` — body: {code, password?} → completes auth
   - `GET /api/admin/telegram/status` — connection status (masked credentials)
   - `POST /api/admin/telegram/disconnect` — terminates session
   - All require_admin

4. **Startup integration** — `backend/app/main.py`
   - Initialize TelegramConnectionService on startup (attempt to restore session from DB)
   - Store in `app.state.telegram_service`
   - Graceful: if no session exists or key missing, service is available but disconnected

### Files Created/Modified
- MODIFIED: `backend/pyproject.toml` (add pyrofork, tgcrypto, cryptography)
- NEW: `backend/app/services/telegram_connection_service.py`
- MODIFIED: `backend/app/api/admin.py` (Telegram endpoints)
- MODIFIED: `backend/app/main.py` (startup init)
- MODIFIED: `backend/app/config.py` (ensure TELEGRAM_ENCRYPTION_KEY property)

### Verification
- `GET /api/admin/telegram/status` → `{"status": "disconnected"}` (no session)
- `POST /api/admin/telegram/connect` with valid credentials → sends code to phone
- `POST /api/admin/telegram/verify` with code → `{"status": "connected"}`
- Restart server → session restored from DB, status still connected
- `POST /api/admin/telegram/disconnect` → session cleared

---

## Phase C4: Channel Management + Prompt Library Backend

**Scope:** CRUD APIs for channels and prompts. Data inventory endpoint.

### Tasks

1. **Pydantic schemas** — `backend/app/api/schemas/content.py` (new)
   - `TelegramChannelCreate` (username, display_name)
   - `TelegramChannelUpdate` (display_name)
   - `TelegramChannelResponse` (id, username, display_name, created_at, content_stats?)
   - `DataInventoryResponse` (channels with date ranges, post/comment counts)
   - `AnalysisPromptCreate` (title, description?, text)
   - `AnalysisPromptUpdate` (title?, description?, text?)
   - `AnalysisPromptResponse` (id, title, description, text, created_by, created_at)

2. **Channels API** — `backend/app/api/content/channels.py` (new)
   - `GET /api/content/telegram/channels` — list with data stats (operator+)
   - `POST /api/content/telegram/channels` — add channel (editor)
   - `PUT /api/content/telegram/channels/{id}` — update (editor)
   - `DELETE /api/content/telegram/channels/{id}` — remove (editor)
   - `GET /api/content/telegram/data-inventory` — full inventory view (operator+)

3. **Channel validation** (optional, FR-16 "Should"):
   - On POST, if Telegram connected: verify channel is accessible via Pyrofork
   - If not connected: skip validation, just save

4. **Prompts API** — `backend/app/api/content/prompts.py` (new)
   - `GET /api/content/telegram/prompts` — list all prompts (operator+)
   - `POST /api/content/telegram/prompts` — create prompt (editor)
   - `PUT /api/content/telegram/prompts/{id}` — update prompt (editor)
   - `DELETE /api/content/telegram/prompts/{id}` — delete prompt (editor)

5. **Content API router** — `backend/app/api/content/__init__.py`
   - Sub-router `/api/content/telegram/` that includes channels + prompts + analysis routers
   - Register in main `api_router`

### Files Created/Modified
- NEW: `backend/app/api/schemas/content.py`
- NEW: `backend/app/api/content/__init__.py` (sub-router)
- NEW: `backend/app/api/content/channels.py`
- NEW: `backend/app/api/content/prompts.py`
- MODIFIED: `backend/app/api/router.py` (include content router)

### Verification
- CRUD operations for channels (create, list, update, delete)
- CRUD operations for prompts (create, list, update, delete)
- Data inventory returns empty (no content yet)
- Access control: operator can read, only editor can create/edit/delete
- Non-authorized users get 403

---

## Phase C5: Download + Analysis Service + Data Retention

**Scope:** Core business logic — Telegram content download, LLM analysis with chunking, SSE streaming, data retention cleanup.

### Tasks

1. **TelegramDownloadService** — `backend/app/services/telegram_download_service.py`
   - `prepare_analysis(session, channels, date_from, date_to, content_type) -> PrepareSummary`
     - Queries DB for existing content, calculates what's missing
     - Returns: per-channel breakdown (existing count, estimated missing, date gaps)
   - `download_missing(session, channels, date_from, date_to, content_type, progress_callback) -> DownloadResult`
     - Acquires per-channel locks (asyncio.Lock dict)
     - For each channel: fetch via Pyrofork, deduplicate, bulk insert
     - Calls `progress_callback(event)` for SSE updates
     - Rate limiting: configurable batch_size (100) and delay (2-5 sec)
     - FloodWaitError handling: sleep exact duration
     - Returns: total downloaded, per-channel counts

2. **AnalysisService** — `backend/app/services/analysis_service.py`
   - `run_analysis(session, run_id, channels, date_from, date_to, content_type, prompt, feature_key, progress_callback) -> str`
     - Loads content from DB
     - Estimates tokens (chars / 4 for Russian)
     - Gets model context window from `ai_providers_config`
     - Chunks if needed (reserves 30% for output)
     - Calls AIService with feature_key for each chunk
     - Synthesis call if multiple chunks
     - Updates analysis_run status at each step
     - Returns final Markdown result
   - Uses existing `AIService` with `feature_key="telegram_analysis"`

3. **Analysis API** — `backend/app/api/content/analysis.py` (new)
   - `POST /api/content/telegram/analysis/prepare` — prepare summary (operator+)
     - Body: {channel_ids, date_from, date_to, content_type}
     - Returns: preparation summary
   - `POST /api/content/telegram/analysis/run` — start analysis (operator+)
     - Body: {channel_ids, date_from, date_to, content_type, prompt_id?, prompt_text?}
     - Creates analysis_run record, starts background task
     - Returns: {run_id}
   - `GET /api/content/telegram/analysis/{id}/stream` — SSE progress (operator+)
     - StreamingResponse, text/event-stream
     - Events: `{"phase": "downloading", "channel": "...", "progress": 45}`, `{"phase": "analyzing", "chunk": 1, "total": 3}`, `{"phase": "completed", "run_id": "..."}`
   - `GET /api/content/telegram/analysis/history` — list past runs (operator+)
     - Params: page, per_page, sort
   - `GET /api/content/telegram/analysis/{id}` — full result (operator+)
   - `GET /api/content/telegram/analysis/{id}/download` — download .md (operator+)

4. **Data retention job** — extend `ReminderService` or new `ContentCleanupService`
   - APScheduler job: runs daily at 3:00 AM
   - Deletes `telegram_content` where `loaded_at < now() - 90 days`
   - Logs count of deleted records

5. **Startup** — `backend/app/main.py`
   - Register content cleanup scheduler

### Files Created/Modified
- NEW: `backend/app/services/telegram_download_service.py`
- NEW: `backend/app/services/analysis_service.py`
- NEW: `backend/app/api/content/analysis.py`
- MODIFIED: `backend/app/api/content/__init__.py` (include analysis router)
- MODIFIED: `backend/app/services/ai_service.py` (add `complete_with_feature_key` if needed)
- MODIFIED: `backend/app/main.py` (cleanup scheduler)

### Verification
- `POST /prepare` returns correct summary (empty DB → all missing)
- `POST /run` starts background task, returns run_id
- `GET /stream` delivers SSE events in real-time during download + analysis
- Analysis result saved to DB, retrievable via `GET /{id}`
- Download as `.md` works
- History endpoint returns past runs
- After 90 days (simulate), content is cleaned up
- Channel lock prevents parallel downloads of same channel (409)

---

## Phase C6: Frontend — Types, API, Permissions, Navigation

**Scope:** Frontend foundation — new types, API client methods, permission checks, sidebar navigation with "Content" section.

### Tasks

1. **Types** — `frontend/src/lib/types.ts`
   - `TelegramChannel`, `TelegramContent`, `AnalysisPrompt`, `AnalysisRun`
   - `ContentAccess`, `ContentRole`, `ContentSubSection`
   - `AIFeatureConfig`, `AIFeatureConfigResponse`
   - `DataInventory`, `PrepareSummary`, `AnalysisProgress` (SSE event types)
   - `TelegramConnectionStatus`

2. **API client** — `frontend/src/lib/api.ts`
   - Content channels: `getChannels`, `createChannel`, `updateChannel`, `deleteChannel`
   - Content prompts: `getPrompts`, `createPrompt`, `updatePrompt`, `deletePrompt`
   - Content analysis: `prepareAnalysis`, `runAnalysis`, `getAnalysisHistory`, `getAnalysisResult`, `downloadAnalysisResult`
   - Content data inventory: `getDataInventory`
   - Admin: `getTelegramStatus`, `connectTelegram`, `verifyTelegramCode`, `disconnectTelegram`
   - Admin: `getAIFeatureConfigs`, `updateAIFeatureConfig`
   - Admin: `getContentAccess`, `grantContentAccess`, `revokeContentAccess`
   - SSE helper: `streamAnalysisProgress(runId) -> EventSource`

3. **Permissions** — `frontend/src/lib/permissions.ts`
   - `canAccessContent(member) -> boolean` (has any content access)
   - Content access will be fetched separately and stored in context (not derivable from role alone)

4. **Content access hook** — `frontend/src/hooks/useContentAccess.ts`
   - Fetches current user's content access on mount
   - Provides: `hasAccess(subSection)`, `isEditor(subSection)`, `isOperator(subSection)`
   - Used by Sidebar and content pages

5. **Sidebar update** — `frontend/src/components/layout/Sidebar.tsx`
   - Add "Content" section (between "Main" and "Manage")
   - Sub-item: "Telegram Analysis" (icon: Search or MessageSquare)
   - Visible only if user has telegram_analysis access
   - Route: `/content/telegram-analysis`

6. **Content layout** — `frontend/src/app/content/layout.tsx`
   - Shared layout for content sub-sections
   - Access guard: redirect if no content access

### Files Created/Modified
- MODIFIED: `frontend/src/lib/types.ts` (new types)
- MODIFIED: `frontend/src/lib/api.ts` (new API methods)
- MODIFIED: `frontend/src/lib/permissions.ts` (content access)
- NEW: `frontend/src/hooks/useContentAccess.ts`
- MODIFIED: `frontend/src/components/layout/Sidebar.tsx` (Content section)
- NEW: `frontend/src/app/content/layout.tsx`
- NEW: `frontend/src/app/content/telegram-analysis/page.tsx` (stub)

### Verification
- Sidebar shows "Content > Telegram Analysis" only for users with access
- Users without access don't see the menu item
- Admin users see the item (they have implicit access)
- Navigation to `/content/telegram-analysis` works
- New API methods callable (return empty data)
- `npm run build` — no TypeScript errors

---

## Phase C7: Frontend — Admin Settings (Telegram Connection + AI Config + Access Control)

**Scope:** Admin settings UI — Telegram connection flow, per-feature AI configuration table, content access management.

### Tasks

1. **AI Config redesign** — `frontend/src/app/settings/page.tsx` (AIModelSection)
   - Replace current 3-card provider selector with **table layout**:
     - Rows: Default, Meetings: Summary, Telegram Analysis (+ future features)
     - Columns: Feature name | Provider (select) | Model (select, filtered by provider)
   - "Default" row highlighted as fallback
   - Feature rows can be "not set" (inherits from Default)
   - Existing `providers_config` reused for available providers/models
   - Save per-row (inline save or save-all button)

2. **Telegram Connection section** — `frontend/src/app/settings/page.tsx` (new section)
   - Admin-only section in Settings page
   - **Disconnected state:** form with api_id, api_hash, phone number + "Connect" button
   - **Code entry state:** input for verification code + optional 2FA password + "Verify" button
   - **Connected state:** masked phone, masked api_hash, status badge, "Disconnect" button
   - **Error state:** error message + "Retry" button
   - Loading states during connection/verification

3. **Content Access section** — `frontend/src/app/settings/page.tsx` (new section)
   - Admin-only section in Settings page
   - Table: sub-section | user/department | role (operator/editor) | actions (remove)
   - "Add access" dialog: select sub-section, select user OR department, select role
   - Shows team members and departments from existing data

### Files Created/Modified
- MODIFIED: `frontend/src/app/settings/page.tsx` (3 major changes: AI table, Telegram section, Access section)
- May extract into sub-components:
  - NEW: `frontend/src/components/settings/AIFeatureConfigSection.tsx`
  - NEW: `frontend/src/components/settings/TelegramConnectionSection.tsx`
  - NEW: `frontend/src/components/settings/ContentAccessSection.tsx`

### Verification
- AI config table loads with current settings (migrated from old format)
- Changing provider/model for a feature saves correctly
- "Default" row acts as fallback (shown visually)
- Telegram connection flow: enter credentials → enter code → connected
- Connection status persists after page refresh
- Disconnect clears session
- Content access: grant user operator role → user sees Content in sidebar
- Content access: revoke → menu item disappears

---

## Phase C8: Frontend — Telegram Analysis Full UI

**Scope:** The main Telegram Analysis page — channel management, prompt library, analysis flow (configure → prepare → run with SSE → result), history.

### Tasks

1. **Page structure** — `/content/telegram-analysis/page.tsx`
   - Tab layout: **Analysis** | **Channels** | **Prompts** | **History**
   - Or: single page with sections (depending on UX preference)

2. **Channels tab** — channel management
   - Table: channel username, display name, data stats (posts, comments, date range)
   - "Add channel" dialog (editor only)
   - Edit/Delete actions (editor only)
   - Data inventory view (expandable rows with date range details)

3. **Prompts tab** — prompt library
   - Card grid or list: title, description preview, created_by, created_at
   - "Create prompt" dialog with Markdown-enabled textarea (editor only)
   - Edit/Delete actions (editor only)
   - Click to view full prompt text

4. **Analysis tab** — main workflow
   - **Configuration form:**
     - Channel multi-select (from configured channels)
     - Date range picker (from–to)
     - Content type: posts / comments / both (radio/select)
     - Prompt: select from library OR write one-off (toggle)
     - One-off prompt: textarea with Markdown support
   - **"Prepare Analysis" button** → shows summary card:
     - Per-channel: existing content count, estimated to download
     - Total items for analysis
     - Warning if large download needed
   - **"Run Analysis" button** → starts analysis:
     - Progress card with SSE-driven updates
     - Download phase: channel name, messages fetched, progress bar
     - Analysis phase: "Analyzing chunk 1 of 3...", progress bar
     - Synthesis phase: "Consolidating results..."
   - **Result view:**
     - Rendered Markdown (react-markdown or similar)
     - "Download .md" button
     - "View in History" link

5. **History tab** — past analysis runs
   - Table: date, channels, period, content type, prompt title, status, run_by
   - Click to open full result (rendered Markdown)
   - Download .md button per row
   - Filters: date range, status

6. **SSE integration** — `frontend/src/hooks/useAnalysisStream.ts`
   - Custom hook wrapping EventSource
   - Returns: phase, progress, channel, result, error, isRunning
   - Auto-cleanup on unmount

### Files Created/Modified
- MODIFIED: `frontend/src/app/content/telegram-analysis/page.tsx` (full implementation)
- NEW: `frontend/src/components/content/ChannelsTab.tsx`
- NEW: `frontend/src/components/content/PromptsTab.tsx`
- NEW: `frontend/src/components/content/AnalysisTab.tsx`
- NEW: `frontend/src/components/content/HistoryTab.tsx`
- NEW: `frontend/src/components/content/AnalysisProgress.tsx`
- NEW: `frontend/src/components/content/AnalysisResult.tsx`
- NEW: `frontend/src/hooks/useAnalysisStream.ts`
- MODIFIED: `frontend/package.json` (add react-markdown, remark-gfm if not present)

### Verification
- Channels CRUD works (editor can add/edit/delete, operator can only view)
- Prompts CRUD works (editor can create/edit/delete, operator can browse/select)
- Analysis flow: configure → prepare → see summary → run → see real-time progress → see result
- SSE progress updates appear in real-time
- Result renders as formatted Markdown
- Download .md produces valid file
- History lists all past runs
- Can re-open past result from history
- Channel lock: if another analysis is downloading same channel → clear error message

---

## Phase Dependencies

```
C1 (DB) ──→ C2 (AI Config + Access) ──→ C3 (Telegram Connection) ──→ C4 (Channels + Prompts)
                                                                          │
                                                                          ▼
C6 (Frontend Foundation) ◄── depends on C2 ──────────────────────→ C5 (Download + Analysis)
      │                                                                   │
      ▼                                                                   │
C7 (Admin Settings UI) ◄── depends on C3                                  │
      │                                                                   │
      ▼                                                                   ▼
C8 (Telegram Analysis UI) ◄── depends on C4, C5, C6, C7
```

**Recommended execution order:** C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8

---

## New Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_ENCRYPTION_KEY` | Yes (for Content module) | Fernet key for encrypting Telegram credentials. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

---

## New Dependencies

| Package | Purpose |
|---------|---------|
| `pyrofork` | Telegram MTProto client (userbot) |
| `tgcrypto` | Fast encryption for Pyrofork |
| `cryptography` | Fernet encryption for credentials |
| `react-markdown` (frontend) | Render Markdown analysis results |
| `remark-gfm` (frontend) | GitHub Flavored Markdown support |
