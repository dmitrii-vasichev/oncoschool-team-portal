# Test Plan

## Task Urgency and Create Checklist

### Automated

- `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_task_urgency.py tests/test_task_update_permissions.py tests/test_reminder_digest_section_order.py tests/test_task_label_task_api.py tests/test_task_permission_service.py -q`
- `cd backend && env DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`
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
