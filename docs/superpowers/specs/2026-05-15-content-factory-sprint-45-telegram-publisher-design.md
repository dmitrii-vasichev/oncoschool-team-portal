# Content Factory Sprint 45 Telegram Publisher Design

## Goal

Sprint 45 turns the Sprint 44 publishing queue into the first real external publishing integration: Telegram text publishing through the existing application bot.

This sprint should be intentionally narrow. It should prove that a Content Factory publication can move from `queued` to an actual Telegram post, store platform evidence, and fail safely when the integration is not configured or the post is not safe to automate.

## Context

The project already has:

- `BOT_TOKEN`, `app.state.bot`, and `aiogram.Bot` initialization.
- Telegram notification targets in `telegram_notification_targets`.
- Existing Telegram broadcast sending and scheduling patterns.
- Content Factory publication records with `platform_post_id`, `platform_post_url`, `actual_published_at`, and `status`.
- Content Factory publishing queue records with status, attempts, provider response, error message, and audit events.

Sprint 44 deliberately stopped before external calls. Sprint 45 should connect only Telegram to that queue.

## Scope

In scope:

- Add a Telegram publisher service for Content Factory queue items.
- Add a scheduler that processes due queued items every minute.
- Add a single-item `send-now` backend endpoint for operator-triggered sends.
- Use existing Telegram targets with type `content_factory`.
- Send text-only Telegram posts using the existing bot.
- Prefer a current saved Telegram publication variant when available.
- Update queue status, attempts, provider response, publication status, published timestamp, and platform post id on success.
- Record clear failure messages and audit events when sending is impossible.
- Add a small frontend affordance in the existing queue panel for `Отправить сейчас`.
- Update durable docs and tests.

Out of scope:

- Media attachments from `media_refs`.
- VK, Max, Dzen, email, GetCourse, or metrics integrations.
- A full UI for selecting Telegram targets per publication.
- Public Telegram URL guarantees. The system should store `message_id`; a best-effort URL may be stored only when safely derivable.
- Userbot publishing through the legacy Telegram analysis connection.

## Target Resolution

Sprint 45 should resolve a Telegram target in this order:

1. If the queue payload or publication UTM contains `telegram_target_id` or `cf_telegram_target_id`, use that active target.
2. Otherwise, find active `telegram_notification_targets` whose `types` array contains `content_factory`.
3. If exactly one such target exists, use it.
4. If none or more than one exist, fail the queue item with a readable operator message.

This keeps the first integration useful without adding another configuration table. A later sprint can add a friendly Content Factory target picker.

## Content Selection

The publisher should build the Telegram message from:

1. Current saved `CFPublicationVariant` with `channel="telegram"` and matching `source_version_number`.
2. Otherwise the publication title and body.

Text must be HTML-escaped before sending with `parse_mode="HTML"`. A title may be rendered as bold text followed by a blank line. Empty final text is a validation failure.

If the publication has non-empty `media_refs`, the publisher should not send a partial post. It should fail with a message explaining that automatic Telegram media publishing is not supported yet and that the operator should use manual fallback.

## Queue Execution

Due queue items are:

- `status="queued"`;
- `scheduled_for` is null or `scheduled_for <= now`;
- `next_retry_at` is null or `next_retry_at <= now`.

For each due item:

1. Mark it `processing`.
2. Add a `started` event.
3. Load the publication, platform, target, and current Telegram variant.
4. Send via `bot.send_message`.
5. On success:
   - mark queue item `succeeded`;
   - increment attempts and store `last_attempt_at`, `completed_at`, and provider response;
   - add a `succeeded` event;
   - update publication to `status="published"`;
   - set `actual_published_at`;
   - set `platform_post_id` to the Telegram `message_id`;
   - set `platform_post_url` only if a safe best-effort URL can be derived.
6. On failure:
   - use the existing retry semantics where possible;
   - keep retries bounded by `max_attempts`;
   - store the readable error message;
   - add a `failed` event.

## API

Add:

- `POST /api/content-factory/publishing-queue/{queue_item_id}/send-now`

The endpoint should:

- require Content Factory access;
- use the same queue processor as the scheduler;
- return the updated queue item;
- map integration validation failures to HTTP 400 or 503 where appropriate;
- keep the item audit trail consistent with scheduled processing.

## Frontend

The existing `ContentFactoryPublishingQueuePanel` should gain:

- a readable automatic publishing note for queued Telegram items;
- a button `Отправить сейчас` for queued items;
- success/error toast handling through the existing page refresh callback.

The panel should not imply universal auto-publishing. It should make clear that this first integration is Telegram-only.

## Error Handling

Operator-facing errors should be concrete:

- `Telegram-бот недоступен`.
- `Для автоотправки Telegram настройте одну активную группу с типом content_factory`.
- `Найдено несколько Telegram-групп для Content Factory. Укажите telegram_target_id в UTM публикации`.
- `Автоотправка Telegram пока поддерживает только текстовые публикации без media_refs`.
- `Публикация больше не находится в статусе Одобрено или Запланировано`.

Raw provider exceptions may be truncated and stored in `error_message`, but UI-facing strings should stay understandable.

## Testing

Backend tests should cover:

- target resolution by explicit UTM target id;
- fallback to a single active `content_factory` Telegram target;
- failure when zero or multiple targets are configured;
- text message composition from saved Telegram variants;
- media refs blocking;
- successful send updates queue and publication evidence;
- failed send records attempts and retry/failure metadata;
- send-now endpoint wiring.

Frontend tests should cover:

- the queue panel exposes `Отправить сейчас`;
- the API client exposes the send-now method;
- the publication detail still loads queue events and refreshes after queue actions.

## Acceptance Criteria

- A queued, due Telegram text publication can be sent by the scheduler or send-now endpoint.
- Success writes queue audit evidence and updates the publication as published.
- Failure is visible, retryable, and bounded.
- Media posts do not get silently degraded.
- Existing manual publish evidence remains available.
- All automated verification commands pass.
