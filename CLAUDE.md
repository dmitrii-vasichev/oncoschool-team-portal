# Онкошкола Task Manager

## Обзор

Таск-менеджер для команды ~20 человек с двумя точками входа: Telegram-бот и веб-интерфейс.
AI-парсинг Zoom Summary → задачи. Создание задач голосом. Ежедневные дайджесты.

Подробный план реализации со всеми промптами и схемой БД: **PLAN.md**

## Правила работы

- **Работаем пофазно.** Одна фаза за сессию. Не забегай вперёд.
- **Перед началом фазы** прочитай PLAN.md, найди нужную секцию — там полный промпт.
- **Не трогай PLAN.md.** Этот файл редактирует только человек.
- **CLAUDE.md** — можно ТОЛЬКО обновлять чеклист прогресса: менять `[ ]` на `[x]` после завершения фазы. Больше ничего в CLAUDE.md не менять — не добавлять текст, не переформатировать, не "улучшать".
- **После завершения фазы** сообщи: что сделано, какие файлы созданы/изменены, как проверить.
- **При ошибках** — исправляй сам, не проси человека править вручную.
- **Тесты** — пиши базовые тесты для сервисов (services/) если позволяет время фазы.

## Стек

### Backend (backend/)
- Python 3.12
- FastAPI — REST API
- aiogram 3.x — Telegram-бот (polling, без webhook)
- SQLAlchemy 2.0 — async, mapped_column, asyncpg
- Alembic — миграции (async)
- APScheduler — ежедневные напоминания
- Pydantic Settings — конфигурация
- anthropic / openai / google-genai — мульти-провайдер AI
- openai (Whisper API) — speech-to-text для голосовых

### Frontend (frontend/)
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- recharts — графики
- Lucide React — иконки

### База данных
- PostgreSQL (Supabase)
- 8 таблиц: team_members, tasks, task_updates, meetings, meeting_participants, notification_subscriptions, reminder_settings, app_settings

### Деплой
- Frontend: Vercel
- Backend: Railway

## Ключевые архитектурные решения

- **Ролевая модель:** moderator (полный доступ) / member (ограниченный). Проверка через PermissionService.
- **AI мульти-провайдер:** паттерн Strategy — AnthropicProvider / OpenAIProvider / GeminiProvider. Текущий провайдер хранится в app_settings (JSONB). Переключается модератором.
- **Whisper STT** всегда через OpenAI (независимо от выбранного AI-провайдера).
- **Голосовые задачи** работают и в личке с ботом, и в групповых чатах (ALLOWED_CHAT_IDS).
- **Task Updates** — промежуточные обновления с типами: progress, status_change, comment, blocker, completion.
- **Уведомления:** подписки модератора на события (task_created, task_completed и т.д.) + ежедневные дайджесты через APScheduler.
- **Единый сервисный слой:** и бот, и API используют одни и те же сервисы (TaskService, MeetingService и т.д.).

## Переменные окружения

```
BOT_TOKEN=                    # @BotFather
ADMIN_TELEGRAM_IDS=           # Telegram ID модераторов через запятую
ALLOWED_CHAT_IDS=             # ID групповых чатов для голосовых
DATABASE_URL=postgresql+asyncpg://...
ANTHROPIC_API_KEY=            # Опционально (хотя бы 1 AI-ключ)
OPENAI_API_KEY=               # Обязателен (Whisper STT)
GOOGLE_API_KEY=               # Опционально
TIMEZONE=Europe/Moscow
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Запуск

```bash
# Backend
cd backend && cp .env.example .env  # заполнить
pip install -e .
alembic upgrade head
python -m app.main

# Frontend
cd frontend && cp .env.local.example .env.local
npm install
npm run dev
```

## Текущий прогресс

- [x] Фаза 1: Инициализация и БД (модели, миграции, PermissionService)
- [x] Фаза 2: Бот базовые команды (авторизация, роли, /start, /help)
- [x] Фаза 3: Управление задачами (/tasks, /new, /assign, /done, /status)
- [x] Фаза 4: Task Updates (/update, /updates, /blocker, timeline)
- [x] Фаза 5: AI мульти-провайдер + парсинг Zoom Summary (/summary)
- [x] Фаза 6: Голосовые задачи (Whisper STT → AI → превью → задача)
- [x] Фаза 7: Подписки + напоминания (/subscribe, /reminders, дайджесты)
- [x] Фаза 8: REST API (все endpoints, auth, CORS)
- [ ] Фаза 9: Frontend каркас (layout, sidebar, dashboard, роли)
- [ ] Фаза 10: Kanban + task updates (доска, timeline, фильтры)
- [ ] Фаза 11: Встречи, summary, настройки (AI-модель, напоминания)
- [ ] Фаза 12: Аналитика + деплой (графики, Docker, Vercel/Railway)

## Чеклист тестирования

| Фаза | Как проверить |
|------|---------------|
| 1 | `alembic upgrade head` без ошибок, seed в app_settings |
| 2 | /start показывает роль, /help разный для moderator/member |
| 3 | /new — задача себе, /assign — только moderator, уведомления |
| 4 | /update 42 50% текст → апдейт, /updates 42 → timeline |
| 5 | /summary парсит через текущий провайдер, смена провайдера |
| 6 | Голосовое в ЛС и в группе → превью → задача с source=voice |
| 7 | /reminders → настройка → дайджест приходит в назначенное время |
| 8 | /docs — все endpoints, 403 для member на moderator-only |
| 9 | Sidebar зависит от роли, dashboard загружает данные |
| 10 | Drag & drop между колонками, timeline обновлений |
| 11 | Парсинг summary через веб, смена AI-модели в настройках |
| 12 | Графики, деплой, всё работает вместе |
