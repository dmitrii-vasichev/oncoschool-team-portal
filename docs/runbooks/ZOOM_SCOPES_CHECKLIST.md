# Zoom Scopes Checklist (Task Manager)

Дата проверки: 2026-02-19

## Что проверено live

- `POST /users/me/meetings` работает (создание встречи на 90 минут успешно).
- Не хватает прав для следующих операций (ответ Zoom `code=4711`):
  - чтение встречи (`GET /meetings/{id}`)
  - обновление встречи (`PATCH /meetings/{id}`)
  - удаление встречи (`DELETE /meetings/{id}`)
  - чтение recording files (`GET /meetings/{id}/recordings`)

## Scope-ы, которые должны быть у Server-to-Server OAuth app

Минимум для текущего кода:

- `meeting:create:meeting:admin`
- `meeting:read:meeting:admin`
- `meeting:update:meeting:admin`
- `meeting:delete:meeting:admin`
- `cloud_recording:read:list_recording_files:admin`

Если ваш Zoom app работает не на уровне аккаунта, используйте non-admin варианты этих же scope-ов.

## Где это используется в коде

- Создание: `backend/app/services/zoom_service.py` (`POST /users/me/meetings`)
- Обновление: `backend/app/services/zoom_service.py` (`PATCH /meetings/{id}`)
- Удаление: `backend/app/services/zoom_service.py` (`DELETE /meetings/{id}`)
- Проверка/детали: `backend/app/services/zoom_service.py` (`GET /meetings/{id}`)
- Транскрипция: `backend/app/services/zoom_service.py` (`GET /meetings/{id}/recordings`)

## Как добавить scope-ы (Zoom Marketplace)

1. Откройте `https://marketplace.zoom.us/`.
2. Войдите под тем же аккаунтом, где создан ваш Server-to-Server OAuth app.
3. `Manage` -> `Developed Apps` -> выберите ваш app.
4. Перейдите на вкладку `Scopes`.
5. Добавьте перечисленные выше scope-ы.
6. Нажмите `Save`.
7. Если Zoom попросит, выполните `Activate`/`Re-activate` app.
8. Перезапустите backend, чтобы использовать новый access token.

## Быстрая проверка после обновления scope-ов

1. Создайте встречу вручную с `zoom_enabled=true` и `duration_minutes=90`.
2. Убедитесь, что:
   - встреча создаётся;
   - дата/время редактируются без ошибки;
   - удаление встречи больше не падает;
   - endpoint проверки Zoom/транскрипции возвращает данные без `4711`.

## Временный cleanup

Из-за отсутствия delete-scope автоматически не удалились тестовые встречи:

- `81498232500`
- `88068716757`

После добавления `meeting:delete:meeting:admin` их можно удалить из UI проекта или Zoom.
