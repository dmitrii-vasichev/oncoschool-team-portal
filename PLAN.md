# Онкошкола — Таск-менеджер с Telegram-ботом и веб-интерфейсом

## Обзор проекта

**Цель:** Система управления задачами для команды ~20 человек с двумя точками входа: Telegram-бот и веб-интерфейс. Автоматический парсинг Zoom AI Summary → создание задач → уведомления в Telegram.

**Ключевые возможности:**
- Telegram-бот как основная точка входа для команды
- Веб-интерфейс (dashboard) для визуального управления и аналитики
- AI-парсинг транскрипций Zoom-встреч → автоматическое создание задач
- **Создание задач голосом** — голосовое сообщение в Telegram (личка или групповой чат)
- История встреч с суммаризацией и привязанными задачами
- Двусторонняя синхронизация: изменения в Telegram отражаются в вебе и наоборот
- **Ролевая модель:** модератор (полный доступ) и участники (ограниченный)
- **Промежуточные статусы задач** с историей обновлений (task updates)
- **Ежедневные напоминания** — саммари задач каждому участнику в личные сообщения
- **Подписки на уведомления** — модератор получает уведомления о создании задач
- **Выбор AI-модели** — переключение между OpenAI / Anthropic / Gemini в настройках

**Стек:**
- **Backend:** Python 3.12, FastAPI, aiogram 3.x, APScheduler
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **База данных:** PostgreSQL (Supabase)
- **AI:** Мульти-провайдер — OpenAI / Anthropic / Google Gemini (настраивается)
- **Speech-to-Text:** OpenAI Whisper API
- **Деплой:** Vercel (frontend) + Railway (backend)

---

## Ролевая модель

### Роли

| Роль | Описание |
|------|----------|
| **moderator** | Полный доступ: создаёт/назначает задачи любому, управляет командой, настраивает напоминания, видит всё. Может подписаться на уведомления о создании задач другими. |
| **member** | Участник: создаёт задачи **только для себя**, видит свои задачи и общую доску, обновляет статусы своих задач, оставляет промежуточные апдейты. |

### Матрица прав

| Действие | moderator | member |
|----------|-----------|--------|
| Создать задачу себе | ✅ | ✅ |
| Создать задачу другому | ✅ | ❌ |
| Создать задачу голосом (себе) | ✅ | ✅ |
| Создать задачу голосом (другому) | ✅ | ❌ |
| Назначить/переназначить задачу | ✅ | ❌ |
| Просматривать все задачи | ✅ | ✅ (только просмотр) |
| Менять статус своей задачи | ✅ | ✅ |
| Менять статус чужой задачи | ✅ | ❌ |
| Добавлять task update (промежуточный статус) | ✅ | ✅ (к своим задачам) |
| Вставлять Zoom Summary / создавать встречу | ✅ | ❌ |
| Удалять задачи | ✅ | ❌ |
| Управлять командой (add/remove/role) | ✅ | ❌ |
| Настраивать напоминания | ✅ | ❌ |
| Подписка на уведомления о новых задачах | ✅ | ❌ |
| Получать ежедневный дайджест | ✅ (настраивает) | ✅ (получает) |
| Менять AI-модель в настройках | ✅ | ❌ |

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────────────┐
│                          КЛИЕНТЫ                                     │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────────────────────┐      │
│  │  Telegram Bot      │     │   Next.js Web Dashboard           │      │
│  │  (aiogram 3.x)     │     │   - Kanban-доска задач            │      │
│  │                    │     │   - История встреч                 │      │
│  │  Команды:          │     │   - Суммаризация встреч            │      │
│  │  /tasks /done      │     │   - Аналитика                      │      │
│  │  /summary /all     │     │   - Управление командой             │      │
│  │  /update /meetings │     │   - Настройки (AI, напоминания)     │      │
│  │  🎤 Голосовые      │     │                                    │      │
│  └────────┬─────────┘     └──────────────┬───────────────────┘      │
│           │                              │                           │
└───────────┼──────────────────────────────┼───────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                                  │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐      │
│  │ Bot Handlers │  │  REST API     │  │  AI Service             │      │
│  │ (aiogram)    │  │  (endpoints)  │  │  (multi-provider)       │      │
│  └──────┬──────┘  └──────┬───────┘  │  OpenAI / Anthropic /   │      │
│         │                │          │  Gemini                   │      │
│         │                │          └────────┬───────────────┘      │
│         ▼                ▼                   │                       │
│  ┌────────────────────────────────────────────┴───────────────┐      │
│  │               Service Layer (бизнес-логика)                  │      │
│  │  TaskService | MeetingService | TeamService                  │      │
│  │  NotificationService | ReminderService | PermissionService   │      │
│  │  VoiceService (Whisper STT)                                  │      │
│  └───────────────────────┬──────────────────────────────────┘      │
│                          │                                          │
│  ┌───────────────────────┴──────────────────────────────────┐      │
│  │            APScheduler (ежедневные напоминания)             │      │
│  └────────────────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Supabase)                              │
│                                                                       │
│  team_members │ tasks │ task_updates │ meetings │ meeting_participants │
│  notification_subscriptions │ reminder_settings │ app_settings          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Структура проекта

```
oncoschool-tasks/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI + aiogram + scheduler запуск
│   │   ├── config.py               # Pydantic Settings
│   │   ├── bot/
│   │   │   ├── __init__.py
│   │   │   ├── handlers/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── common.py       # /start, /help
│   │   │   │   ├── tasks.py        # /tasks, /done, /new, /assign
│   │   │   │   ├── task_updates.py  # /update — промежуточные статусы
│   │   │   │   ├── voice.py        # 🎤 Голосовые сообщения -> задачи
│   │   │   │   ├── summary.py      # /summary — парсинг Zoom summary
│   │   │   │   ├── meetings.py     # /meetings — история встреч
│   │   │   │   ├── admin.py        # /team, /addmember, /setrole, /reminders
│   │   │   │   └── settings.py     # /settings — подписки, напоминания
│   │   │   ├── keyboards.py        # Inline keyboards
│   │   │   ├── middlewares.py       # Авторизация, проверка ролей
│   │   │   └── filters.py          # Кастомные фильтры (IsModeratorFilter)
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # Главный роутер API
│   │   │   ├── tasks.py            # CRUD задач
│   │   │   ├── task_updates.py     # Промежуточные статусы
│   │   │   ├── meetings.py         # CRUD встреч
│   │   │   ├── team.py             # Управление командой
│   │   │   ├── summary.py          # Endpoint парсинга summary
│   │   │   ├── settings.py         # Настройки уведомлений/напоминаний/AI
│   │   │   └── auth.py             # Авторизация (Supabase Auth)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── task_service.py      # Бизнес-логика задач
│   │   │   ├── meeting_service.py   # Бизнес-логика встреч
│   │   │   ├── ai_service.py        # Мульти-провайдер AI (OpenAI/Anthropic/Gemini)
│   │   │   ├── voice_service.py     # Speech-to-Text (Whisper API)
│   │   │   ├── team_service.py      # Управление командой
│   │   │   ├── permission_service.py # Проверка прав по ролям
│   │   │   ├── notification_service.py  # Уведомления в Telegram
│   │   │   └── reminder_service.py  # Ежедневные дайджесты (scheduler)
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py          # Async engine, session
│   │   │   ├── models.py            # SQLAlchemy модели
│   │   │   ├── schemas.py           # Pydantic-схемы
│   │   │   └── repositories.py      # CRUD операции
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── helpers.py
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── .env.example
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Dashboard
│   │   │   ├── tasks/
│   │   │   │   ├── page.tsx         # Kanban-доска
│   │   │   │   └── [id]/page.tsx    # Детали задачи + task updates
│   │   │   ├── meetings/
│   │   │   │   ├── page.tsx         # Список встреч
│   │   │   │   └── [id]/page.tsx    # Детали встречи
│   │   │   ├── summary/
│   │   │   │   └── page.tsx         # Форма вставки Zoom summary
│   │   │   ├── team/
│   │   │   │   └── page.tsx         # Управление командой + роли
│   │   │   ├── settings/
│   │   │   │   └── page.tsx         # Настройки: AI модель, напоминания, подписки
│   │   │   └── analytics/
│   │   │       └── page.tsx         # Аналитика
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui
│   │   │   ├── tasks/
│   │   │   │   ├── TaskCard.tsx
│   │   │   │   ├── TaskBoard.tsx    # Kanban
│   │   │   │   ├── TaskFilters.tsx
│   │   │   │   ├── TaskDetail.tsx
│   │   │   │   └── TaskUpdates.tsx  # Timeline промежуточных обновлений
│   │   │   ├── meetings/
│   │   │   │   ├── MeetingCard.tsx
│   │   │   │   ├── MeetingList.tsx
│   │   │   │   └── MeetingDetail.tsx
│   │   │   ├── summary/
│   │   │   │   ├── SummaryForm.tsx
│   │   │   │   └── SummaryPreview.tsx
│   │   │   ├── settings/
│   │   │   │   ├── AIModelSettings.tsx   # Выбор AI-провайдера
│   │   │   │   ├── ReminderSettings.tsx
│   │   │   │   └── NotificationSettings.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   └── shared/
│   │   │       ├── StatusBadge.tsx
│   │   │       ├── PriorityBadge.tsx
│   │   │       ├── RoleBadge.tsx
│   │   │       └── UserAvatar.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── permissions.ts       # Проверка прав на фронте
│   │   │   └── utils.ts
│   │   └── hooks/
│   │       ├── useTasks.ts
│   │       ├── useMeetings.ts
│   │       ├── useTeam.ts
│   │       └── useCurrentUser.ts
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local.example
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Схема базы данных

```sql
-- ============================================
-- Участники команды
-- ============================================
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(100),
    full_name VARCHAR(200) NOT NULL,
    name_variants TEXT[] DEFAULT '{}',         -- Варианты имени для AI-матчинга
    role VARCHAR(50) DEFAULT 'member',         -- 'moderator' | 'member'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Задачи
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id SERIAL,                           -- Короткий ID (#42)
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'new',
    -- Статусы: new -> in_progress -> review -> done | cancelled
    priority VARCHAR(20) DEFAULT 'medium',     -- urgent | high | medium | low
    assignee_id UUID REFERENCES team_members(id),
    created_by_id UUID REFERENCES team_members(id),
    meeting_id UUID REFERENCES meetings(id),
    source VARCHAR(20) DEFAULT 'text',         -- text | voice | summary | web
    deadline DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Промежуточные обновления (task updates)
-- ============================================
CREATE TABLE task_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES team_members(id),
    content TEXT NOT NULL,                     -- Текст обновления
    update_type VARCHAR(30) DEFAULT 'progress',
    -- Типы: progress | status_change | comment | blocker | completion
    old_status VARCHAR(50),                    -- При status_change
    new_status VARCHAR(50),                    -- При status_change
    progress_percent INT,                      -- Опционально: 0-100%
    source VARCHAR(20) DEFAULT 'telegram',     -- telegram | web
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Встречи (Zoom)
-- ============================================
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500),
    raw_summary TEXT NOT NULL,                 -- Оригинальный Zoom AI Summary
    parsed_summary TEXT,                       -- AI-суммаризация
    decisions TEXT[],                           -- Принятые решения
    notes TEXT,
    meeting_date TIMESTAMPTZ,
    created_by_id UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meeting_participants (
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    PRIMARY KEY (meeting_id, member_id)
);

-- ============================================
-- Настройки уведомлений (подписки модератора)
-- ============================================
CREATE TABLE notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    -- task_created | task_status_changed | task_completed
    -- task_overdue | task_update_added | meeting_created
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, event_type)
);

-- ============================================
-- Настройки ежедневных напоминаний
-- ============================================
CREATE TABLE reminder_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    reminder_time TIME DEFAULT '09:00',
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    days_of_week INT[] DEFAULT '{1,2,3,4,5}',  -- 1=Пн ... 7=Вс
    include_overdue BOOLEAN DEFAULT true,
    include_upcoming BOOLEAN DEFAULT true,     -- Ближайшие 3 дня
    include_in_progress BOOLEAN DEFAULT true,
    configured_by_id UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id)
);

-- ============================================
-- Глобальные настройки приложения
-- ============================================
-- Key-value хранилище для настроек, управляемых модератором.
-- Хранит выбранную AI-модель и другие глобальные параметры.
CREATE TABLE app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by_id UUID REFERENCES team_members(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Начальные значения
INSERT INTO app_settings (key, value) VALUES
('ai_provider', '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}'),
('ai_providers_config', '{
    "anthropic": {
        "models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
        "default": "claude-sonnet-4-20250514"
    },
    "openai": {
        "models": ["gpt-4o", "gpt-4o-mini"],
        "default": "gpt-4o"
    },
    "gemini": {
        "models": ["gemini-2.0-flash", "gemini-2.0-pro"],
        "default": "gemini-2.0-flash"
    }
}');

-- ============================================
-- Индексы
-- ============================================
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_meeting ON tasks(meeting_id);
CREATE INDEX idx_tasks_short_id ON tasks(short_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_source ON tasks(source);
CREATE INDEX idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX idx_team_telegram ON team_members(telegram_id);
CREATE INDEX idx_task_updates_task ON task_updates(task_id);
CREATE INDEX idx_task_updates_created ON task_updates(created_at DESC);
CREATE INDEX idx_notification_subs_member ON notification_subscriptions(member_id);
CREATE INDEX idx_reminder_enabled ON reminder_settings(is_enabled) WHERE is_enabled = true;
```

---

## Фазы реализации

---

### Фаза 1: Инициализация проекта и база данных

**Цель:** Создать структуру проекта, модели БД, миграции, сервис проверки прав.

**Промпт для Claude Code:**

```
Создай Python-проект для таск-менеджера Онкошколы. Структура backend/:

backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Точка входа
│   ├── config.py             # Pydantic Settings
│   ├── bot/                  # (пока пустой __init__.py)
│   ├── api/                  # (пока пустой __init__.py)
│   ├── services/
│   │   ├── __init__.py
│   │   └── permission_service.py  # Проверка прав по ролям
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py       # Async SQLAlchemy engine + session
│   │   ├── models.py         # Все модели
│   │   ├── schemas.py        # Pydantic-схемы
│   │   └── repositories.py   # CRUD
│   └── utils/
├── alembic/
├── alembic.ini
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md

Зависимости (pyproject.toml):
- fastapi, uvicorn[standard]
- aiogram>=3.4
- sqlalchemy[asyncio]>=2.0, asyncpg
- alembic
- pydantic-settings
- anthropic
- openai              # для Whisper STT + GPT
- google-genai        # для Gemini
- python-dotenv
- httpx
- apscheduler>=3.10

.env.example:
BOT_TOKEN=
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
ADMIN_TELEGRAM_IDS=123456789
ALLOWED_CHAT_IDS=
TIMEZONE=Europe/Moscow

config.py:
- Pydantic Settings с валидацией
- ADMIN_TELEGRAM_IDS как list[int]
- Все три API-ключа опциональные (хотя бы один обязателен)
- OPENAI_API_KEY обязателен (нужен для Whisper STT)

models.py — создай ВСЕ модели (SQLAlchemy 2.0, mapped_column):

1. TeamMember:
   - id: UUID PK
   - telegram_id: BigInteger, unique, nullable
   - telegram_username: String(100), nullable
   - full_name: String(200), not null
   - name_variants: ARRAY(String), default=[]
   - role: String(50), default="member"  # "moderator" | "member"
   - is_active: Boolean, default=True
   - created_at, updated_at: DateTime with timezone
   - relationships: tasks, created_tasks, task_updates,
     notification_subscriptions, reminder_settings

2. Task:
   - id: UUID PK
   - short_id: Integer, autoincrement
   - title: String(300), not null
   - description: Text, nullable
   - status: String(50), default="new"
   - priority: String(20), default="medium"
   - assignee_id: FK -> TeamMember, nullable
   - created_by_id: FK -> TeamMember, nullable
   - meeting_id: FK -> Meeting, nullable
   - source: String(20), default="text"  # text | voice | summary | web
   - deadline: Date, nullable
   - completed_at: DateTime, nullable
   - created_at, updated_at: DateTime with timezone
   - relationships: assignee, created_by, meeting, updates

3. TaskUpdate:
   - id: UUID PK
   - task_id: FK -> Task, cascade delete
   - author_id: FK -> TeamMember
   - content: Text, not null
   - update_type: String(30), default="progress"
   - old_status, new_status: String(50), nullable
   - progress_percent: Integer, nullable
   - source: String(20), default="telegram"
   - created_at: DateTime with timezone

4. Meeting:
   - id: UUID PK
   - title: String(500), nullable
   - raw_summary: Text, not null
   - parsed_summary: Text, nullable
   - decisions: ARRAY(String), default=[]
   - notes: Text, nullable
   - meeting_date: DateTime with timezone, nullable
   - created_by_id: FK -> TeamMember, nullable
   - created_at: DateTime with timezone

5. MeetingParticipant: meeting_id + member_id (composite PK)

6. NotificationSubscription:
   - id: UUID PK
   - member_id: FK -> TeamMember, cascade delete
   - event_type: String(50), not null
   - is_active: Boolean, default=True
   - unique: (member_id, event_type)

7. ReminderSettings:
   - id: UUID PK
   - member_id: FK -> TeamMember, cascade delete, unique
   - is_enabled, reminder_time, timezone, days_of_week
   - include_overdue, include_upcoming, include_in_progress
   - configured_by_id: FK -> TeamMember

8. AppSettings:
   - key: String(100), PK
   - value: JSONB, not null
   - updated_by_id: FK -> TeamMember, nullable
   - updated_at: DateTime with timezone

permission_service.py:

class PermissionService:
    @staticmethod
    def is_moderator(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_create_task_for_others(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_assign_task(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_change_task_status(member, task) -> bool:
        if member.role == "moderator": return True
        return task.assignee_id == member.id

    @staticmethod
    def can_add_task_update(member, task) -> bool:
        if member.role == "moderator": return True
        return task.assignee_id == member.id

    @staticmethod
    def can_delete_task(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_manage_team(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_submit_summary(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_configure_reminders(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_subscribe_notifications(member) -> bool:
        return member.role == "moderator"

    @staticmethod
    def can_change_ai_settings(member) -> bool:
        return member.role == "moderator"

schemas.py:
- TaskCreate, TaskUpdate (edit), TaskResponse
- TaskUpdateCreate, TaskUpdateResponse
- MeetingCreate, MeetingResponse
- TeamMemberCreate, TeamMemberResponse
- NotificationSubscriptionCreate/Response
- ReminderSettingsCreate/Update/Response
- AppSettingsResponse, AIProviderUpdate
- Все с model_config = ConfigDict(from_attributes=True)

repositories.py:
- TaskRepository, TaskUpdateRepository, MeetingRepository,
  TeamMemberRepository, NotificationSubscriptionRepository,
  ReminderSettingsRepository, AppSettingsRepository
- AppSettingsRepository: get(key), set(key, value, updated_by_id)

Настрой Alembic для async. Создай начальную миграцию.
Добавь seed данные для app_settings (ai_provider, ai_providers_config).
```

**Результат:** Проект с БД, моделями, миграциями, сервис прав.

---

### Фаза 2: Telegram-бот — базовые команды и авторизация с ролями

**Цель:** Бот с ролевой авторизацией.

**Промпт для Claude Code:**

```
В backend/ создай Telegram-бота на aiogram 3.x (polling).

app/bot/middlewares.py:
- AuthMiddleware: проверяет telegram_id в team_members,
  авторегистрация с role="member", добавляет member в data
- Если telegram_id в ADMIN_TELEGRAM_IDS -> role="moderator"

app/bot/filters.py:
- IsModeratorFilter: пропускает только модераторов

app/bot/handlers/common.py:

/start — приветствие + регистрация:
  "Привет, {имя}! Я бот-задачник Онкошколы.
   Твоя роль: 👑 Модератор / 👤 Участник
   /help — список команд"

/help — ЗАВИСИТ ОТ РОЛИ:
  Для всех:
    /tasks — мои задачи
    /all — все задачи команды
    /new <текст> — создать задачу себе
    /done <id> — завершить задачу
    /update <id> <текст> — промежуточный апдейт
    /status <id> <статус> — изменить статус
    🎤 Голосовое сообщение — создать задачу голосом

  Только модераторам:
    /assign @username <текст> — назначить задачу
    /summary — обработать Zoom Summary
    /meetings — история встреч
    /team — управление командой
    /setrole @username <роль> — назначить роль
    /reminders — настройки напоминаний
    /subscribe — подписки на уведомления
    /aimodel — текущая AI-модель
    /stats — статистика

app/bot/keyboards.py:
- task_actions_keyboard(task_id, is_moderator)
  Все: "✅ Done" | "▶️ В работу" | "👀 Ревью" | "📝 Апдейт"
  Модератор: + "❌ Отменить" | "🔄 Переназначить"
- confirm_keyboard(), pagination_keyboard()
- voice_task_confirm_keyboard(task_data) — для подтверждения
  голосовой задачи: [✅ Создать] [✏️ Изменить] [❌ Отмена]

main.py: FastAPI + aiogram polling + APScheduler параллельно.
```

**Результат:** Бот с ролями, /start, /help.

---

### Фаза 3: Telegram-бот — управление задачами с ролями

**Цель:** Полное управление задачами с проверкой прав.

**Промпт для Claude Code:**

```
Создай app/bot/handlers/tasks.py и app/services/task_service.py.

task_service.py:
- create_task(source="text"): если assignee != creator,
  проверяет что creator — модератор. source хранит откуда задача.
- get_my_tasks(), get_all_active_tasks()
- complete_task(): участник — только свою, модератор — любую.
  Автоматически создаёт TaskUpdate(type=completion)
- update_status(): проверка прав. Автоматический TaskUpdate(type=status_change)
- assign_task(): только модератор

notification_service.py:
- notify_task_created(): уведомить assignee + подписчиков task_created
- notify_status_changed(): если участник -> модераторам, если модератор -> assignee
- notify_task_update_added(): подписчикам task_update_added
- notify_task_completed(): подписчикам task_completed

Хендлеры tasks.py:

1. /tasks — мои задачи, группировка по статусам
   "#42 · Заголовок · ⚡ high · 📅 15.02 (3 обновления)"
   Если source=voice: показать иконку 🎤
   Inline-кнопки

2. /all — все задачи команды (view-only для member)

3. /new <текст> — создать задачу:
   Member: ТОЛЬКО себе. Парсинг: !high, !urgent, @25.02
   source="text"
   -> уведомить подписчиков task_created

4. /assign @username <текст> — ТОЛЬКО МОДЕРАТОР
   IsModeratorFilter. source="text"

5. /done <id> — member свою, moderator любую

6. /status <id> <статус> — проверка прав

7. Callback handlers для inline кнопок с проверкой прав
```

**Результат:** Задачи с ролевым контролем.

---

### Фаза 4: Промежуточные обновления (Task Updates)

**Цель:** Участники фиксируют прогресс, модераторы видят историю.

**Промпт для Claude Code:**

```
Создай app/bot/handlers/task_updates.py.

Добавь в task_service.py:
- add_task_update(): проверяет права (assignee или модератор)
- get_task_updates(): все обновления по задаче

Хендлеры:

1. /update <id> <текст> — промежуточный апдейт:
   Проверка: assignee или модератор
   Опционально: /update 42 50% Половина готова
   -> уведомить подписчиков task_update_added

2. /updates <id> — timeline обновлений

3. /blocker <id> <текст> — отметить блокер (shortcut)

4. Inline-кнопка "📝 Апдейт" -> FSM -> текст -> TaskUpdate
```

**Результат:** Система промежуточных обновлений.

---

### Фаза 5: AI-сервис — мульти-провайдер (OpenAI / Anthropic / Gemini)

**Цель:** Единый AI-сервис с переключаемым провайдером. Парсинг Zoom Summary.

**Промпт для Claude Code:**

```
Создай app/services/ai_service.py — мульти-провайдер AI.

Архитектура — паттерн Strategy:

class AIProvider(ABC):
    """Абстрактный провайдер."""
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        """Отправить запрос и получить текстовый ответ."""

class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt, user_prompt) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        return response.content[0].text

class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt, user_prompt) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        return response.choices[0].message.content

class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def complete(self, system_prompt, user_prompt) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt
            )
        )
        return response.text

class AIService:
    """Основной сервис — делегирует текущему провайдеру."""

    def __init__(self, config: Settings):
        self.config = config
        self.providers = {}
        # Инициализировать только тех, для кого есть ключи
        if config.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = lambda model: AnthropicProvider(
                config.ANTHROPIC_API_KEY, model)
        if config.OPENAI_API_KEY:
            self.providers["openai"] = lambda model: OpenAIProvider(
                config.OPENAI_API_KEY, model)
        if config.GOOGLE_API_KEY:
            self.providers["gemini"] = lambda model: GeminiProvider(
                config.GOOGLE_API_KEY, model)

    async def _get_current_provider(self, session) -> AIProvider:
        """Читает текущий провайдер из app_settings и создаёт экземпляр."""
        settings_repo = AppSettingsRepository()
        setting = await settings_repo.get(session, "ai_provider")
        provider_name = setting.value["provider"]
        model = setting.value["model"]
        if provider_name not in self.providers:
            raise ValueError(f"Провайдер {provider_name} не настроен (нет API ключа)")
        return self.providers[provider_name](model)

    async def parse_meeting_summary(
        self, session, summary_text: str, team_members: list
    ) -> ParsedMeeting:
        """Парсит Zoom Summary через текущий AI-провайдер."""
        provider = await self._get_current_provider(session)
        team_json = json.dumps([
            {"name": m.full_name, "variants": m.name_variants}
            for m in team_members
        ], ensure_ascii=False)

        response = await provider.complete(
            system_prompt=MEETING_SUMMARY_PROMPT.format(
                team_members_json=team_json
            ),
            user_prompt=summary_text
        )
        # Парсинг JSON, retry, валидация Pydantic
        return self._parse_json_response(response)

    async def parse_task_from_text(
        self, session, text: str, author_name: str,
        is_moderator: bool, team_members: list
    ) -> ParsedVoiceTask:
        """
        Извлекает задачу из произвольного текста (после STT).
        Для модератора — может назначить другому.
        Для участника — только себе.
        """
        provider = await self._get_current_provider(session)
        prompt = VOICE_TASK_PROMPT.format(
            author_name=author_name,
            is_moderator=str(is_moderator),
            team_members_json=json.dumps([...])
        )
        response = await provider.complete(
            system_prompt=prompt,
            user_prompt=text
        )
        return self._parse_voice_task(response)

    async def get_available_providers(self) -> dict:
        """Возвращает список доступных провайдеров (у кого есть ключи)."""
        return {name: True for name in self.providers}

    def _parse_json_response(self, text: str):
        """Убирает ```json``` обёртку, парсит, валидирует."""
        ...

---

Промпты:

MEETING_SUMMARY_PROMPT = """
Ты — ассистент для извлечения задач из протоколов встреч.
[тот же промпт что был раньше]
"""

VOICE_TASK_PROMPT = """
Ты — ассистент для создания задач из голосовых сообщений.

Пользователь: {author_name}
Роль: {"модератор" if is_moderator else "участник"}

Из текста извлеки задачу. Ответь JSON:
{{
  "title": "краткое название до 100 символов",
  "description": "описание если есть доп. контекст, иначе null",
  "assignee_name": "имя исполнителя если упомянут, иначе null",
  "priority": "low | medium | high | urgent",
  "deadline": "YYYY-MM-DD если упомянут, иначе null"
}}

Правила:
- Если пользователь — участник (не модератор), assignee_name всегда null
  (задача будет назначена на него самого)
- Если пользователь — модератор и упомянул другого человека, сопоставь
  с участниками: {team_members_json}
- Определи приоритет по контексту: "срочно", "важно" -> high/urgent,
  "когда будет время" -> low
- Извлеки дедлайн из фраз: "до пятницы", "к 1 марта", "на этой неделе"
  (сегодня: текущая_дата)
"""

Retry с exponential backoff (макс 3 попытки) для всех провайдеров.
Валидация через Pydantic (ParsedMeeting, ParsedTask, ParsedVoiceTask).

---

Также создай app/bot/handlers/summary.py — ТОЛЬКО модератор:

FSM: /summary -> текст -> парсинг -> превью -> подтверждение
(то же что было, но использует ai_service с текущим провайдером)
```

**Результат:** Мульти-провайдер AI + парсинг Zoom Summary.

---

### Фаза 6: Создание задач голосом

**Цель:** Голосовое сообщение в Telegram → распознавание → AI-парсинг → задача.

**Промпт для Claude Code:**

```
Создай app/services/voice_service.py и app/bot/handlers/voice.py.

voice_service.py:

class VoiceService:
    def __init__(self, openai_api_key: str):
        self.client = openai.AsyncOpenAI(api_key=openai_api_key)

    async def transcribe(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        """
        Отправляет аудио в Whisper API, возвращает текст.
        Whisper API используется ВСЕГДА (независимо от выбранного AI-провайдера),
        т.к. это отдельный сервис speech-to-text.
        """
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru"  # Основной язык — русский
        )
        return transcript.text

---

voice.py — хендлер голосовых сообщений:

Работает и в личке с ботом, и в групповом чате.

Для группового чата: бот обрабатывает голосовые только если:
  - Голосовое отправлено как reply на сообщение бота
  - ИЛИ бот упомянут в подписи (caption)
  - ИЛИ можно настроить: обрабатывать ВСЕ голосовые в разрешённых чатах
    (через ALLOWED_CHAT_IDS — более удобно для небольшой команды)

Flow:

1. Пользователь отправляет голосовое сообщение (Voice или VideoNote)

2. Бот:
   a) Скачивает файл через Telegram Bot API (bot.download_file)
   b) "🎤 Распознаю голосовое..."
   c) voice_service.transcribe(audio_bytes) -> текст
   d) Показывает распознанный текст:
      "📝 Распознано: «{текст}»"
   e) "⏳ Извлекаю задачу..."
   f) ai_service.parse_task_from_text(текст, author, is_moderator, team)
      -> ParsedVoiceTask
   g) Показывает превью:
      "🎤 Задача из голосового:

       📌 {title}
       📝 {description}
       👤 Исполнитель: {assignee или "Ты"}
       ⚡ Приоритет: {priority}
       📅 Дедлайн: {deadline или "—"}

       [✅ Создать] [✏️ Изменить] [❌ Отмена]"

3. Пользователь нажимает:
   - ✅ Создать -> task_service.create_task(source="voice")
     -> уведомления
     -> "✅ Задача #{id} создана из голосового!"

   - ✏️ Изменить -> FSM: показать поля для редактирования
     (inline-кнопки: "Название" | "Приоритет" | "Дедлайн" | "Описание")
     Пользователь выбирает поле -> вводит новое значение -> обновлённый превью
     -> [✅ Создать] [✏️ Ещё изменить] [❌ Отмена]

   - ❌ Отмена -> "Задача отменена."

4. Ролевые ограничения:
   - Member: assignee всегда = сам пользователь. Если AI извлёк
     другого человека -> игнорируется, задача на автора.
   - Moderator: если AI извлёк assignee и он найден в team_members
     -> задача назначается на него. Иначе на модератора.

5. Обработка ошибок:
   - Whisper не распознал (пустой текст) -> "❌ Не удалось распознать.
     Попробуй записать ещё раз, говори чётче."
   - AI не извлёк задачу -> "❌ Не удалось извлечь задачу. Попробуй
     сформулировать конкретнее, например: «Подготовить отчёт до пятницы»"
   - Файл слишком большой (>20MB) -> "❌ Голосовое слишком длинное.
     Максимум ~10 минут."

Важно:
- НЕ сохранять аудиофайл, только распознанный текст
- Текст распознавания сохранять в task.description (начало:
  "🎤 Из голосового: {оригинальный текст}")
- Whisper API поддерживает .ogg (Telegram формат) напрямую
- Ограничение Whisper: 25MB файл. Telegram voice обычно <1MB,
  так что проблем не будет
- В групповом чате при обработке всех голосовых (ALLOWED_CHAT_IDS)
  бот должен ответить reply на голосовое сообщение, а не отдельным
```

**Результат:** Голосовые сообщения -> задачи.

---

### Фаза 7: Подписки на уведомления и ежедневные напоминания

**Цель:** Модератор подписывается на события, настраивает дайджесты.

**Промпт для Claude Code:**

```
Создай app/bot/handlers/settings.py и app/services/reminder_service.py.

settings.py:

1. /subscribe — ТОЛЬКО модератор:
   Toggle для каждого типа событий
   Inline кнопки вкл/выкл

2. /reminders — ТОЛЬКО модератор:
   Список участников с настройками
   Настройка каждому: вкл/выкл, время, дни, что включать
   Массовая настройка "Включить всем"

3. /myreminder — участник видит свои настройки (без редактирования)

4. /aimodel — ТОЛЬКО модератор:
   Показать текущий провайдер и модель:
   "🤖 Текущая AI-модель:
    Провайдер: Anthropic
    Модель: claude-sonnet-4-20250514

    Доступные провайдеры:
    [Anthropic ✅] [OpenAI] [Gemini]"

   При выборе провайдера -> показать доступные модели ->
   сохранить в app_settings

reminder_service.py:

class ReminderService:
    - start(): APScheduler, проверка каждую минуту
    - _check_and_send_reminders(): для enabled: проверить время/день -> отправить
    - _send_daily_digest(member, settings): форматированный дайджест
    - _check_overdue_tasks(): раз в час, уведомить подписчиков
    - Хранить "отправлено сегодня" в памяти

Формат дайджеста:
"📊 Ежедневный дайджест — 15 февраля

 🔴 Просроченные (2):
 #42 · Отчёт · 📅 был 13.02 · ⚡ high

 📅 Ближайшие (3 дня):
 #45 · Ревью · 📅 16.02 · ⚡ medium

 🔄 В работе (3):
 #42 · Отчёт · ⚡ high · 50%

 🆕 Новые (1):
 #49 · README · ⚡ low

 Всего: 9 | Завершено вчера: 2 💪"
```

**Результат:** Подписки + дайджесты + смена AI-модели в Telegram.

---

### Фаза 8: REST API для веб-интерфейса

**Цель:** API endpoints с проверкой ролей.

**Промпт для Claude Code:**

```
Создай REST API в app/api/.

auth.py: Supabase Auth (JWT), get_current_user(), require_moderator()

tasks.py:
- GET /api/tasks — фильтры: assignee, status, priority, meeting,
  search, source, has_overdue, page, per_page, sort
- GET /api/tasks/{short_id} — детали + task_updates
- POST /api/tasks — если assignee != me -> require_moderator
  -> notify в Telegram
- PATCH /api/tasks/{short_id} — проверка прав
- DELETE /api/tasks/{short_id} — require_moderator

task_updates.py:
- GET /api/tasks/{short_id}/updates — timeline
- POST /api/tasks/{short_id}/updates — assignee или moderator

meetings.py:
- GET /api/meetings, GET /api/meetings/{id}
- POST /api/meetings/parse-summary — require_moderator
- POST /api/meetings — require_moderator
- DELETE /api/meetings/{id} — require_moderator

team.py:
- GET /api/team, PATCH /api/team/{id} — require_moderator

settings.py:
- GET/PUT /api/settings/notifications — подписки (moderator)
- GET/PUT /api/settings/reminders/{member_id} — (moderator)
- POST /api/settings/reminders/bulk — массовая (moderator)
- GET /api/settings/ai — текущий AI-провайдер и доступные модели
- PUT /api/settings/ai — сменить провайдер/модель (moderator):
  { "provider": "openai", "model": "gpt-4o" }
  Валидация: провайдер доступен (есть ключ), модель валидна

analytics.py:
- GET /api/analytics/overview, /members, /meetings

CORS для localhost:3000 + production.
```

**Результат:** Полный API с ролями и настройкой AI.

---

### Фаза 9: Frontend — каркас, навигация, роли

**Цель:** Next.js с ролевой навигацией.

**Промпт для Claude Code:**

```
Создай Next.js 14 (App Router) в frontend/.
TypeScript, Tailwind CSS, shadcn/ui.

src/lib/permissions.ts — зеркалит PermissionService
src/hooks/useCurrentUser.ts — пользователь + роль

layout.tsx — Sidebar зависит от роли:
  Все: Dashboard, Задачи, Встречи, Аналитика
  Модератор: + Summary, Команда, Настройки

page.tsx (Dashboard):
- Карточки overview
- Мои задачи (последние 5), пометка 🎤 для голосовых
- Просроченные (красным)
- Последние встречи
- Модератор: + "Неназначенные задачи"

/summary, /team, /settings -> redirect если не модератор
```

---

### Фаза 10: Frontend — Kanban с task updates

**Промпт для Claude Code:**

```
/tasks — Kanban-доска с 4 колонками.

TaskCard: #id, title, assignee, priority, deadline,
  прогресс-бар, кол-во обновлений, иконка 🎤 если source=voice,
  красная рамка если просрочено

Модератор: "➕ Задача" с выбором assignee
Участник: "➕ Задача" только себе

/tasks/[id] — детали + TaskUpdates timeline +
  кнопка "➕ Обновление"
  Если source=voice — показать "🎤 Создана голосом"
  Оригинальный текст из description
```

---

### Фаза 11: Frontend — встречи, summary, команда, настройки

**Промпт для Claude Code:**

```
/meetings — список встреч (все)
/meetings/[id] — табы: Резюме | Задачи | Оригинал

/summary — ТОЛЬКО модератор:
- Textarea + "Обработать" -> превью + редактирование -> создать
- Показывать текущий AI-провайдер: "Обработка через: Anthropic (claude-sonnet)"

/team — ТОЛЬКО модератор:
- Таблица с ролями, name_variants

/settings — ТОЛЬКО модератор, три секции:

1. "🤖 AI-модель для парсинга":
   Радиокнопки провайдера:
   ○ Anthropic  ● OpenAI  ○ Gemini
   (Недоступные серым: "нет API ключа")

   Dropdown модели (зависит от провайдера):
   [claude-sonnet-4-20250514 ▼]

   Кнопка "Сохранить"

   Примечание: "Whisper (распознавание голоса) всегда использует
   OpenAI независимо от выбранного провайдера."

2. "🔔 Подписки на уведомления":
   Toggle для каждого типа

3. "⏰ Напоминания команды":
   Таблица + настройка + "Включить всем"
```

---

### Фаза 12: Аналитика и деплой

**Промпт для Claude Code:**

```
1. /analytics: карточки, графики, таблица участников
   Модератор: кто не обновлял >3 дней
   Статистика по источникам задач (text/voice/summary/web)

2. Telegram /meetings, /stats

3. Docker: docker-compose.yml, Dockerfile

4. Деплой: Vercel + Railway, README

5. Проверка:
   - member голосовое -> задача себе, модератор уведомлён
   - moderator голосовое с упоминанием имени -> задача другому
   - member /assign -> отказ
   - member /summary -> отказ
   - смена AI-модели через /aimodel и через веб-настройки
   - дайджест приходит в назначенное время
```

---

## Порядок работы с Claude Code

1. **Одна фаза за сессию.** Перед каждой: "Прочитай проект и план, фаза N."
2. **Тест после каждой фазы** (см. чеклист ниже)
3. **При ошибках** — описывай конкретно, не правь руками
4. **Новая сессия** если контекст перегружен

### Чеклист тестирования

| Фаза | Проверка |
|------|----------|
| 1 | `alembic upgrade head` без ошибок, seed data в app_settings |
| 2 | /start показывает роль, /help зависит от роли |
| 3 | /new создаёт задачу, /assign только у модератора |
| 4 | /update добавляет апдейт, /updates показывает timeline |
| 5 | AI-сервис работает с настроенным провайдером, /summary парсит |
| 6 | Голосовое -> распознавание -> превью -> задача (в ЛС и в группе) |
| 7 | /reminders настраивает, дайджест приходит, /aimodel меняет модель |
| 8 | API на /docs, ролевые проверки, PUT /api/settings/ai |
| 9-11 | Фронтенд с ролевым доступом, настройки AI-модели |
| 12 | Всё вместе, деплой |

### Переменные окружения

```env
BOT_TOKEN=                         # @BotFather
ADMIN_TELEGRAM_IDS=123456789       # Telegram ID модераторов
DATABASE_URL=postgresql+asyncpg://...
ANTHROPIC_API_KEY=sk-ant-...       # Опционально (хотя бы 1 из 3)
OPENAI_API_KEY=sk-...              # Обязателен (Whisper STT)
GOOGLE_API_KEY=...                 # Опционально
ALLOWED_CHAT_IDS=                  # ID групповых чатов для голосовых
TIMEZONE=Europe/Moscow
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Локальный запуск

```bash
# Backend
cd backend && cp .env.example .env
pip install -e .
alembic upgrade head
python -m app.main

# Frontend
cd frontend && cp .env.local.example .env.local
npm install && npm run dev
```

---

## Приоритеты

1. **MVP (фазы 1-5):** Бот + роли + задачи + updates + AI-парсинг
2. **Голос (фаза 6):** Создание задач голосом
3. **Напоминания (фаза 7):** Дайджесты + смена AI-модели
4. **API (фаза 8):** Подготовка к вебу
5. **Веб-интерфейс (фазы 9-11):** Dashboard, Kanban, встречи, настройки
6. **Полировка (фаза 12):** Аналитика, деплой
