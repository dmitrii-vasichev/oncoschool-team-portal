# Test Plan

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
