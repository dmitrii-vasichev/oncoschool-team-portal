# Онкошкола Task Manager

## Обзор

Таск-менеджер для команды ~20 человек с тремя точками входа: Telegram-бот, веб-интерфейс и Telegram Mini App.
AI-парсинг Zoom Summary → задачи. Создание задач голосом. Ежедневные дайджесты.

Подробный план реализации со всеми промптами и схемой БД: **PLAN.md**
План переделки модуля «Встречи» (Zoom-интеграция, расписание, напоминания): **MEETINGS_PLAN.md**
План переделки вкладки «Команда» (дерево, отделы, 3 роли, аватары): **TEAM_PLAN.md**
План Telegram Mini App (задачи в Telegram): **MINI_APP_PLAN.md**

## Правила работы

- **Работаем пофазно.** Одна фаза за сессию. Не забегай вперёд.
- **Перед началом фазы** прочитай PLAN.md (или MEETINGS_PLAN.md для фаз M1-M6, или TEAM_PLAN.md для фаз T1-T6), найди нужную секцию — там полный промпт.
- **Не трогай PLAN.md, MEETINGS_PLAN.md и TEAM_PLAN.md.** Эти файлы редактирует только человек.
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

### Mini App (mini-app/)
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Telegram CSS-переменные
- TanStack Query
- Telegram WebApp SDK (native window.Telegram.WebApp)

### База данных
- PostgreSQL (Supabase)
- 11 таблиц: team_members, tasks, task_updates, meetings, meeting_participants, notification_subscriptions, reminder_settings, app_settings, meeting_schedules, telegram_notification_targets, departments

### Деплой
- Frontend: Vercel
- Backend: Railway

## Ключевые архитектурные решения

- **Ролевая модель:** admin (полный доступ) / moderator (управление задачами, отделами, summary) / member (только свои задачи, просмотр команды). Проверка через PermissionService.
- **AI мульти-провайдер:** паттерн Strategy — AnthropicProvider / OpenAIProvider / GeminiProvider. Текущий провайдер хранится в app_settings (JSONB). Переключается модератором.
- **Whisper STT** всегда через OpenAI (независимо от выбранного AI-провайдера).
- **Голосовые задачи** работают и в личке с ботом, и в групповых чатах (ALLOWED_CHAT_IDS).
- **Task Updates** — промежуточные обновления с типами: progress, status_change, comment, blocker, completion.
- **Уведомления:** подписки модератора на события (task_created, task_completed и т.д.) + ежедневные дайджесты через APScheduler.
- **Единый сервисный слой:** и бот, и API используют одни и те же сервисы (TaskService, MeetingService и т.д.).
- **Zoom интеграция:** Server-to-Server OAuth. ZoomService для создания встреч, получения записей и транскрипций. Graceful fallback если Zoom не настроен.
- **Расписание встреч:** MeetingSchedulerService (APScheduler) заменяет n8n workflow — автоматическое создание Zoom-конференций и отправка напоминаний в Telegram.
- **Telegram-напоминания:** Отправка в несколько групп с поддержкой thread_id (темы). Настройка целей через UI.

## Дизайн

При работе с фронтендом следуй гайдлайнам в `.claude/FRONTEND_DESIGN.md`.
Промпты для последовательного улучшения дизайна: `DESIGN_PROMPTS.md`.

## Переменные окружения

```
BOT_TOKEN=                    # @BotFather
ADMIN_TELEGRAM_IDS=           # Telegram ID модераторов через запятую
ALLOWED_CHAT_IDS=             # ID групповых чатов для голосовых
DATABASE_URL=postgresql+asyncpg://...
ANTHROPIC_API_KEY=            # Опционально (хотя бы 1 AI-ключ)
OPENAI_API_KEY=               # Обязателен (Whisper STT)
GOOGLE_API_KEY=               # Опционально
ZOOM_ACCOUNT_ID=              # Zoom Server-to-Server OAuth
ZOOM_CLIENT_ID=               # Zoom Server-to-Server OAuth
ZOOM_CLIENT_SECRET=           # Zoom Server-to-Server OAuth
NOTIFICATION_CHAT_IDS=        # Дефолтные Telegram-группы для напоминаний
TIMEZONE=Europe/Moscow
MINI_APP_URL=                 # URL задеплоенного Mini App (Vercel), опционально
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

# Mini App
cd mini-app && cp .env.local.example .env.local  # заполнить
npm install
npm run dev
```

## Текущий прогресс

### Основной план (PLAN.md) — завершён ✅

- [x] Фаза 1: Инициализация и БД (модели, миграции, PermissionService)
- [x] Фаза 2: Бот базовые команды (авторизация, роли, /start, /help)
- [x] Фаза 3: Управление задачами (/tasks, /new, /assign, /done, /status)
- [x] Фаза 4: Task Updates (/update, /updates, /blocker, timeline)
- [x] Фаза 5: AI мульти-провайдер + парсинг Zoom Summary (/summary)
- [x] Фаза 6: Голосовые задачи (Whisper STT → AI → превью → задача)
- [x] Фаза 7: Подписки + напоминания (/subscribe, /reminders, дайджесты)
- [x] Фаза 8: REST API (все endpoints, auth, CORS)
- [x] Фаза 9: Frontend каркас (layout, sidebar, dashboard, роли)
- [x] Фаза 10: Kanban + task updates (доска, timeline, фильтры)
- [x] Фаза 11: Встречи, summary, настройки (AI-модель, напоминания)
- [x] Фаза 12: Аналитика + деплой (графики, Docker, Vercel/Railway)

### Переделка модуля «Встречи» (MEETINGS_PLAN.md) — завершён ✅

- [x] Фаза M1: Миграция БД + Zoom-сервис + Конфигурация
- [x] Фаза M2: Расписание встреч — бэкенд (API + Scheduler)
- [x] Фаза M3: Переработка API встреч + Summary внутри карточки
- [x] Фаза M4: Фронтенд — Расписание + Telegram-настройки
- [x] Фаза M5: Фронтенд — Карточка встречи (транскрипция, AI, задачи)
- [x] Фаза M6: Интеграция, полировка, миграция данных

### Переделка вкладки «Команда» (TEAM_PLAN.md) — завершён ✅

- [x] Фаза T1: Миграция БД + Модели (departments, team_members поля, роли)
- [x] Фаза T2: Backend API + Permissions (departments CRUD, avatar upload, tree endpoint)
- [x] Фаза T3: Бот + совместимость (3 роли, /start, /help)
- [x] Фаза T4: Frontend типы + API + хуки (types, api, permissions, RoleBadge)
- [x] Фаза T5: Дерево + карточки (TeamTree, DepartmentNode, MemberCard, модальные окна)
- [x] Фаза T6: Полировка + совместимость (sidebar, avatar everywhere, CLAUDE.md)

### Telegram Mini App (MINI_APP_PLAN.md) — завершён ✅

- [x] Фаза MA1: Backend auth endpoint + /app команда
- [x] Фаза MA2: Mini App каркас + Telegram SDK + авторизация
- [x] Фаза MA3: Экран "Мои задачи" + фильтры + навигация
- [x] Фаза MA4: Детали задачи + действия + создание
- [x] Фаза MA5: Интеграция с ботом + полировка + деплой

## Чеклист тестирования

### Основной план

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

### Переделка модуля «Встречи»

| Фаза | Как проверить |
|------|---------------|
| M1 | `alembic upgrade head` — новые таблицы, Zoom-сервис инициализируется (или graceful fallback без ENV) |
| M2 | POST /meeting-schedules создаёт расписание, scheduler триггерит Zoom + Telegram, GET /telegram-targets работает |
| M3 | POST /meetings создаёт встречу с Zoom, транскрипция (авто/ручная), парсинг summary → превью → задачи |
| M4 | UI расписания отображается, создание/редактирование работает, Telegram-цели настраиваются в /settings |
| M5 | Карточка встречи: 4 таба работают, AI-парсинг из карточки, /summary удалён |
| M6 | Бот /meetings показывает предстоящие, dashboard обновлён, старые meetings мигрированы |

### Переделка вкладки «Команда» (TEAM_PLAN.md)

| Фаза | Как проверить |
|------|---------------|
| T1 | `alembic upgrade head` — таблица departments, новые колонки в team_members, роли обновлены |
| T2 | CRUD /departments, GET /team/tree, POST /team/{id}/avatar, require_admin работает |
| T3 | Бот /start показывает 3 роли, /help разный для каждой |
| T4 | `npm run build` без ошибок, RoleBadge admin с короной |
| T5 | Дерево команды, карточки, детали, редактирование, аватары, отделы |
| T6 | Sidebar обновлён, все UserAvatar с фото, CLAUDE.md актуален |

### Telegram Mini App

| Фаза | Как проверить |
|------|---------------|
| MA1 | POST /api/auth/mini-app работает, /app в боте показывает кнопку |
| MA2 | `cd mini-app && npm run dev` работает, dev-login авторизует |
| MA3 | Список задач, фильтры, нижняя навигация |
| MA4 | Детали, смена статуса, создание задачи, апдейты |
| MA5 | Menu Button в боте, кнопки в уведомлениях, тема Telegram |
