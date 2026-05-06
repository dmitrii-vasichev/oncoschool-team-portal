# PRD: VK ID OAuth — Portal Authentication

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-04 |
| Status | Draft |
| Priority | P0 |
| Discovery | `docs/discovery-2026-04-04-vk-migration.md` |

## Problem Statement

~70% of the team is Russia-based and experiences unreliable Telegram service: push notifications fail, VPN is required for auth, overall UX is degraded. The web portal currently only supports Telegram-based authentication (Widget, WebApp, web-login via bot). Users who can't reliably access Telegram are effectively locked out of the portal.

Adding VK ID OAuth gives these users a native, VPN-free login path while keeping all existing Telegram auth methods for the 30% abroad.

## User Scenarios

### Scenario 1: Russia-based team member logs into portal
**As a** team member in Russia, **I want to** log in via my VK account, **so that** I can access the task manager without VPN or Telegram workarounds.

### Scenario 2: Admin pre-links VK accounts
**As an** admin, **I want to** associate a VK ID with existing team members, **so that** they can log in via VK from day one without manual account linking.

### Scenario 3: Existing user continues with Telegram
**As a** team member abroad, **I want to** keep logging in via Telegram, **so that** nothing changes for me.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: **DB migration** — add `vk_id: BigInteger (unique, nullable)` to `team_members` table
- [ ] FR-2: **Backend OAuth endpoint** — `POST /api/auth/vk` accepts VK ID OAuth 2.1 authorization code, exchanges for access token via VK API, extracts `user_id`, looks up TeamMember by `vk_id`, issues JWT
- [ ] FR-3: **VK user info sync** — on VK login, update `full_name` and `avatar_url` from VK profile (only if not already set)
- [ ] FR-4: **Frontend VK login button** — login page shows "Войти через VK ID" button using @vkid/sdk OneTap widget
- [ ] FR-5: **Auth method selection** — login page presents both Telegram and VK options; user chooses one
- [ ] FR-6: **JWT parity** — VK login issues the same JWT format as Telegram login (sub=member_id), no downstream changes needed
- [ ] FR-7: **Config endpoint update** — `GET /api/auth/config` returns `vk_app_id` and `vk_enabled: true/false` so frontend knows whether to show VK button

### P1 (Should Have)

- [ ] FR-8: **Admin VK linking** — `PATCH /api/team/{id}` accepts `vk_id` field so admin can pre-link VK accounts to existing members
- [ ] FR-9: **Frontend types & API client** — update `TeamMember` type and `ApiClient` with VK-related fields and methods
- [ ] FR-10: **Team page VK column** — show VK ID status in team management table (linked / not linked)

## Non-Functional Requirements

- **Security:** VK OAuth code exchange MUST happen server-side (never expose client_secret to frontend). Validate `state` parameter to prevent CSRF.
- **Backward compatibility:** All existing Telegram auth flows remain untouched. Zero changes to JWT payload format or downstream API behavior.
- **Error handling:** Clear error messages for: VK account not linked to any team member (403), VK account linked to inactive member (403), VK OAuth failure (502).

## Technical Design

### Stack Additions
- **Backend:** `httpx` (already in deps) for VK API calls, no new libraries needed
- **Frontend:** `@vkid/sdk ^2.6.0` — official VK ID SDK
- **DB:** Alembic migration for `vk_id` column

### Auth Flow

```
Frontend                    Backend                     VK API
   │                          │                           │
   │ 1. User clicks VK btn    │                           │
   │ ──── @vkid/sdk ────────► │                           │
   │      redirect to VK      │                           │
   │                          │                           │
   │ 2. VK redirects back     │                           │
   │    with auth code         │                           │
   │ ──── POST /api/auth/vk ─►│                           │
   │    { code, redirect_uri, │                           │
   │      code_verifier,      │                           │
   │      device_id, state }  │                           │
   │                          │ 3. Exchange code           │
   │                          │ ─── POST oauth.vk.com ───►│
   │                          │     /access_token          │
   │                          │                           │
   │                          │ 4. Get user_id from token  │
   │                          │◄──────────────────────────│
   │                          │                           │
   │                          │ 5. Lookup TeamMember       │
   │                          │    by vk_id                │
   │                          │                           │
   │ 6. JWT token             │                           │
   │◄─────────────────────────│                           │
```

### VK ID OAuth 2.1 with PKCE
- VK ID uses OAuth 2.1 with PKCE (code_verifier/code_challenge)
- Frontend generates PKCE pair via @vkid/sdk
- Backend receives `code` + `code_verifier` + `device_id` + `state`
- Backend exchanges at `https://id.vk.com/oauth2/auth` (token endpoint)
- Response contains `access_token` + `user_id`

### Backend Endpoint: `POST /api/auth/vk`

**Request body:**
```python
class VKAuthRequest(BaseModel):
    code: str                # Authorization code from VK
    device_id: str           # Device ID from @vkid/sdk
    code_verifier: str       # PKCE code verifier
    state: str               # CSRF state parameter
    redirect_uri: str        # Must match registered redirect URI
```

**Response:** same `LoginResponse` as Telegram auth (`access_token`, `member_id`, `role`)

### Config Settings
```python
# config.py additions
VK_APP_ID: int = 0           # VK ID app ID
VK_APP_SECRET: str = ""      # VK ID app secret (secure token)
VK_REDIRECT_URI: str = ""    # OAuth redirect URI
VK_ENABLED: bool = False     # Feature flag
```

### DB Changes
```sql
ALTER TABLE team_members ADD COLUMN vk_id BIGINT UNIQUE;
CREATE INDEX ix_team_members_vk_id ON team_members (vk_id);
```

### Repository Addition
```python
# TeamMemberRepository
async def get_by_vk_id(session, vk_id: int) -> TeamMember | None
```

## Implementation Phases

- **Phase A: Backend** — migration, config, OAuth endpoint, repository method, tests
- **Phase B: Frontend** — @vkid/sdk setup, login page update, types, API client
- **Phase C: Admin** — team page VK column, PATCH endpoint for vk_id linking

## Out of Scope

- VK bot notifications (Phase 2 of VK migration)
- VK bot commands (Phase 3)
- Self-service VK account linking by regular users (could add later)
- VK avatar download/caching (use URL directly)
- Telegram → VK account migration tool

## Acceptance Criteria

- [ ] AC-1: User with `vk_id` set can log into portal via VK button — gets JWT, sees dashboard
- [ ] AC-2: User without `vk_id` sees 403 "VK account not linked" error
- [ ] AC-3: All existing Telegram auth methods still work unchanged
- [ ] AC-4: Admin can set `vk_id` for team members via API
- [ ] AC-5: `GET /api/auth/config` returns `vk_app_id` and `vk_enabled` flag
- [ ] AC-6: VK button hidden when `vk_enabled=false`
- [ ] AC-7: Build and lint pass, no regressions

## Risks & Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | VK ID app registration — need `client_id` and `client_secret` from VK developer console | Blocker for testing — can use dev-login mock until registered |
| 2 | Redirect URI — what domain? Production portal URL needed | Config-driven, can be changed per environment |
| 3 | PKCE flow details — @vkid/sdk handles code_challenge generation, backend just needs code_verifier | Low risk, well-documented |
| 4 | VK rate limits for token exchange | Negligible — one call per login |
