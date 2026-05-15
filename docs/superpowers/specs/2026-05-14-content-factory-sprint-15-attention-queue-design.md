# Content Factory Sprint 15 Guest Attention Queue Design

## Context

Sprint 11 added the guest story backend foundation. Sprint 12 added the list/create/edit workspace. Sprint 13 added a dedicated detail page. Sprint 14 added a guest story activity journal with manual comments and automatic key-change events.

The next useful slice is not another standalone database workflow. The team needs a clearer way to see which guest stories require action right now and what the next action should be.

## Goal

Add an operational attention layer for guest and patient stories:

- Show which stories require attention.
- Explain why a story requires attention in plain Russian.
- Surface the next recommended action on both the list page and the detail page.
- Add a quick filter for the attention queue.

## Scope

In scope:

- Frontend helper logic that derives attention reasons from existing `CFGuestStory` fields.
- A summary count for stories requiring attention.
- An attention filter on `/content-factory/guests`.
- Attention badges and next-action text in the guest story table.
- A detail-page panel with a focused "what to do next" explanation.
- Source-guard and helper tests.

Out of scope:

- New backend columns.
- New Alembic migration.
- Notification/reminder delivery.
- Threaded comments.
- Consent document storage or signature integrations.
- Gift delivery automations.

## Attention Rules

The first version uses deterministic rules from existing data:

1. Closed stories never require attention: `follow_up_done`, `maybe_later`, `rejected`, `archived`.
2. If `stage_due_at` is in the past or now, the story needs attention: "Просрочен следующий шаг".
3. If the story is on or after consent-preparation stages and consent is not signed, the story needs attention: "Нужно закрыть согласие".
4. If the story is published or later and `follow_up_due_at` is in the past or now, the story needs attention: "Нужен follow-up".
5. If gift status is `pending`, the story needs attention: "Нужно отправить подарок".
6. If an active story has no `stage_due_at`, it needs planning attention: "Не назначен следующий шаг".

The rules intentionally stay conservative. They prioritize concrete operational misses over speculative scoring.

## UX

On `/content-factory/guests`:

- Add a sixth summary card: "Требуют внимания".
- Add a compact filter control: "Все истории" / "Требуют внимания".
- Keep existing filters working together with the attention filter.
- Add badges for the first one or two attention reasons in each row.
- Add a small "Следующее действие" line in each row.

On `/content-factory/guests/[id]`:

- Add a compact attention panel near the top of the page.
- Show the recommended next action and all reasons.
- If nothing is urgent, show a calm "Сейчас без срочных действий" message.

## Data Flow

No new API is required. The frontend already loads guest stories and related reference records. Helper functions in `frontend/src/lib/contentFactoryUtils.ts` derive attention state from a `CFGuestStory`-like object and an optional `now` value for testability.

## Testing

- Add helper tests for stage due, consent due, follow-up due, gift pending, missing next step, closed stories, sorting, and filtering.
- Add source guards to ensure the list page uses the attention filter and the detail page renders the attention panel.
- Run focused frontend tests, full frontend tests, TypeScript, lint, build, and `git diff --check`.
