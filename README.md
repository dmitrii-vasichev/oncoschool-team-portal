# Онкошкола — Таск-менеджер

Система управления задачами для команды ~20 человек с двумя точками входа: **Telegram-бот** и **веб-интерфейс**.

## Возможности

- Telegram-бот для управления задачами (создание, назначение, статусы)
- Inline UX в Telegram для задач: `/tasks` + кнопки фильтров, пагинации и карточки задачи
- Создание задач голосом (Whisper STT + AI-парсинг)
- AI-парсинг Zoom Summary — автоматическое создание задач из протоколов встреч
- Kanban-доска в веб-интерфейсе
- Промежуточные обновления (task updates) с timeline
- Ролевая модель: admin / moderator / member
- Ежедневные дайджесты и напоминания
- Аналитика с графиками
- Мульти-провайдер AI: OpenAI / Anthropic / Gemini

## Стек

| Компонент | Технологии |
|-----------|------------|
| **Backend** | Python 3.12, FastAPI, aiogram 3.x, SQLAlchemy 2.0, APScheduler |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, recharts |
| **БД** | PostgreSQL (Supabase) |
| **AI** | OpenAI / Anthropic / Gemini (переключаемый), Whisper STT |
| **Деплой** | Vercel (frontend) + Railway (backend) |

## Быстрый старт

### Локальная разработка

```bash
# 1. Backend
cd backend
cp .env.example .env   # заполнить переменные
pip install -e .
alembic upgrade head
python -m app.main

# 2. Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### Docker

```bash
# Заполнить backend/.env
cp backend/.env.example backend/.env

# Запуск всех сервисов
docker compose up --build
```

Backend: http://localhost:8000 (API docs: http://localhost:8000/docs)
Frontend: http://localhost:3000

## Учет изменений (Change Log)

В проекте используется подход с change-фрагментами:

- каждый релевантный change хранится отдельным файлом в `.changes/`;
- итоговый `CHANGELOG.md` собирается автоматически из этих фрагментов.

### Режимы записи

- `business` — изменение нужно для бизнес-отчета;
- `internal` — внутреннее тех. изменение;
- `none` — change-фрагмент не создаем.

### Команды

```bash
# Создать фрагмент изменения
make change-add ARGS="--scope business --task ONCO-142 --type feature --area 'Расписание' --summary 'Добавили автоподбор слота врача' --business-value 'Сократили время записи пациента' --risk low"

# Собрать CHANGELOG.md из .changes/*.md
make change-build
```

### Быстрые команды для Codex

Можно просто писать в чат:

- `внеси это в change` -> будет создан `business` change;
- `внеси это в change internal` -> будет создан `internal` change;
- `не вноси в change` -> запись не создается.

## Переменные окружения

### Backend (`backend/.env`)

| Переменная | Описание | Обязательная |
|------------|----------|:----:|
| `BOT_TOKEN` | Telegram Bot Token от @BotFather | да |
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) | да |
| `OPENAI_API_KEY` | OpenAI API key (Whisper STT + GPT) | да |
| `ANTHROPIC_API_KEY` | Anthropic API key | нет |
| `GOOGLE_API_KEY` | Google Gemini API key | нет |
| `ADMIN_TELEGRAM_IDS` | Telegram ID администраторов через запятую | да |
| `ALLOWED_CHAT_IDS` | ID групповых чатов для голосовых задач | нет |
| `JWT_SECRET` | Секрет для JWT (авто-генерация из BOT_TOKEN) | нет |
| `TIMEZONE` | Часовой пояс (default: Europe/Moscow) | нет |
| `CORS_ORIGINS` | JSON-массив разрешённых origins | нет |

### Frontend (`frontend/.env.local`)

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_API_URL` | URL бэкенда (default: http://localhost:8000) |

## Деплой

### Railway (Backend)

1. Создать проект в [Railway](https://railway.app)
2. Добавить PostgreSQL сервис
3. Подключить GitHub-репозиторий, указать root directory: `backend`
4. Установить переменные окружения (см. таблицу выше)
5. `DATABASE_URL` — из Railway PostgreSQL сервиса (заменить `postgresql://` на `postgresql+asyncpg://`)
6. Добавить `CORS_ORIGINS` с URL фронтенда на Vercel

### Vercel (Frontend)

1. Импортировать репозиторий в [Vercel](https://vercel.com)
2. Root directory: `frontend`
3. Framework preset: Next.js
4. Добавить переменную `NEXT_PUBLIC_API_URL` = URL бэкенда на Railway

## Структура проекта

```
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI + aiogram + APScheduler
│   │   ├── config.py         # Pydantic Settings
│   │   ├── bot/handlers/     # Telegram-бот хендлеры
│   │   ├── api/              # REST API endpoints
│   │   ├── services/         # Бизнес-логика
│   │   └── db/               # Модели, репозитории, миграции
│   ├── alembic/              # Миграции
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router страницы
│   │   ├── components/       # React-компоненты
│   │   ├── lib/              # API-клиент, типы, утилиты
│   │   └── hooks/            # React-хуки
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Команды бота

Задачи в Telegram работают в inline-режиме: команда `/tasks` открывает список с кнопками фильтрации, пагинации и переходом в карточку задачи.

### Для всех
| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + регистрация |
| `/help` | Список команд |
| `/tasks` | Мои задачи |
| `/all` | Задачи отдела/компании (зависит от роли) |
| `/new <текст>` | Создать задачу себе |
| `/done <id>` | Завершить задачу |
| `/update <id> <текст>` | Промежуточный апдейт |
| `/status <id> <статус>` | Изменить статус |
| `/myreminder` | Мои настройки напоминаний |
| Голосовое сообщение | Создать задачу голосом |

### Только модератор
| Команда | Описание |
|---------|----------|
| `/assign @user <текст>` | Назначить задачу |
| `/summary` | Обработать Zoom Summary |
| `/meetings` | История встреч |
| `/stats` | Статистика команды |
| `/reminders` | Настройки напоминаний |
| `/subscribe` | Подписки на уведомления |
| `/aimodel` | Текущая AI-модель |

## Права видимости задач (финальный контракт)

| Роль / сценарий | Web Dashboard | Web `/tasks` + API `/api/tasks` | Telegram `/tasks` | Telegram `/all` |
|---|---|---|---|---|
| `member` с отделом | Большие цифры: мои задачи. Малые: выбранный доступный отдел (обычно свой). Блок задач: только «мои». | Видит задачи своего отдела. Фильтры работают только в доступном скоупе. | Только свои задачи. | Задачи своего отдела. |
| `member` без отдела | Большие цифры: мои задачи. Малые/отдел: не выбраны (0). | Fallback: только свои задачи (даже при попытке фильтра по чужому отделу). | Только свои задачи. | Fallback: только свои задачи (отдел не выбран). |
| `department head` (роль `member`) | Может переключать блок «мои/отдел» для отдела, которым руководит. | Видит задачи своих доступных отделов (собственный + отделы, где он head); вне них доступ запрещён. | Только свои задачи. | Задачи выбранного доступного отдела (выбор среди разрешённых отделов). |
| `moderator` / `admin` | Полный обзор: свои + любой выбранный отдел. | Видит задачи всей компании, может фильтровать по любому отделу/исполнителю. | Только свои задачи. | Задачи компании с выбором «все отделы» или конкретного отдела. |

### Инварианты безопасности

- Доступ к задаче и её апдейтам проверяется на backend по единому правилу видимости (роль + отдел).
- `department_id`, переданный в API, валидируется: при недоступном отделе возвращается `403`.
- В Telegram карточка задачи и timeline апдейтов недоступны вне разрешённой зоны видимости.

## API

Документация: `http://localhost:8000/docs`

Основные endpoints:

- `POST /api/auth/login` — авторизация по Telegram ID
- `GET /api/tasks` — список задач (фильтры, пагинация)
- `POST /api/tasks` — создать задачу
- `GET /api/tasks/{short_id}/updates` — timeline обновлений
- `GET /api/meetings` — список встреч
- `POST /api/meetings/parse-summary` — AI-парсинг summary
- `GET /api/analytics/overview` — общая аналитика
- `GET /api/settings/ai` — текущий AI-провайдер
