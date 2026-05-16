# Content Factory Sprint 46 VK Publisher Design

## Goal

Sprint 46 adds the second practical Content Factory publishing integration: text publishing to VK through the existing platform-neutral publishing queue.

Sprint 45 proved the queue/scheduler pattern with Telegram. Sprint 46 should reuse that foundation and add VK without changing how operators plan, approve, enqueue, retry, or inspect publication attempts.

## Context

The Content Factory platform seed already contains VK as a platform with `can_api_publish=true`. The help page also names VK as the next practical integration after Telegram. The queue foundation supports durable queued jobs, retry, manual fallback, and audit events; the scheduler currently delegates all real posting to a Telegram-specific service.

VK publishing has different credentials, target addressing, and response shape than Telegram, so the work should introduce a small provider boundary instead of forcing the scheduler to know platform-specific details.

## Scope

In scope:

- VK text-only publisher for Content Factory publications with `platform.code == "vk"`.
- Provider routing in `ContentFactoryPublishingSchedulerService` for `telegram` and `vk`.
- VK API configuration through backend environment settings.
- Current VK channel adaptation lookup with fallback to the publication body.
- Safe queue failure for missing VK configuration, wrong platform, unsupported media, empty text, and VK API errors.
- Provider response evidence with VK owner id, post id, best-effort post URL, and raw safe response metadata.
- Existing frontend queue action continues to work for queued VK publications without adding a separate VK button.
- Durable docs, tests, and manual QA checklist.

Out of scope:

- VK media attachments.
- VK scheduled posting via VK's own postponed posts; scheduling remains controlled by the Content Factory queue.
- OAuth/token management UI.
- Multiple VK targets per publication with a database table.
- VK metrics collection.
- Editing or deleting VK posts after publication.

## Configuration

Add these backend settings:

- `VK_API_ACCESS_TOKEN: str = ""`
- `VK_API_VERSION: str = "5.199"`
- `VK_OWNER_ID: str = ""`, parsed to `int | None` by the VK publisher
- `VK_FROM_GROUP: bool = True`

The first implementation uses a single configured VK destination because the team needs one working publishing path before target management becomes useful. For group/community posting, `VK_OWNER_ID` is expected to be the VK wall owner id used by `wall.post`; community walls normally use a negative owner id. `VK_FROM_GROUP` is sent as `1` when enabled.

If any required value is missing, the queue attempt fails with a readable configuration message and remains retryable according to existing queue rules.

## Provider Boundary

Introduce `ContentFactoryPublisherError` as a platform-neutral publishing error for queue processing. Telegram errors should become or subclass this common error so the scheduler can handle Telegram and VK uniformly.

Introduce a small provider router:

- Load the publication and platform once.
- If platform code is `telegram`, delegate to the existing `TelegramPublisherService`.
- If platform code is `vk`, delegate to the new `VKPublisherService`.
- Otherwise fail with a readable unsupported-platform message.

This keeps the scheduler responsible for queue lifecycle and keeps providers responsible for platform rules.

## VK Publisher

`VKPublisherService` is responsible for:

1. Validating configuration.
2. Loading the current VK publication variant where `channel == "vk"` and `source_version_number == publication.version_number`.
3. Building a VK text message from the variant, or from the publication title/body when no current variant exists.
4. Rejecting empty messages.
5. Rejecting non-empty `media_refs`.
6. Calling VK API `wall.post`.
7. Translating VK success/error responses into provider evidence or `ContentFactoryPublisherError`.

Message formatting should be plain text. Unlike Telegram, VK text should not be HTML-escaped or wrapped in HTML tags.

The VK API call should use `httpx.AsyncClient` and send a POST request to:

`https://api.vk.com/method/wall.post`

Expected request fields:

- `owner_id`
- `from_group`
- `message`
- `access_token`
- `v`

Expected successful response shape:

```json
{"response": {"post_id": 123}}
```

Expected error response shape:

```json
{"error": {"error_code": 15, "error_msg": "Access denied"}}
```

The service should store safe response evidence, not the access token.

## Post URL

Build a best-effort VK post URL:

```text
https://vk.com/wall{owner_id}_{post_id}
```

The URL is valid for standard VK wall post identifiers. If VK changes the response or omits `post_id`, the queue should fail instead of marking the publication as published without a stable post id.

## Queue And Publication State

The queue lifecycle remains unchanged:

- `queued` due item becomes `processing`.
- Provider success marks the queue item `succeeded`, stores provider response, and updates publication fact fields.
- Provider failure marks the queue item according to existing retry rules.

On VK success:

- `publication.status = "published"`
- `publication.actual_published_at = now`
- `publication.platform_post_id = str(post_id)`
- `publication.platform_post_url = best_effort_url`

The queue remains the durable audit trail for automatic publication attempts.

## Frontend

No new page or button is needed in Sprint 46. The existing `Отправить сейчас` button in the publication queue panel should work for VK because it calls the platform-neutral queue endpoint.

Small copy updates are allowed so the panel no longer says only `Telegram-автоотправка`; it should say `Автоотправка` and mention Telegram/VK where space allows.

## Error Handling

Readable operator-facing errors:

- VK API token is not configured.
- VK owner id is not configured.
- VK publisher supports only VK publications.
- VK auto publishing currently supports only text publications without media.
- No text is available for VK publishing.
- VK API rejected the post: include error code and message.
- VK API returned an unexpected response.
- HTTP/network failures: include a short safe message.

Errors must not include access tokens.

## Tests

Backend tests:

- VK message builder uses current VK variant and preserves plain text.
- VK publisher rejects missing token/owner id.
- VK publisher rejects non-VK platform.
- VK publisher rejects media refs.
- VK publisher calls `wall.post` with expected params and returns provider evidence.
- VK publisher translates VK API error payloads.
- Scheduler routes Telegram and VK to the correct provider.
- Scheduler records common provider failures with the actual platform code.

Frontend source guard:

- Queue panel copy is platform-neutral and still exposes `Отправить сейчас`.

Full verification:

- Focused backend tests for VK publisher and scheduler.
- Full backend `pytest -q`.
- Frontend source guard, `npm test`, `tsc`, `lint`, `build`.
- `git diff --check`.

## Manual QA

1. Configure `VK_API_ACCESS_TOKEN`, `VK_OWNER_ID`, `VK_API_VERSION`, and `VK_FROM_GROUP`.
2. Create or find an approved/scheduled VK publication with no `media_refs`.
3. Save a VK channel adaptation.
4. Enqueue the publication.
5. Click `Отправить сейчас`.
6. Confirm the queue item succeeds and stores VK provider response.
7. Confirm the publication becomes published with `platform_post_id` and `platform_post_url`.
8. Open the VK wall URL and confirm the post text is correct.
9. Repeat with missing VK config and confirm a readable queue failure.
10. Repeat with media refs and confirm a readable text-only limitation.
