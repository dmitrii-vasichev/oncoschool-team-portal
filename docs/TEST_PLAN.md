# Test Plan

## Content Factory Sprint 27 Publication Workflow History

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_cf_publication_service.py tests/test_content_factory_publications_api.py -q`
- `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page with existing body text.
2. Use `Быстрые действия` to move it from `Нужен текст` to a later review status.
3. Confirm the detail page refreshes and the status badge changes.
4. Confirm `История публикации` shows a new row for the status transition.
5. Confirm the row note uses readable Russian labels such as `Статус: Нужен текст -> Фактчек`.
6. Edit body text and status in one save and confirm only one new history row appears.
7. Confirm the saved body snapshot in history matches the latest body text.
8. Confirm metadata-only edits do not create noisy history rows.
9. Confirm published, failed, and cancelled transitions receive readable history events.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 26 Publication Workflow Actions

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page.
2. Confirm the right sidebar shows `Быстрые действия`.
3. Open a publication in `Нужен текст` and confirm actions include `Передать на дизайн`, `На фактчек`, and `Отменить`.
4. Click an enabled action and confirm the status badge refreshes after save.
5. Open an approved publication without a planned date and confirm `Поставить в календарь` is disabled with `Сначала укажите плановую дату`.
6. Add a planned date through the edit dialog and confirm `Поставить в календарь` becomes available.
7. Open a published publication and confirm quick actions are replaced by the explanatory empty state.
8. Confirm the existing `Факт публикации` dialog still handles actual publication date, post URL, and post ID.
9. Confirm API errors show toast feedback and do not leave buttons stuck in a loading state.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 25 Review Queue Triage

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/review`.
2. Confirm the summary strip shows `В очереди`, `Производство`, `Фактчек и врач`, `Расписание`, and `Срочно`.
3. Confirm the queue sections use Russian labels such as `Фактчек`, `Готовы к расписанию`, `В календаре`, and `Ошибки`.
4. Confirm each row shows the existing publication status and a readable triage badge.
5. Confirm each row shows `Сейчас нужно` with a concrete next action and explanatory sentence.
6. Confirm failed publications appear as urgent with `Ошибка публикации`.
7. Confirm scheduled publications with a past planned date appear as `План просрочен`.
8. Confirm approved publications without a date show `Назначить дату`.
9. Confirm clicking a row or its `Открыть` affordance opens the publication detail page.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 24 Calendar Operations

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/calendar`.
2. Confirm the summary strip shows `Сегодня`, `Просрочено`, `Готовы к выходу`, `Нужно действие`, and `Без даты`.
3. Apply status, platform, format, responsible, and campaign filters and confirm the summary counts update with the filtered list.
4. Confirm overdue active publications show `Просрочен план`.
5. Confirm today's ready publications show `Сегодня`.
6. Confirm future approved or scheduled publications with text and UTM show `Готово к выходу`.
7. Confirm publications without body text show `Нужен текст`.
8. Confirm publications without UTM show `Нужны UTM`.
9. Confirm published publications without fact or post reference show `Заполнить факт`.
10. Click `Открыть` on a row and confirm the publication detail page opens.

## Content Factory Sprint 23 Publish Package

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page.
2. Confirm `Пакет для публикации` appears after the text panel.
3. Confirm the package shows channel, format, campaign, planned date, audiences, UTM state, text state, and media state.
4. Confirm the text preview matches the publication body.
5. Confirm media references are visible when `media_refs` is filled and `Медиа не указаны` appears when it is empty.
6. Confirm UTM tags are shown as readable JSON when filled and `UTM не заполнены` appears when empty.
7. Click `Скопировать пакет` and paste into a scratch field to confirm the copied text includes title, channel, format, campaign, plan, audiences, text, media, and UTM.
8. Open a publication with missing references or no target audiences and confirm readable fallback labels appear.
9. Confirm existing UTM, audience, publication fact, and metric panels still work.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 22 Publication Readiness

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page.
2. Confirm the `Публикация и статистика` panel shows `Чек-лист готовности`.
3. Confirm text, scheduled date, UTM, audience, publication fact, and first metrics are listed.
4. Open a prepared unpublished publication and confirm text, schedule, UTM, and audience can show `Готово`.
5. Confirm publication fact and first metrics show `После публикации` before the publication is marked published.
6. Open a published publication without post URL/ID and confirm `Факт выхода` shows `Нужно заполнить`.
7. Open a published publication without metrics and confirm `Первые метрики` shows `Нужно заполнить`.
8. Add publication fact and confirm the checklist refreshes after save.
9. Add a metric and confirm the checklist refreshes after save.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 21 Metric Capture UX

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page.
2. Click `Добавить метрику`.
3. Confirm the measurement window options are readable Russian labels.
4. Confirm the source options are readable labels such as `TGStat`, `VK API`, and `Email-платформа`.
5. Confirm confidence options are readable Russian labels.
6. Click a quick metric preset such as `Просмотры` or `Регистрации` and confirm it fills the metric-name field.
7. Save a metric and confirm the metric history row shows readable window, source, and confidence labels.
8. Open `/content-factory/effectiveness` and confirm the latest metric badges are readable labels, not raw enum values.
9. Confirm existing numeric and text metric value rendering still works.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 20 Publication Creation

### Automated

- `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/publications`.
2. Confirm the page header shows the primary `Новая публикация` action and the secondary `К календарю` action.
3. Click `Новая публикация` and confirm the publication dialog opens.
4. Confirm the dialog shows a required `Кампания` selector before the production fields.
5. Fill campaign, platform, format, responsible person, title, body text, scheduled date, and optional rubric/nosology.
6. Save and confirm the app routes to `/content-factory/publications/{id}` for the created publication.
7. Return to `/content-factory/publications` and confirm the new publication appears in the list.
8. Open a campaign detail page and confirm creating a publication there does not show a duplicate campaign selector.
9. Confirm saving without a campaign from the publications index shows `Выберите кампанию`.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Content Factory Sprint 19 Publications Index

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/publications`.
2. Confirm `Публикации` appears in the horizontal Content Factory navigation.
3. Confirm the page loads all publications and shows summary counts.
4. Search by publication title or body text and confirm the list narrows.
5. Search by campaign, platform, format, responsible person, or status label and confirm matching rows remain.
6. Apply status, platform, format, responsible, and campaign filters together.
7. Confirm every row shows campaign, channel/format, responsible person, planned date, actual date, and link state.
8. Click a row and confirm the publication detail page opens.
9. Confirm the header breadcrumb for a publication detail page goes through `Публикации`.
10. Confirm desktop and mobile layouts stay readable and do not overlap text.

## Telegram Overdue Task Report Readability

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_reminder_digest_section_order.py -q`
- `git diff --check`

### Manual

1. Trigger or wait for a `task_overdue` subscription report in Telegram.
2. Confirm the report body starts with the total overdue task count.
3. Confirm the report shows overdue-age buckets for more than 7 days, 3-7 days, and 1-2 days.
4. Confirm the `По ответственным` section is sorted by descending overdue task count.
5. Confirm the report uses `Давно просрочены` and does not call old tasks critical.
6. Confirm task numbers are not visible in the report body.
7. Confirm no project grouping or project button appears.
8. Tap `Показать все просроченные` and confirm the existing overdue task list opens.

## Content Factory Sprint 17 Guest Stage Timeline

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a guest story detail page with status-change activity events.
2. Confirm `Путь истории` appears between attention and detail panels.
3. Confirm stage labels are Russian.
4. Confirm the current stage is marked as current.
5. Confirm the current-stage duration is visible.
6. Confirm the next-step date is visible when `stage_due_at` exists.
7. Confirm active stories without `stage_due_at` show a warning to assign the next step.
8. Confirm stories without activity history still render one timeline item for the current status.
9. Edit a story status and confirm the timeline refreshes after save.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 16 Threaded Activity

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_guest_stories_api.py tests/test_cf_guest_story_service.py tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_content_factory_guest_story_migration.py -q`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test alembic heads`
- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a guest story detail page with existing activity.
2. Add a normal top-level comment and confirm it appears as before.
3. Click `Ответить` on an existing event and confirm the form shows reply context.
4. Submit the reply and confirm it appears nested under the selected event.
5. Click `Ответить` on a nested reply and confirm deeper replies remain readable.
6. Click `Отменить ответ` and confirm the next comment is top-level again.
7. Refresh the page and confirm the nesting is preserved.
8. Confirm automatic system events remain top-level unless a user explicitly replies to them.
9. Confirm invalid reply parents are rejected by the API with a readable error.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 15 Guest Attention Queue

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/guests` and confirm the `Требуют внимания` summary card is visible.
2. Confirm the `Требуют внимания` filter hides calm stories and keeps urgent records.
3. Confirm overdue stage records show `Просрочен следующий шаг`.
4. Confirm consent-ready records without signed consent show `Нужно закрыть согласие`.
5. Confirm published records with due follow-up show `Нужен follow-up`.
6. Confirm gift-pending records show `Нужно отправить подарок`.
7. Confirm active records without `stage_due_at` show `Не назначен следующий шаг`.
8. Confirm closed records such as `follow_up_done`, `maybe_later`, `rejected`, and `archived` do not appear in the attention queue.
9. Open a guest detail page and confirm the attention panel shows the next action and reasons.
10. Confirm calm detail pages show `Сейчас без срочных действий`.

## Content Factory Sprint 14 Guest Activity

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_guest_stories_api.py tests/test_cf_guest_story_service.py tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_content_factory_guest_story_migration.py -q`
- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open an existing guest story detail page.
2. Confirm the activity panel loads newest events first.
3. Add a manual comment and confirm it appears without reloading the browser.
4. Edit the story status and confirm an automatic stage-change event appears.
5. Edit consent state, gift state, and follow-up date and confirm automatic events appear.
6. Confirm event actor names use team member names when available.
7. Confirm blank comments are blocked before sending.
8. Confirm activity load failures do not blank the story detail page.
9. Confirm missing activity renders a friendly empty state.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 13 Guest Detail

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/guests` and click a guest story title.
2. Confirm `/content-factory/guests/{id}` loads the selected story.
3. Confirm the detail page shows stage, role, owner, source, due date, consent, anonymity, gift, and follow-up context.
4. Confirm story brief, source notes, screening notes, factcheck notes, rejection/pause reason, allowed channels, sensitive topics, and legal notes render as readable Russian fields.
5. Confirm linked campaign and publication links open the expected pages.
6. Confirm missing optional values show friendly fallback text.
7. Edit a story from the detail page and confirm the detail view refreshes.
8. Confirm the refresh action reloads the detail data.
9. Confirm a missing or inaccessible story shows the not-found state and a link back to `Гости и истории`.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 12 Guest Workspace

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/guests` and confirm guest stories load.
2. Search by guest name, contact, brief, source notes, screening notes, legal notes, and rejection reason.
3. Filter by pipeline stage, consent state, owner, and campaign.
4. Create a guest story with display name, role, source, owner, stage, consent state, allowed channels, boundaries, and follow-up fields.
5. Edit an existing guest story and confirm the list refreshes.
6. Confirm linked campaign and publication links open the expected pages.
7. Confirm missing reference data falls back to readable labels instead of breaking the page.
8. Confirm no hard delete action exists.
9. Confirm unauthenticated access reaches the existing login flow instead of a blank page or runtime crash.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 11 Guest CRM Foundation

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_guest_stories_api.py tests/test_cf_guest_story_service.py tests/test_content_factory_models.py tests/test_content_factory_schemas.py tests/test_content_factory_guest_story_migration.py -q`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test alembic heads`
- `git diff --check`

### Manual

1. After the frontend guest workspace exists, create a guest story and confirm the API stores owner, status, source, consent status, anonymity level, allowed channels, sensitive topics, and follow-up fields.
2. Confirm a Content Factory user can list, create, open, and update guest stories.
3. Confirm a user without Content Factory access is blocked by the existing protected API dependency.
4. Confirm linked bundle and publication IDs remain optional.
5. Confirm no hard delete route exists for guest stories.

## Content Factory Sprint 10 Effectiveness Analytics

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/effectiveness` and confirm summary cards load.
2. Confirm rows show publication, campaign, platform, format, objective, status, metric state, latest metric, metric count, and target evidence.
3. Confirm search matches publication title, campaign name, platform name, format name, objective, and metric name.
4. Confirm objective filtering works without a page reload.
5. Confirm metric-state filtering works for fresh, stale, and missing evidence.
6. Confirm platform filtering works without a page reload.
7. Open publication and campaign links from the effectiveness table.
8. Confirm the internal Content Factory navigation and header expose `Эффективность`.
9. Confirm partial metric/target evidence failures show a clear warning while available rows still render.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 9.5 UX Consolidation

### Automated

- `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts src/lib/contentFactoryUtils.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Confirm the global sidebar shows a single `Контент-фабрика` entry.
2. Open `/content-factory/dashboard` and confirm internal Content Factory navigation appears.
3. Confirm internal navigation reaches overview, calendar, campaigns, review queue, audiences, audience analytics, retrospectives, dictionaries, and help.
4. Confirm headers and visible labels use Russian product wording instead of `CF`, `Bundle`, `Segment`, or other system terms.
5. Open the retrospective dialog and confirm it uses readable fields: `Что сработало`, `Что сломалось`, `Выводы`, `Решения`, `Следующие действия`.
6. Create or edit a retrospective using plain text lines rather than JSON.
7. Open a retrospective detail page and confirm sections render as readable Russian content.
8. Open `/content-factory/help` and confirm it explains the module, workflow, sections, manual data, and deferred integrations.
9. Confirm unauthenticated access still reaches the existing protected-route behavior.
10. Confirm desktop and mobile layouts do not overlap and the internal navigation scrolls horizontally when needed.

## Content Factory Sprint 9 Segment Usage Analytics

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/segments/analytics` and confirm summary cards load.
2. Confirm used and unused segment filters work without a page reload.
3. Confirm role filtering works for target, exclusion, control, and retargeting segment usage.
4. Confirm search matches segment name, source ID, and related publication titles.
5. Confirm segment rows show publication count, bundle count, role mix, bundle status mix, published count, metric evidence count, and latest activity.
6. Open a segment detail link from the analytics page.
7. Open recent publication links from a segment row.
8. Confirm the segment registry exposes the analytics action.
9. Confirm unauthenticated access reaches the existing login flow instead of a blank page or runtime crash.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 8 Segment Workspace

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/segments` and confirm active and inactive segments load.
2. Search by segment name and external segment ID.
3. Filter by active state and source.
4. Create a manual GetCourse segment mirror with name, source ID, population count, owner, and optional URL.
5. Refresh a segment population count and confirm the registry updates.
6. Open `/content-factory/segments/{id}` and confirm metadata, latest count, previous count, delta, and snapshot history render.
7. Refresh the segment from the detail page and confirm a new snapshot appears.
8. Confirm segments with no snapshots and one snapshot do not show misleading percentage deltas.
9. Confirm unauthenticated access reaches the existing login flow instead of a blank page or runtime crash.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 7 Reference Admin

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/references` as an admin and confirm platforms, formats, rubrics, nosologies, and funnel templates load with inactive records included.
2. Create one test record in each reference table where test data is available.
3. Edit each record and confirm changes refresh in the active tab.
4. Toggle `is_active` and confirm inactive records remain visible on the reference admin page.
5. Enter invalid JSON for platform capabilities and funnel-template publications and confirm the dialog shows a clear inline error without sending the request.
6. Delete an unused test record and confirm it disappears after refresh.
7. Attempt to delete an in-use record and confirm the backend 409 message is shown clearly.
8. Log in as a non-admin user with `has_content_factory_access=true` and confirm the page is read-only.
9. Confirm unauthenticated access reaches the existing login flow instead of a blank page or runtime crash.
10. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 6 Retrospective Workspace

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open `/content-factory/retros` and confirm retro cards load with period, type, facilitator, bundle, and structured section counts.
2. Filter retros by weekly, monthly, bundle, and ad-hoc types.
3. Create a weekly retro with structured JSON sections and notes.
4. Create a bundle retro linked to an existing bundle.
5. Open a retro detail page and confirm structured sections and notes render clearly.
6. Edit structured sections and notes from the detail page.
7. Enter invalid JSON in the dialog and confirm the UI shows a clear inline error without sending the request.
8. Confirm unauthenticated access reaches the existing login flow instead of a blank page or runtime crash.

## Content Factory Sprint 5 Outcomes

### Automated

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a publication detail page and confirm segment targets load.
2. Add a target, exclusion, control, and retargeting segment where test data is available.
3. Remove a segment target and confirm the list refreshes.
4. Use the UTM helper to generate a campaign/content/term/CTA object and apply it to the publication.
5. Record manual metric snapshots for 3h, 24h, 7d, final, and a custom window where useful.
6. Confirm metric history shows value, source method, confidence, note, and captured time.
7. Open `/content-factory/review` and confirm production, factcheck, doctor review, approval, scheduling, failed, and cancelled queues link to publication detail pages.
8. Confirm unauthenticated access to `/content-factory/review` reaches the existing login flow instead of a blank page or runtime crash.
9. Confirm desktop and mobile layouts stay compact and do not overlap text.

## Content Factory Sprint 4 Workspace

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_bundle_service.py tests/test_cf_publication_service.py tests/test_content_factory_bundles_api.py tests/test_content_factory_publications_api.py -q`
- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Log in as an admin or member with `has_content_factory_access=true` and confirm `/content-factory/bundles` is reachable from Content Factory navigation.
2. Confirm bundle filters by status, product stream, and owner update the register without a page reload.
3. Create a bundle with name, product stream, owner, status, event date, brief, funnel template, and source material refs.
4. Open the created bundle and confirm the detail page shows brief, owner, product stream, event date, funnel template, source materials, and an empty publication state.
5. Edit the bundle owner/product stream/status/brief and confirm the detail page refreshes with the updated values.
6. Create a publication inside the bundle with platform, format, responsible user, status, schedule, title, body, media refs, and UTM JSON.
7. Open the publication editor and confirm status, schedule, title, body, media refs, UTM, post URL, post ID, responsible user, rubric, format, platform, and nosology can be edited where the backend contract supports them.
8. Change publication body text and confirm version history shows the new version after save.
9. Change publication metadata without changing body text and confirm version history does not add an unnecessary body version.
10. Confirm unauthenticated access to `/content-factory/bundles`, `/content-factory/bundles/{id}`, and `/content-factory/publications/{id}` reaches the existing login flow instead of a blank page or runtime crash.
11. Confirm the workspace remains compact and operational, with no marketing-style hero page and no overlapping text at desktop and mobile widths.

## Content Factory Sprint 3 Frontend

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py tests/test_content_factory_publications_api.py -q`
- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Log in as an admin user and confirm `/content-factory/dashboard` and `/content-factory/calendar` are reachable from navigation.
2. Log in as a non-admin member with `has_content_factory_access=true` and confirm the same Content Factory routes are reachable.
3. Log in as a non-admin member without Content Factory access and confirm the Content Factory routes are blocked or redirected consistently with the portal's existing protected-route behavior.
4. Confirm the dashboard shows bundle status, publication status, upcoming scheduled publications, overdue production work, and recent published work.
5. Confirm the calendar groups publications by scheduled date, keeps unscheduled publications visible, and applies platform/status/responsible filters without a page reload.
6. Confirm dashboard and calendar copy stays operational and compact, with no marketing-style hero page.
7. In a local unauthenticated browser session, open `/content-factory/dashboard` and `/content-factory/calendar` and confirm both routes reach the existing login flow instead of a blank page or runtime crash.

## Content Factory Recovery Sprint 2.5

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_bundle_service.py tests/test_cf_publication_service.py tests/test_cf_seed.py tests/test_cf_segment_metric_retro_services.py tests/test_content_factory_models.py tests/test_content_factory_permissions.py tests/test_content_factory_schemas.py tests/test_content_factory_bundles_api.py tests/test_content_factory_formats_api.py tests/test_content_factory_funnel_templates_api.py tests/test_content_factory_glossary_api.py tests/test_content_factory_glossary_service.py tests/test_content_factory_metrics_api.py tests/test_content_factory_nosologies_api.py tests/test_content_factory_platforms_api.py tests/test_content_factory_publication_service_extras.py tests/test_content_factory_publications_api.py tests/test_content_factory_retro_update.py tests/test_content_factory_retros_api.py tests/test_content_factory_rubrics_api.py tests/test_content_factory_segments_api.py tests/test_team_cf_access_api.py -q`
- `git diff --check`

### Manual

1. Confirm `backend/.env` exists locally and uses `DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf` for the Docker development Content Factory database.
2. Confirm durable Content Factory planning context is tracked in `docs/content-factory-design.md`, not in gitignored `docs/plans/`.
3. Before Sprint 3 starts, confirm the frontend access plan accounts for `team_members.has_content_factory_access` and does not reuse legacy Telegram analysis content grants.

## Meeting Board Focus

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a meeting board with no focus labels and confirm it behaves like the previous board, with the added `Новые` section.
2. Select a focus label as a moderator and confirm unrelated participant tasks disappear.
3. Confirm participant, added-member, and added-department tasks with any selected focus label remain visible.
4. Confirm a pinned task without a selected focus label remains visible when the viewer can access it.
5. Log in as a user with narrower department visibility and confirm matching focus labels do not reveal hidden tasks.
6. Confirm cancelled tasks do not appear on the board.
7. Move a task to `done` and confirm it appears in `Выполнено за 7 дней`.
8. Confirm the review section displays as `На согласовании`.
9. Confirm the compact scope summary leaves more room for task sections during screen sharing.
10. Confirm regular participants see the focus summary read-only and cannot update board settings.

## Long Meeting Audio Transcription

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Confirm the Railway backend image has `ffmpeg` available.
2. Run audio transcription on a short recording under 25 MB and confirm it completes.
3. Run audio transcription on a Zoom recording over 25 MB and confirm it is chunked and completed.
4. Leave the meeting page while transcription is running and confirm in-app and Telegram completion notifications arrive.
5. Force a transcription failure and confirm status becomes failed, temporary files are removed, and retry is possible.
6. Confirm no Zoom audio file is persisted in portal storage after success or failure.
7. After transcript completion, generate the AI outcome draft and publish selected tasks as before.

## Meeting Board and AI Outcomes

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_meeting_board_service.py tests/test_meeting_board_api.py tests/test_meeting_ai_outcomes_service.py tests/test_meeting_ai_outcomes_api.py -q`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Open a meeting detail page and confirm `Открыть доску встречи` opens the separate board route.
2. Confirm the board is usable for Zoom screen sharing at desktop width.
3. Confirm urgent, in-progress, review, and done-this-week sections render from live task data.
4. Using the board settings API or a seeded fixture, configure an added member, department, pinned task, link, and board note, then confirm the board displays the resulting scope counts, materials, and note.
5. Confirm the first-release board UI does not present a working inline composition editor yet; the moderator `Добавить` control should be visibly disabled until the follow-up editor is built.
6. Confirm regular participants cannot update board settings or run AI processing.
7. Run manual audio transcription on a meeting with a Zoom recording.
8. Confirm no audio file is persisted in portal storage after success or failure.
9. Generate an AI outcome draft and edit summary, decisions, and task candidates.
10. Publish with one task candidate unchecked and confirm only selected tasks are created.

## Task Board Visual Polish

Manual/browser checks:

- Open the new task dialog on desktop and confirm the create button is visible without internal dialog scrolling in the normal viewport.
- Confirm the description row starts collapsed, expands into a textarea, accepts text, and resets after closing the dialog.
- Confirm labels and urgency share one row on desktop and stack cleanly on narrow widths.
- Confirm urgency is off by default and switches between `normal` and `urgent` in the create payload.
- Confirm urgent task board cards show the red left edge and do not show the footer `Срочно` chip.
- Confirm the assignee name has more room on urgent cards with deadlines.
- Confirm checklist preview cards no longer show a large blank area between title and checklist.
- Confirm empty columns show a quiet dashed drop-zone instead of the old `Нет задач` illustration and copy.
- Drag a task over an empty column and confirm the drop-zone remains a visible target.

## Task Urgency and Create Checklist

### Automated

- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py tests/test_reminder_digest_section_order.py tests/test_task_label_task_api.py tests/test_task_permission_service.py -q`
- `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `git diff --check`

### Manual

1. Confirm existing `high` tasks appear as urgent after migration.
2. Confirm existing `medium` and `low` tasks appear as normal after migration.
3. Create a normal web task and confirm the payload stores `normal`.
4. Create an urgent web task and confirm the payload stores `urgent`.
5. Add checklist items in the new task dialog and confirm they appear after creation.
6. Open the Kanban board and confirm task cards have no status or priority icons.
7. Confirm urgent cards show the red left edge and visible `Срочно` text.
8. Confirm overdue cards still show overdue styling and visible `Просрочено` text.
9. Confirm urgent overdue cards show both urgency and overdue signals.
10. Toggle urgency from the task detail page and confirm card/filter behavior updates.
11. Filter tasks by urgent and normal.
12. Confirm meeting summary task preview offers only normal and urgent.
13. Confirm analytics copy says urgency, not priority.
14. Confirm reminder settings copy says urgency, not priority.
15. Confirm Telegram task creation and edit prompts use urgency language.

## Task Label Management

### Automated

- `cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q`
- `cd backend && pytest -q`
- `cd frontend && npm test`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`

If `backend/.env` is not present, run backend unit tests with minimal test settings:

- `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q`
- `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`

### Manual

1. Create a label from the task label picker and choose a non-default color.
2. Confirm the label chip uses the selected color on task cards and task detail.
3. As the label creator, edit the label name and color before it is used on another person's task.
4. Attach the label to a task where the author or assignee is another user, then confirm ordinary member edit/archive actions disappear after refresh.
5. Archive an owned, non-shared label and confirm it disappears from normal picker results.
6. Confirm the archived label remains visible on a task that already had it.
7. As a moderator, open `/settings?tab=task-labels`.
8. Edit an active label from Settings.
9. Archive an active label from Settings.
10. Switch to the archive filter and restore the archived label.
11. Try creating a new label with the same name as an archived label and confirm the UI shows the archived-conflict message.

## Task Labels

### Automated

- `cd backend && pytest tests/test_task_label_repository.py tests/test_task_label_api.py tests/test_task_label_task_api.py tests/test_task_permission_service.py tests/test_task_update_permissions.py -q`
- `cd backend && pytest -q`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm test`

### Manual

1. Open the Tasks page with a running backend and seeded user account.
2. Create a label named `Conference` while creating a task.
3. Add `Conference` and `Partners` to one task.
4. Create another task with no labels.
5. Filter the task board by `Conference`.
6. Confirm the unlabeled task is hidden only while the filter is active.
7. Edit labels from the task detail page.
8. Log in as a user with narrower department access.
9. Confirm the user does not see hidden tasks even when those tasks have matching labels.

### Smoke

- Run the frontend dev server and open `/login` to confirm the app renders without a frontend runtime crash.
