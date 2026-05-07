# Test Plan

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
