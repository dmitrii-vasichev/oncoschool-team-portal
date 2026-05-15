# Content Factory Sprint 25 Review Queue Triage Design

## Context

The Content Factory already has a dedicated `/content-factory/review` route that groups publications by workflow status. The page is useful as a list, but it still requires the user to infer what each status means and what should happen next. Some group labels are still system-like English words such as `Factcheck`, `Approval`, `Scheduling`, and `Failed`.

Sprint 25 turns the review queue into an operational triage screen. It keeps the existing backend contract and derives readable queue state from the publication records already loaded by the page.

## Goal

Make the review queue answer three user questions immediately:

1. How many publications need attention?
2. Which operational bucket are they in?
3. What should the team do next for each item?

## Scope

In scope:

- Russian labels for all review queue groups.
- A filtered summary strip for review work: total, production, medical/editorial review, scheduling, and urgent items.
- A per-publication triage signal with readable label, tone, action, description, and urgency flag.
- UI updates on `/content-factory/review` that show the triage signal and a `Сейчас нужно` action block for every item.
- Source guards and helper tests to prevent regressions to raw system labels.
- Durable documentation updates in `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

Out of scope:

- Backend schema changes.
- Status transition endpoints.
- Automatic approvals, publishing, notifications, or platform integrations.
- Editing publications directly from the queue.
- Drag-and-drop review routing.

## Triage Model

The page continues to use `getContentFactoryReviewQueueGroups(publications)` for queue grouping. Sprint 25 adds two helper concepts:

- `getContentFactoryReviewQueueItemSignal(publication, now)` derives the row-level action.
- `summarizeContentFactoryReviewQueue(publications, now)` derives the summary strip.

Signals map existing publication statuses to user language:

- `needs_copy`: `Нужен текст`, action `Дописать текст`.
- `needs_design`: `Нужен дизайн`, action `Подготовить визуалы`.
- `factcheck`: `Фактчек`, action `Проверить факты`.
- `doctor_review`: `Проверка врача`, action `Передать врачу`.
- `approved` without schedule: `Назначить дату`, action `Поставить в календарь`.
- `approved` with schedule: `Одобрено`, action `Проверить пакет`.
- `scheduled` in the past: `План просрочен`, action `Проверить выпуск`.
- `scheduled` in the future: `В календаре`, action `Проверить пакет`.
- `failed`: `Ошибка публикации`, action `Разобрать ошибку`.
- `cancelled`: `Отменено`, action `Открыть причину`.

Urgent items are failed publications and scheduled publications whose planned date is already in the past.

## UI Design

The review route remains a dense operational dashboard rather than a marketing page. The visual tone should match the rest of Content Factory: restrained, readable, and work-focused.

The page header keeps the existing title `Очередь проверки`, count copy, and refresh action. Below it, a compact summary grid shows the current queue load:

- `В очереди`
- `Производство`
- `Фактчек и врач`
- `Расписание`
- `Срочно`

Queue sections remain grouped cards. Each row remains clickable and leads to the publication detail page. Inside each row:

- The title and existing status badge stay visible.
- A new triage pill shows the readable state.
- A `Сейчас нужно` block shows the next action and one-sentence explanation.
- Existing metadata cards for campaign, channel, responsible person, and plan remain compact.
- A small visual `Открыть` affordance makes it clearer that the row is actionable.

## Error Handling

No new network calls are added. Existing loading, empty, and fetch error behavior remains unchanged.

Invalid or unknown dates fall back to `Без даты`. Unknown statuses fall back to a neutral `Открыть карточку` signal.

## Testing

Automated coverage:

- Helper tests for Russian queue labels.
- Helper tests for signal mapping, urgent scheduled items, and summary counts.
- Source guards that ensure the route imports and renders the summary and item-signal helpers.
- Source guards that prevent raw English queue labels from returning.

Manual checks:

- Open `/content-factory/review`.
- Confirm summary counts match the visible filtered queue.
- Confirm every row shows `Сейчас нужно`.
- Confirm failed and overdue scheduled publications are marked urgent.
- Confirm queue group labels are Russian.
- Confirm row clicks still open publication detail pages.

