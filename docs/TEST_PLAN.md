# Test Plan

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
