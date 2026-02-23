# DEPRECATED (2026-02-21)
Этот документ больше не отражает актуальные требования по модулю встреч.
Использовать только как историческую справку.

# Переделка модуля «Встречи» — Детальный план

## Обзор изменений

**Что было:** Вкладка «Встречи» — архив прошедших встреч, созданных из Zoom Summary. Отдельная страница `/summary` для парсинга. Напоминания через n8n + Google Sheets.

**Что будет:** Полноценный модуль управления встречами с Zoom-интеграцией:
- Расписание повторяющихся встреч (замена Google Sheets)
- Автоматическое создание Zoom-конференций через API
- Напоминания в Telegram (замена n8n workflow)
- Карточка встречи с деталями, суммаризацией, задачами
- Автополучение транскрипции Zoom + ручная вставка как fallback
- Удаление страницы `/summary` — функционал внутри карточки встречи

---

## Новая архитектура

```
┌────────────────────────────────────────────────────────────────────┐
│                     Вкладка "Встречи"                              │
│                                                                    │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐   │
│  │  Расписание встреч    │    │  Предстоящие / Прошедшие         │   │
│  │  (recurring)          │    │  встречи                          │   │
│  │                       │    │                                   │   │
│  │  Пн 15:00 Планерка   │    │  [Карточка встречи]               │   │
│  │  Вс 15:00 Медтуризм  │    │  → Zoom ссылка                   │   │
│  │  Пн 02:00 Руковод.   │    │  → Суммаризация                  │   │
│  │                       │    │  → Задачи                        │   │
│  │  [+ Новая встреча]    │    │  → Транскрипция                  │   │
│  └─────────────────────┘    └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌───────────────────┐     ┌──────────────────────────┐
│  APScheduler       │     │  Zoom API (Server-to-S2S) │
│  за 1 час:         │     │  - Create meeting         │
│  → Create Zoom     │     │  - Get recordings         │
│  → Send Telegram   │     │  - Get transcript         │
└───────────────────┘     └──────────────────────────┘
```

---

## Новая схема БД (изменения)

```sql
-- ============================================
-- Расписание повторяющихся встреч (НОВАЯ)
-- ============================================
CREATE TABLE meeting_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,                    -- "Планерка по контенту"
    day_of_week INT NOT NULL,                       -- 1=Пн ... 7=Вс
    time_utc TIME NOT NULL,                         -- Время в UTC (хранение)
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',   -- Для отображения
    duration_minutes INT DEFAULT 60,
    recurrence VARCHAR(30) DEFAULT 'weekly',        -- weekly | biweekly | monthly_last_workday
    
    -- Telegram-напоминание
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_minutes_before INT DEFAULT 60,         -- За сколько минут напоминать
    reminder_text TEXT,                              -- Кастомный текст напоминания
    
    -- Telegram-группы для отправки (JSONB массив объектов)
    -- [{"chat_id": "-100...", "thread_id": null}, {"chat_id": "-100...", "thread_id": 123}]
    telegram_targets JSONB DEFAULT '[]',
    
    -- Участники (для отображения в карточке)
    participant_ids UUID[] DEFAULT '{}',
    
    -- Zoom
    zoom_enabled BOOLEAN DEFAULT true,              -- Создавать ли Zoom-конференцию автоматически
    
    is_active BOOLEAN DEFAULT true,
    created_by_id UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Встречи — МОДИФИКАЦИЯ существующей таблицы
-- ============================================
ALTER TABLE meetings ADD COLUMN schedule_id UUID REFERENCES meeting_schedules(id);
ALTER TABLE meetings ADD COLUMN zoom_meeting_id VARCHAR(50);       -- ID встречи в Zoom
ALTER TABLE meetings ADD COLUMN zoom_join_url TEXT;                 -- Ссылка для подключения
ALTER TABLE meetings ADD COLUMN zoom_recording_url TEXT;            -- Ссылка на запись
ALTER TABLE meetings ADD COLUMN transcript TEXT;                    -- Транскрипция (авто или ручная)
ALTER TABLE meetings ADD COLUMN transcript_source VARCHAR(20);     -- 'zoom_api' | 'manual'
ALTER TABLE meetings ADD COLUMN status VARCHAR(30) DEFAULT 'scheduled'; 
    -- scheduled | in_progress | completed | cancelled
ALTER TABLE meetings ALTER COLUMN raw_summary DROP NOT NULL;       -- Теперь nullable (может быть без summary)

-- ============================================
-- Настройки Telegram-групп для уведомлений (НОВАЯ)
-- ============================================
CREATE TABLE telegram_notification_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    thread_id INT,                                  -- NULL = общая ветка
    label VARCHAR(200),                             -- "Основная группа", "Группа школы"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы
CREATE INDEX idx_meeting_schedules_active ON meeting_schedules(is_active, day_of_week);
CREATE INDEX idx_meetings_schedule ON meetings(schedule_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_zoom ON meetings(zoom_meeting_id);
```

---

## Zoom API: что нужно

### Тип приложения: Server-to-Server OAuth

**Как создать** (инструкция для Дмитрия):
1. Зайти на https://marketplace.zoom.us/ под аккаунтом Oncoschool
2. Develop → Build App → Server-to-Server OAuth
3. Задать имя (например "Oncoschool Task Manager")
4. Получить: Account ID, Client ID, Client Secret
5. Scopes: `meeting:create:meeting:admin`, `meeting:read:meeting:admin`, `meeting:update:meeting:admin`, `meeting:delete:meeting:admin`, `cloud_recording:read:list_recording_files:admin`

**Проверить доступ:** Если зайти на https://marketplace.zoom.us/ под тем же аккаунтом, что используется для n8n OAuth — должна быть кнопка "Develop" → "Build App".

### Endpoints, которые будем использовать:

| Действие | Endpoint | Scope |
|----------|----------|-------|
| Создать встречу | `POST /users/me/meetings` | meeting:create:meeting:admin |
| Обновить встречу | `PATCH /meetings/{id}` | meeting:update:meeting:admin |
| Удалить встречу | `DELETE /meetings/{id}` | meeting:delete:meeting:admin |
| Получить встречу | `GET /meetings/{id}` | meeting:read:meeting:admin |
| Список записей | `GET /meetings/{id}/recordings` | cloud_recording:read:list_recording_files:admin |
| Скачать транскрипцию | `download_url` из recording files | cloud_recording:read:list_recording_files:admin |

### Транскрипция Zoom:
- Zoom Cloud Recording автоматически генерирует audio transcript если включено в настройках аккаунта
- Доступно через `GET /meetings/{meetingId}/recordings` → в `recording_files` ищем `file_type: "TRANSCRIPT"`
- Скачивается как `.vtt` файл (WebVTT) — нужно парсить в plain text
- **Fallback:** если транскрипция недоступна — текстовое поле для ручной вставки

---

## Фазы реализации

---

### Фаза M1: Миграция БД + Zoom-сервис + Конфигурация

**Цель:** Новые таблицы, Zoom API сервис, ENV-переменные. Модификация Meeting модели.

**Промпт для Claude Code:**

```
Прочитай PLAN.md и CLAUDE.md для контекста проекта. Затем прочитай этот план
полностью (docs/plans/archive/MEETINGS_PLAN.md).

=== ФАЗА M1: Миграция БД + Zoom-сервис + Конфигурация ===

1. КОНФИГУРАЦИЯ — добавь в config.py новые ENV:

   # Zoom Server-to-Server OAuth
   ZOOM_ACCOUNT_ID: str | None = None
   ZOOM_CLIENT_ID: str | None = None
   ZOOM_CLIENT_SECRET: str | None = None
   
   # Telegram-группы (дефолтные, можно переопределить в UI)
   NOTIFICATION_CHAT_IDS: list[int] = []     # Chat IDs через запятую
   
   @property
   def zoom_configured(self) -> bool:
       return all([self.ZOOM_ACCOUNT_ID, self.ZOOM_CLIENT_ID, self.ZOOM_CLIENT_SECRET])

   Обнови .env.example добавив:
   ZOOM_ACCOUNT_ID=
   ZOOM_CLIENT_ID=
   ZOOM_CLIENT_SECRET=
   NOTIFICATION_CHAT_IDS=

2. МОДЕЛИ — в models.py:

   a) Новая модель MeetingSchedule:
      - id: UUID PK
      - title: String(500), not null
      - day_of_week: Integer, not null          # 1=Пн ... 7=Вс (ISO)
      - time_utc: Time, not null                # Храним в UTC
      - timezone: String(50), default='Europe/Moscow'
      - duration_minutes: Integer, default=60
      - recurrence: String(30), default='weekly'  # weekly | biweekly | monthly_last_workday
      - reminder_enabled: Boolean, default=True
      - reminder_minutes_before: Integer, default=60
      - reminder_text: Text, nullable            # Кастомный текст или шаблон
      - telegram_targets: JSONB, default=[]      # [{"chat_id": ..., "thread_id": ...}]
      - participant_ids: ARRAY(UUID), default=[]
      - zoom_enabled: Boolean, default=True
      - is_active: Boolean, default=True
      - created_by_id: FK -> TeamMember
      - created_at, updated_at
      - relationships: meetings (back_populates), created_by

   b) Модифицируй Meeting (существующую модель):
      - Добавь поля:
        schedule_id: UUID FK -> meeting_schedules, nullable
        zoom_meeting_id: String(50), nullable
        zoom_join_url: Text, nullable
        zoom_recording_url: Text, nullable
        transcript: Text, nullable
        transcript_source: String(20), nullable  # 'zoom_api' | 'manual'
        status: String(30), default='scheduled'  # scheduled | in_progress | completed | cancelled
      - Сделай raw_summary NULLABLE (ALTER COLUMN)
      - Добавь relationship: schedule -> MeetingSchedule

   c) Новая модель TelegramNotificationTarget:
      - id: UUID PK
      - chat_id: BigInteger, not null
      - thread_id: Integer, nullable
      - label: String(200), nullable
      - is_active: Boolean, default=True
      - created_at

3. SCHEMAS — в schemas.py добавь:

   # MeetingSchedule
   class MeetingScheduleCreate(BaseModel):
       title: str
       day_of_week: int                         # 1-7
       time_local: str                          # "15:00" — фронт отправляет локальное
       timezone: str = "Europe/Moscow"
       duration_minutes: int = 60
       recurrence: str = "weekly"               # weekly | biweekly | monthly_last_workday
       reminder_enabled: bool = True
       reminder_minutes_before: int = 60
       reminder_text: str | None = None
       telegram_targets: list[dict] = []        # [{"chat_id": ..., "thread_id": ...}]
       participant_ids: list[uuid.UUID] = []
       zoom_enabled: bool = True
   
   class MeetingScheduleUpdate(BaseModel):
       title: str | None = None
       day_of_week: int | None = None
       time_local: str | None = None
       timezone: str | None = None
       duration_minutes: int | None = None
       recurrence: str | None = None
       reminder_enabled: bool | None = None
       reminder_minutes_before: int | None = None
       reminder_text: str | None = None
       telegram_targets: list[dict] | None = None
       participant_ids: list[uuid.UUID] | None = None
       zoom_enabled: bool | None = None
       is_active: bool | None = None

   class MeetingScheduleResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)
       id: uuid.UUID
       title: str
       day_of_week: int
       time_utc: time
       timezone: str
       duration_minutes: int
       recurrence: str
       reminder_enabled: bool
       reminder_minutes_before: int
       reminder_text: str | None
       telegram_targets: list[dict]
       participant_ids: list[uuid.UUID]
       zoom_enabled: bool
       is_active: bool
       created_by_id: uuid.UUID | None
       created_at: datetime
       updated_at: datetime

   # Обнови MeetingResponse — добавь новые поля:
   class MeetingResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)
       id: uuid.UUID
       title: str | None
       raw_summary: str | None              # Теперь nullable
       parsed_summary: str | None
       decisions: list[str]
       notes: str | None
       meeting_date: datetime | None
       created_by_id: uuid.UUID | None
       created_at: datetime
       # Новые поля:
       schedule_id: uuid.UUID | None
       zoom_meeting_id: str | None
       zoom_join_url: str | None
       zoom_recording_url: str | None
       transcript: str | None
       transcript_source: str | None
       status: str

   # TelegramNotificationTarget
   class TelegramTargetCreate(BaseModel):
       chat_id: int
       thread_id: int | None = None
       label: str | None = None
   
   class TelegramTargetResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)
       id: uuid.UUID
       chat_id: int
       thread_id: int | None
       label: str | None
       is_active: bool
       created_at: datetime

4. REPOSITORIES — в repositories.py добавь:

   class MeetingScheduleRepository:
       async def get_all_active(session) -> list[MeetingSchedule]
       async def get_by_id(session, id) -> MeetingSchedule | None
       async def create(session, **kwargs) -> MeetingSchedule
       async def update(session, id, **kwargs) -> MeetingSchedule
       async def delete(session, id) -> None
       async def get_schedules_for_time(session, day_of_week, hour_utc, minute_utc) 
           -> list[MeetingSchedule]
           # Для scheduler: найти расписания которые нужно запустить сейчас

   class TelegramTargetRepository:
       async def get_all_active(session) -> list
       async def create(session, **kwargs)
       async def update(session, id, **kwargs)
       async def delete(session, id)

   Обнови MeetingRepository:
       async def get_by_zoom_id(session, zoom_meeting_id) -> Meeting | None
       async def get_upcoming(session, limit=10) -> list[Meeting]  
           # status='scheduled', meeting_date > now, order by date asc
       async def get_past(session, limit=20) -> list[Meeting]
           # status in ('completed','cancelled'), order by date desc

5. ZOOM SERVICE — создай app/services/zoom_service.py:

   import httpx
   import logging
   from datetime import datetime
   
   class ZoomService:
       """Zoom Server-to-Server OAuth integration."""
       
       BASE_URL = "https://api.zoom.us/v2"
       TOKEN_URL = "https://zoom.us/oauth/token"
       
       def __init__(self, account_id: str, client_id: str, client_secret: str):
           self.account_id = account_id
           self.client_id = client_id
           self.client_secret = client_secret
           self._token: str | None = None
           self._token_expires: datetime | None = None
       
       async def _get_token(self) -> str:
           """Получить или обновить Server-to-Server OAuth token."""
           if self._token and self._token_expires and datetime.utcnow() < self._token_expires:
               return self._token
           
           async with httpx.AsyncClient() as client:
               response = await client.post(
                   self.TOKEN_URL,
                   params={"grant_type": "account_credentials", "account_id": self.account_id},
                   auth=(self.client_id, self.client_secret),
               )
               response.raise_for_status()
               data = response.json()
               self._token = data["access_token"]
               self._token_expires = datetime.utcnow() + timedelta(seconds=data["expires_in"] - 60)
               return self._token
       
       async def _request(self, method: str, path: str, **kwargs) -> dict:
           """Выполнить запрос к Zoom API с авторизацией."""
           token = await self._get_token()
           async with httpx.AsyncClient() as client:
               response = await client.request(
                   method,
                   f"{self.BASE_URL}{path}",
                   headers={"Authorization": f"Bearer {token}"},
                   **kwargs
               )
               response.raise_for_status()
               if response.status_code == 204:
                   return {}
               return response.json()
       
       async def create_meeting(
           self, topic: str, start_time: datetime, duration: int = 60,
           timezone: str = "Europe/Moscow"
       ) -> dict:
           """Создать Zoom-встречу. Возвращает {id, join_url, start_url, ...}"""
           data = {
               "topic": topic,
               "type": 2,  # Scheduled meeting
               "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
               "duration": duration,
               "timezone": timezone,
               "settings": {
                   "join_before_host": True,
                   "waiting_room": False,
                   "auto_recording": "cloud",  # Для транскрипции
                   "meeting_authentication": False,
               }
           }
           return await self._request("POST", "/users/me/meetings", json=data)
       
       async def update_meeting(self, meeting_id: str, **kwargs) -> dict:
           """Обновить параметры Zoom-встречи."""
           return await self._request("PATCH", f"/meetings/{meeting_id}", json=kwargs)
       
       async def delete_meeting(self, meeting_id: str) -> None:
           """Удалить Zoom-встречу."""
           await self._request("DELETE", f"/meetings/{meeting_id}")
       
       async def get_meeting(self, meeting_id: str) -> dict:
           """Получить детали Zoom-встречи."""
           return await self._request("GET", f"/meetings/{meeting_id}")
       
       async def get_recordings(self, meeting_id: str) -> dict | None:
           """Получить записи встречи. None если нет записей."""
           try:
               return await self._request("GET", f"/meetings/{meeting_id}/recordings")
           except httpx.HTTPStatusError as e:
               if e.response.status_code == 404:
                   return None
               raise
       
       async def get_transcript(self, meeting_id: str) -> str | None:
           """
           Получить транскрипцию встречи.
           1. Запросить recordings
           2. Найти файл с file_type="TRANSCRIPT"
           3. Скачать .vtt файл
           4. Парсить VTT -> plain text
           Возвращает None если транскрипция недоступна.
           """
           recordings = await self.get_recordings(meeting_id)
           if not recordings or "recording_files" not in recordings:
               return None
           
           transcript_file = next(
               (f for f in recordings["recording_files"] if f.get("file_type") == "TRANSCRIPT"),
               None
           )
           if not transcript_file:
               return None
           
           # Скачать VTT
           download_url = transcript_file["download_url"]
           token = await self._get_token()
           async with httpx.AsyncClient() as client:
               resp = await client.get(
                   download_url,
                   headers={"Authorization": f"Bearer {token}"},
                   follow_redirects=True
               )
               resp.raise_for_status()
               vtt_content = resp.text
           
           return self._parse_vtt(vtt_content)
       
       @staticmethod
       def _parse_vtt(vtt_text: str) -> str:
           """Парсить WebVTT формат в plain text."""
           lines = []
           for line in vtt_text.strip().split("\n"):
               line = line.strip()
               # Пропускаем заголовок WEBVTT, пустые строки, таймкоды
               if not line or line.startswith("WEBVTT") or line.startswith("NOTE"):
                   continue
               if "-->" in line:  # Таймкод вида "00:00:01.000 --> 00:00:03.000"
                   continue
               if line.isdigit():  # Номер блока
                   continue
               lines.append(line)
           return "\n".join(lines)

   Если ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET не заданы в ENV — ZoomService не создаётся,
   все zoom-операции возвращают graceful fallback (zoom_configured = False в ответах API).

6. ALEMBIC МИГРАЦИЯ:
   Создай миграцию для всех изменений:
   - CREATE TABLE meeting_schedules
   - CREATE TABLE telegram_notification_targets
   - ALTER TABLE meetings ADD COLUMN schedule_id, zoom_meeting_id, zoom_join_url,
     zoom_recording_url, transcript, transcript_source, status
   - ALTER TABLE meetings ALTER COLUMN raw_summary DROP NOT NULL

   Не удаляй существующие данные — backwards compatible.

7. Обнови .env.example и CLAUDE.md (только чеклист — добавь фазы M1-M6).
```

**Результат:** БД готова, Zoom-сервис работает, конфигурация обновлена.

**Как проверить:**
- `alembic upgrade head` без ошибок
- Zoom-сервис инициализируется если есть ENV (или graceful fallback)
- Новые модели и репозитории доступны

---

### Фаза M2: Расписание встреч — бэкенд (API + Scheduler)

**Цель:** CRUD расписания, APScheduler для автоматического создания Zoom-встреч и отправки напоминаний.

**Промпт для Claude Code:**

```
Прочитай docs/plans/archive/MEETINGS_PLAN.md, затем PLAN.md и CLAUDE.md.

=== ФАЗА M2: Расписание встреч — бэкенд ===

1. API — создай app/api/meeting_schedules.py:

   router = APIRouter(prefix="/meeting-schedules", tags=["meeting-schedules"])

   GET /meeting-schedules
     — Все расписания (is_active и неактивные). Доступно всем.
     — Возвращает list[MeetingScheduleResponse]
     — Включи в ответ enriched данные: имена участников (join с team_members по participant_ids)

   GET /meeting-schedules/{id}
     — Детали одного расписания

   POST /meeting-schedules — require_moderator
     — Создать расписание
     — Принимает MeetingScheduleCreate
     — ВАЖНО: time_local приходит как "15:00", timezone как "Europe/Moscow"
       → конвертировать в time_utc для хранения:
         from zoneinfo import ZoneInfo
         local_dt = datetime.combine(date.today(), time.fromisoformat(time_local))
         local_dt = local_dt.replace(tzinfo=ZoneInfo(timezone))
         utc_time = local_dt.astimezone(ZoneInfo("UTC")).time()
     — Валидация: day_of_week 1-7, recurrence in ('weekly','biweekly','monthly_last_workday')
     — Если telegram_targets пустой — подставить дефолтные из TelegramNotificationTarget таблицы

   PATCH /meeting-schedules/{id} — require_moderator
     — Обновить расписание
     — Те же правила конвертации time_local -> time_utc

   DELETE /meeting-schedules/{id} — require_moderator
     — Soft delete: is_active = False (не удалять физически, чтобы не сломать связи)

2. API — создай app/api/telegram_targets.py:

   router = APIRouter(prefix="/telegram-targets", tags=["telegram-targets"])

   GET /telegram-targets — список всех целей для уведомлений
   POST /telegram-targets — require_moderator, создать цель
   PATCH /telegram-targets/{id} — require_moderator, обновить
   DELETE /telegram-targets/{id} — require_moderator, удалить

3. MEETING SCHEDULER SERVICE — создай app/services/meeting_scheduler_service.py:

   class MeetingSchedulerService:
       """
       Заменяет n8n workflow. Работает через APScheduler.
       Каждую минуту проверяет: есть ли расписание, для которого нужно
       создать Zoom-встречу и отправить напоминание.
       """
       
       def __init__(self, bot: Bot, session_maker, zoom_service: ZoomService | None):
           self.bot = bot
           self.session_maker = session_maker
           self.zoom_service = zoom_service
           self.scheduler = AsyncIOScheduler()
           # Трекер: schedule_id -> last_triggered_date (чтобы не дублировать)
           self._triggered_today: dict[str, date] = {}
       
       def start(self):
           # Каждую минуту проверяем расписание
           self.scheduler.add_job(
               self._check_schedules,
               "interval",
               minutes=1,
               id="meeting_scheduler",
               replace_existing=True,
           )
           self.scheduler.start()
       
       async def _check_schedules(self):
           """
           Логика (повторяет n8n workflow):
           1. Текущее время UTC
           2. Для каждого активного расписания проверить:
              a) Совпадает ли day_of_week с сегодня
              b) Для 'biweekly' — проверить чётность недели
              c) Для 'monthly_last_workday' — последняя рабочая пятница месяца
              d) Наступило ли время (time_utc - reminder_minutes_before) ± 1 минута
              e) Не была ли уже запущена сегодня (_triggered_today)
           3. Если всё совпало:
              a) Создать Zoom-встречу (если zoom_enabled и zoom_service доступен)
              b) Создать запись Meeting в БД (status='scheduled')
              c) Отправить напоминание в Telegram (во все telegram_targets)
              d) Пометить как triggered
           """
           
       async def _should_trigger(self, schedule: MeetingSchedule, now_utc: datetime) -> bool:
           """Проверить все условия для запуска."""
           # 1. День недели
           current_dow = now_utc.isoweekday()  # 1=Пн
           if schedule.day_of_week != current_dow:
               return False
           
           # 2. Recurrence
           if schedule.recurrence == 'biweekly':
               # Чётная неделя = запускаем (можно сделать configurable)
               week_number = now_utc.isocalendar()[1]
               if week_number % 2 != 0:
                   return False
           elif schedule.recurrence == 'monthly_last_workday':
               # Последняя рабочая пятница месяца
               if not self._is_last_workday_friday(now_utc):
                   return False
           
           # 3. Время: reminder_minutes_before до начала встречи
           trigger_time = self._calc_trigger_time(schedule)
           # Проверяем ± 1 минута от trigger_time
           diff = abs((now_utc.hour * 60 + now_utc.minute) - 
                      (trigger_time.hour * 60 + trigger_time.minute))
           if diff > 1:
               return False
           
           # 4. Уже запускали сегодня?
           key = f"{schedule.id}:{now_utc.date()}"
           if key in self._triggered_today:
               return False
           
           return True
       
       def _calc_trigger_time(self, schedule) -> time:
           """Вычислить время триггера = time_utc - reminder_minutes_before."""
           ...
       
       def _is_last_workday_friday(self, dt: datetime) -> bool:
           """Проверить: текущий день — пятница, и это последняя пятница месяца."""
           if dt.weekday() != 4:  # 4 = Пятница
               return False
           # Следующая пятница будет в следующем месяце?
           next_friday = dt + timedelta(days=7)
           return next_friday.month != dt.month
       
       async def _trigger_meeting(self, schedule: MeetingSchedule):
           """Создать Zoom + Meeting в БД + отправить в Telegram."""
           async with self.session_maker() as session:
               meeting_date = self._next_meeting_datetime(schedule)
               
               # 1. Создать Zoom (если настроено)
               zoom_data = None
               if schedule.zoom_enabled and self.zoom_service:
                   try:
                       zoom_data = await self.zoom_service.create_meeting(
                           topic=schedule.title,
                           start_time=meeting_date,
                           duration=schedule.duration_minutes,
                           timezone=schedule.timezone,
                       )
                   except Exception as e:
                       logger.error(f"Zoom create failed for schedule {schedule.id}: {e}")
               
               # 2. Создать Meeting в БД
               meeting = Meeting(
                   title=schedule.title,
                   meeting_date=meeting_date,
                   schedule_id=schedule.id,
                   status='scheduled',
                   zoom_meeting_id=str(zoom_data["id"]) if zoom_data else None,
                   zoom_join_url=zoom_data.get("join_url") if zoom_data else None,
                   created_by_id=schedule.created_by_id,
               )
               session.add(meeting)
               await session.commit()
               await session.refresh(meeting)
               
               # 3. Отправить напоминания в Telegram
               await self._send_reminders(schedule, meeting, zoom_data)
               
               # 4. Пометить
               self._triggered_today[f"{schedule.id}:{datetime.utcnow().date()}"] = True
       
       async def _send_reminders(self, schedule, meeting, zoom_data):
           """Отправить напоминания во все telegram_targets."""
           # Собрать текст
           text = schedule.reminder_text or self._default_reminder_text(schedule, meeting)
           
           if zoom_data and zoom_data.get("join_url"):
               text += f"\n\nСсылка для подключения: {zoom_data['join_url']}"
           
           # Отправить в каждую цель
           for target in (schedule.telegram_targets or []):
               chat_id = target.get("chat_id")
               thread_id = target.get("thread_id")
               if not chat_id:
                   continue
               try:
                   kwargs = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
                   if thread_id:
                       kwargs["message_thread_id"] = thread_id
                   await self.bot.send_message(**kwargs)
               except Exception as e:
                   logger.error(f"Failed to send reminder to {chat_id}: {e}")
       
       def _default_reminder_text(self, schedule, meeting) -> str:
           """Текст по умолчанию если reminder_text не задан."""
           # Конвертировать UTC -> local
           from zoneinfo import ZoneInfo
           local_time = meeting.meeting_date.astimezone(ZoneInfo(schedule.timezone))
           time_str = local_time.strftime("%H:%M")
           
           return (
               f"Доброго времени ❤️\n\n"
               f"Напоминаем, сегодня в {time_str} по МСК "
               f"{schedule.title.lower()}"
           )

4. ИНТЕГРАЦИЯ В main.py:
   - При старте: если zoom_configured — создать ZoomService
   - Создать MeetingSchedulerService, передать bot, session_maker, zoom_service
   - scheduler.start() при запуске

5. ОБНОВИ router.py — подключи новые роутеры:
   meeting_schedules, telegram_targets

6. Обнови MeetingService:
   - Новый метод: add_transcript(session, meeting_id, transcript_text, source)
     — Записывает transcript и transcript_source
   - Новый метод: update_meeting_status(session, meeting_id, status)
   - Метод: try_fetch_zoom_transcript(session, meeting_id)
     — Если zoom_meeting_id есть → zoom_service.get_transcript()
     — Если транскрипция найдена → сохранить, transcript_source='zoom_api'
     — Вернуть текст или None
```

**Результат:** Полный бэкенд для расписания, Zoom-интеграции, автоматических напоминаний.

**Как проверить:**
- `POST /meeting-schedules` создаёт расписание
- Scheduler находит расписание и создаёт Meeting + Zoom + Telegram
- `GET /meeting-schedules` возвращает все расписания
- `GET /telegram-targets` работает

---

### Фаза M3: Переработка API встреч + Summary внутри карточки

**Цель:** Обновить API встреч: предстоящие/прошедшие, суммаризация внутри карточки, транскрипция.

**Промпт для Claude Code:**

```
Прочитай docs/plans/archive/MEETINGS_PLAN.md.

=== ФАЗА M3: Переработка API встреч ===

1. ОБНОВИ app/api/meetings.py — полная переработка:

   GET /meetings
     — Параметры: status (optional), upcoming (bool), past (bool), page, per_page
     — upcoming=true: status='scheduled', meeting_date > now, сортировка ASC (ближайшие первыми)
     — past=true: status in ('completed'), сортировка DESC
     — По умолчанию: все, сортировка DESC
     — Ответ: list[MeetingResponse] (с новыми полями: zoom, transcript, status)

   GET /meetings/{id}
     — Полная карточка встречи со всеми полями

   GET /meetings/{id}/tasks
     — Задачи по встрече (как было)

   POST /meetings — require_moderator
     — Создание встречи вручную (без расписания)
     — Принимает: title, meeting_date, zoom_enabled (создать Zoom?)
     — Если zoom_enabled и zoom_configured: создать Zoom-встречу
     — Вернуть MeetingResponse

   PATCH /meetings/{id} — require_moderator
     — Обновить встречу: title, meeting_date, status, notes
     — Если меняется meeting_date и есть zoom_meeting_id: обновить в Zoom

   DELETE /meetings/{id} — require_moderator
     — Если есть zoom_meeting_id: удалить в Zoom
     — Удалить из БД

   === SUMMARY / ТРАНСКРИПЦИЯ ENDPOINTS (внутри карточки) ===

   POST /meetings/{id}/transcript — require_moderator
     — Ручная вставка транскрипции/summary
     — Body: { "text": "...", "source": "manual" }
     — Сохраняет в meeting.transcript, transcript_source='manual'

   POST /meetings/{id}/fetch-transcript — require_moderator
     — Попытка автоматически получить транскрипцию из Zoom API
     — Если zoom_meeting_id есть: zoom_service.get_transcript()
     — Если успех: сохранить, вернуть { "transcript": "...", "source": "zoom_api" }
     — Если нет: вернуть { "transcript": null, "message": "Транскрипция недоступна" }

   POST /meetings/{id}/parse-summary — require_moderator
     — Парсинг текста (из transcript или переданного) через AI
     — Body: { "text": "..." }  (опционально — если не передан, берёт meeting.transcript)
     — Использует ai_service.parse_meeting_summary()
     — Возвращает ParseSummaryResponse (title, summary, decisions, tasks, participants)
     — НЕ сохраняет автоматически — фронт покажет превью

   POST /meetings/{id}/apply-summary — require_moderator
     — Применить результат парсинга к встрече
     — Body: CreateFromParsedRequest (edited title, summary, decisions, tasks, participants)
     — Обновляет meeting: raw_summary, parsed_summary, decisions
     — Создаёт задачи (task_service.create_task, source='summary', meeting_id)
     — Обновляет статус на 'completed' если ещё не completed
     — Возвращает { meeting: MeetingResponse, tasks_created: int }

   GET /meetings/{id}/zoom-status — авторизованные
     — Проверить статус Zoom-встречи (если есть zoom_meeting_id)
     — Возвращает: { "zoom_configured": bool, "has_recording": bool, 
         "has_transcript": bool, "recording_url": str | null }

2. УДАЛИ старые endpoints которые больше не нужны:
   — POST /meetings/parse-summary (перенесён в /meetings/{id}/parse-summary)
   — POST /meetings (старый, создававший из parsed — заменён на новый flow)

3. ОБНОВИ MeetingService:
   - create_manual_meeting(session, title, meeting_date, zoom_enabled, creator)
   - update_meeting(session, meeting_id, **fields)
   - complete_meeting_with_summary(session, meeting_id, raw_summary, parsed_summary, 
       decisions, participant_names, tasks, creator)
   - get_upcoming_meetings(session) -> list[Meeting]
   - get_past_meetings(session) -> list[Meeting]

4. УДАЛИ app/api/summary.py endpoint ЕСЛИ ЕСТЬ (или пометь deprecated).
   Логика парсинга теперь через /meetings/{id}/parse-summary.
```

**Результат:** Новый API встреч с полным lifecycle.

**Как проверить:**
- Создание встречи вручную с Zoom
- Получение транскрипции (или ручная вставка)
- Парсинг summary → превью → применение → задачи созданы
- GET upcoming/past работает

---

### Фаза M4: Фронтенд — Расписание встреч + Telegram-настройки

**Цель:** UI для управления расписанием (замена Google Sheets) и настройки Telegram-целей.

**Промпт для Claude Code:**

```
Прочитай docs/plans/archive/MEETINGS_PLAN.md и docs/ai/frontend-design.md.

=== ФАЗА M4: Фронтенд — Расписание встреч ===

ДИЗАЙН: Следуй гайдлайнам из docs/ai/frontend-design.md.
Используй существующую дизайн-систему проекта (shadcn/ui, Tailwind, текущие цвета).

1. ОБНОВИ frontend/src/lib/types.ts — добавь типы:

   export type MeetingRecurrence = 'weekly' | 'biweekly' | 'monthly_last_workday';
   export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
   
   export interface MeetingSchedule {
     id: string;
     title: string;
     day_of_week: number;           // 1-7
     time_utc: string;              // "12:00:00"
     timezone: string;
     duration_minutes: number;
     recurrence: MeetingRecurrence;
     reminder_enabled: boolean;
     reminder_minutes_before: number;
     reminder_text: string | null;
     telegram_targets: TelegramTarget[];
     participant_ids: string[];
     zoom_enabled: boolean;
     is_active: boolean;
     created_by_id: string | null;
     created_at: string;
     updated_at: string;
   }
   
   export interface TelegramTarget {
     chat_id: string;      // BigInt as string
     thread_id: number | null;
   }
   
   export interface TelegramNotificationTarget {
     id: string;
     chat_id: number;
     thread_id: number | null;
     label: string | null;
     is_active: boolean;
     created_at: string;
   }
   
   // Обнови Meeting — добавь поля:
   export interface Meeting {
     // ... существующие поля ...
     schedule_id: string | null;
     zoom_meeting_id: string | null;
     zoom_join_url: string | null;
     zoom_recording_url: string | null;
     transcript: string | null;
     transcript_source: 'zoom_api' | 'manual' | null;
     status: MeetingStatus;
   }
   
   export const DAY_OF_WEEK_LABELS: Record<number, string> = {
     1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг',
     5: 'Пятница', 6: 'Суббота', 7: 'Воскресенье'
   };
   
   export const DAY_OF_WEEK_SHORT: Record<number, string> = {
     1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс'
   };
   
   export const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
     weekly: 'Еженедельно',
     biweekly: 'Раз в 2 недели',
     monthly_last_workday: 'Последний рабочий день месяца',
   };
   
   export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
     scheduled: 'Запланирована',
     in_progress: 'Идёт',
     completed: 'Завершена',
     cancelled: 'Отменена',
   };

2. ОБНОВИ frontend/src/lib/api.ts — добавь методы:

   // Meeting Schedules
   getMeetingSchedules(): Promise<MeetingSchedule[]>
   createMeetingSchedule(data: MeetingScheduleCreateRequest): Promise<MeetingSchedule>
   updateMeetingSchedule(id: string, data: Partial<MeetingScheduleCreateRequest>): Promise<MeetingSchedule>
   deleteMeetingSchedule(id: string): Promise<void>
   
   // Telegram Targets
   getTelegramTargets(): Promise<TelegramNotificationTarget[]>
   createTelegramTarget(data): Promise<TelegramNotificationTarget>
   updateTelegramTarget(id, data): Promise<TelegramNotificationTarget>
   deleteTelegramTarget(id): Promise<void>
   
   // Updated Meetings
   getMeetings(params?: { upcoming?: boolean; past?: boolean }): Promise<Meeting[]>
   createMeetingManual(data: { title: string; meeting_date: string; zoom_enabled?: boolean }): Promise<Meeting>
   updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting>
   
   // Transcript & Summary
   addTranscript(meetingId: string, text: string): Promise<Meeting>
   fetchZoomTranscript(meetingId: string): Promise<{ transcript: string | null }>
   parseMeetingSummary(meetingId: string, text?: string): Promise<ParseSummaryResponse>
   applySummary(meetingId: string, data: CreateMeetingRequest): Promise<MeetingWithTasksResponse>
   getZoomStatus(meetingId: string): Promise<ZoomStatusResponse>

3. СОЗДАЙ frontend/src/app/meetings/page.tsx — ПОЛНОСТЬЮ ПЕРЕПИСАТЬ:

   Страница "Встречи" теперь состоит из 2 основных секций:

   === ВЕРХНЯЯ СЕКЦИЯ: "Расписание встреч" (видна всем, редактирование — модератор) ===
   
   Визуально: горизонтальные карточки-строки, стиль как в Google Sheets но современный.
   Каждая строка расписания показывает:
   
   ┌──────────────────────────────────────────────────────────────────┐
   │ 🔵 Пн  │ 15:00 МСК │ Еженедельно │ Планерка по контенту       │
   │         │  60 мин   │ 🔔 за 1ч    │ 👤 Анастасия, Дарья, Мария │
   │         │           │ 📹 Zoom ✓   │                [⚙️] [🗑️]  │
   └──────────────────────────────────────────────────────────────────┘
   
   - День недели — цветной бейдж (каждый день свой цвет)
   - Время — конвертировать из UTC в timezone расписания для отображения
   - Периодичность — бейдж
   - Zoom — индикатор (✓ если zoom_enabled)
   - Напоминание — иконка колокольчика если reminder_enabled
   - Участники — аватарки/имена (получить из team_members по participant_ids)
   - Кнопки ⚙️ (редактировать) и 🗑️ (удалить) — ТОЛЬКО модератор
   
   Кнопка "+ Новое расписание" (модератор) — открывает модалку/drawer:
   
   Форма создания/редактирования расписания:
   - Название (input)
   - День недели (select из 7 дней, подписи на русском)
   - Время (time picker, в локальном времени пользователя)
   - Продолжительность (select: 30/45/60/90/120 минут)
   - Периодичность (select: Еженедельно / Раз в 2 недели / Последний рабочий день)
   - Участники (multi-select из team_members)
   - Zoom (toggle: создавать Zoom-конференцию автоматически)
   - Напоминание (toggle + select: за сколько минут, по умолчанию 60)
   - Текст напоминания (textarea, placeholder с шаблоном по умолчанию)
   - Telegram-группы (multi-select из telegram_targets + ссылка "Настроить группы")
   
   === НИЖНЯЯ СЕКЦИЯ: "Встречи" — 2 таба: "Предстоящие" | "Прошедшие" ===
   
   Таб "Предстоящие":
   - Карточки с: title, дата/время, Zoom-ссылка (кнопка "Подключиться"),
     статус бейдж ('scheduled'), привязка к расписанию если есть
   - Кнопка "Создать встречу" (модератор) — без расписания, разовая
   
   Таб "Прошедшие":
   - Карточки с: title, дата, статус, наличие summary (бейдж),
     количество задач, наличие транскрипции
   - Клик → /meetings/[id]

4. СОЗДАЙ компоненты:
   - frontend/src/components/meetings/ScheduleCard.tsx
   - frontend/src/components/meetings/ScheduleForm.tsx (модалка create/edit)
   - frontend/src/components/meetings/MeetingCard.tsx (карточка для списка)

5. ХУКИ:
   - frontend/src/hooks/useMeetingSchedules.ts
   - Обнови useMeetings.ts — поддержка upcoming/past фильтров

6. НАСТРОЙКИ TELEGRAM-ЦЕЛЕЙ — добавь секцию в /settings:

   Новая секция "📨 Telegram-группы для уведомлений":
   
   Таблица/список:
   | Название          | Chat ID          | Thread ID | Статус   | [Действия] |
   |-------------------|------------------|-----------|----------|------------|
   | Основная группа   | -1003693766132   | —         | Активна  | ✏️ 🗑️     |
   | Группа школы      | -1001686151789   | —         | Активна  | ✏️ 🗑️     |
   | Тема "Встречи"    | -1003693766132   | 456       | Активна  | ✏️ 🗑️     |
   
   Кнопка "+ Добавить группу":
   - Chat ID (input, number) — обязательно
   - Thread ID (input, number) — опционально, подсказка: 
     "Оставьте пустым для отправки в общую ветку"
   - Название (input) — для удобства идентификации
   
   ПОДСКАЗКА в UI: "Чтобы узнать Chat ID группы, добавьте бота 
   @userinfobot в группу или перешлите сообщение из группы боту @JsonDumpBot"
```

**Результат:** Полный UI расписания встреч + настройки Telegram.

**Как проверить:**
- Расписание отображается красиво
- Создание/редактирование/удаление работает
- Модератор видит кнопки, участник — нет
- Telegram-цели настраиваются

---

### Фаза M5: Фронтенд — Карточка встречи (детали + summary + транскрипция)

**Цель:** Полная переработка `/meetings/[id]` — детали, Zoom, транскрипция, AI-парсинг, задачи.

**Промпт для Claude Code:**

```
Прочитай docs/plans/archive/MEETINGS_PLAN.md и docs/ai/frontend-design.md.

=== ФАЗА M5: Карточка встречи ===

ПОЛНОСТЬЮ ПЕРЕПИСАТЬ frontend/src/app/meetings/[id]/page.tsx.

Карточка встречи — это единый интерфейс для всего lifecycle встречи:
scheduled → in_progress → completed (с summary и задачами)

Визуальная структура:

┌─────────────────────────────────────────────────────────────────┐
│  ← Встречи                                                      │
│                                                                  │
│  Планерка по контенту                           [Запланирована]  │
│  Понедельник, 17 февраля 2026 · 15:00 МСК · 60 мин             │
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────────┐       │
│  │ 📹 Zoom              │  │ 👤 Участники                │       │
│  │ [Подключиться]       │  │ Анастасия, Дарья, Мария    │       │
│  │ ID: 123456789        │  │                             │       │
│  └──────────────────────┘  └────────────────────────────┘       │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════  │
│  [Транскрипция] [Резюме] [Задачи (5)] [Заметки]                │
│  ═══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ... содержимое выбранной вкладки ...                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

=== HEADER SECTION ===

- Кнопка "Назад" → /meetings
- Название встречи (h1, editable если модератор — inline edit по клику)
- Дата и время (формат: "Понедельник, 17 февраля 2026 · 15:00 МСК · 60 мин")
- Статус бейдж: scheduled (синий), in_progress (жёлтый), completed (зелёный), cancelled (серый)
  Модератор: клик по статусу → dropdown для смены
- Привязка к расписанию (если schedule_id): маленький бейдж "из расписания: Планерка по контенту"

=== ZOOM BLOCK ===

Карточка с информацией о Zoom:
- Если zoom_join_url есть: кнопка "Подключиться" (открывает ссылку)
- Zoom Meeting ID
- Если status='completed' и есть recording: кнопка "Запись" (ссылка)
- Если zoom не настроен: пометка "Zoom не подключён"
- Модератор: кнопка "Создать Zoom" (если нет zoom_meeting_id)

=== PARTICIPANTS BLOCK ===

- Список участников (аватарки + имена)
- Из meeting_participants или schedule.participant_ids

=== TABS (4 вкладки) ===

**Таб 1: "Транскрипция"**

Это КЛЮЧЕВАЯ новая функциональность. Три состояния:

a) Транскрипция есть (transcript != null):
   - Отображение текста (scrollable, моноширинный, с нумерацией строк — как было)
   - Бейдж источника: "Zoom API" или "Вставлено вручную"
   - Кнопка "Копировать"
   - Модератор: кнопка "🤖 Распознать AI" → запускает парсинг (переход к табу "Резюме")

b) Транскрипции нет, но есть zoom_meeting_id:
   - Кнопка "Попробовать получить из Zoom" → вызывает POST /meetings/{id}/fetch-transcript
   - Спиннер при загрузке
   - Если получилось → отобразить текст + бейдж "Zoom API"
   - Если не получилось → показать fallback (вариант c)
   - Textarea для ручной вставки (fallback)

c) Транскрипции нет, zoom не настроен:
   - Textarea "Вставьте текст Zoom AI Summary или транскрипцию"
   - Кнопка "Сохранить" → POST /meetings/{id}/transcript
   - После сохранения → отображение как в (a)

**Таб 2: "Резюме" (AI Summary)**

Три состояния:

a) Summary есть (parsed_summary != null):
   - Краткое резюме (карточка)
   - Список решений (нумерованный, как было)
   - Заметки
   - Модератор: кнопка "Перепарсить" (перезапустить AI)

b) Summary нет, но transcript есть:
   - Большая кнопка "🤖 Обработать через AI"
   - При клике:
     → POST /meetings/{id}/parse-summary (без body — возьмёт transcript)
     → Спиннер "Обработка через {provider}..."
     → Показать ПРЕВЬЮ (как на старой /summary странице):
       - Title (editable)
       - Summary (editable)
       - Decisions (editable, + добавить, - удалить)
       - Tasks (editable: title, priority, assignee, deadline, + добавить, - удалить)
       - Participants
     → Кнопки: [✅ Применить] [✏️ Изменить текст] [❌ Отмена]
     → При "Применить": POST /meetings/{id}/apply-summary
       → Обновляет meeting, создаёт задачи
       → Переход к табу "Задачи"

c) Нет summary, нет transcript:
   - "Для создания резюме сначала добавьте транскрипцию"
   - Ссылка → таб "Транскрипция"

**Таб 3: "Задачи"**

Как было, но улучшить:
- Прогресс-бар выполнения
- Список задач (кликабельные, с статусом, приоритетом, исполнителем)
- Модератор: кнопка "+ Добавить задачу" → создание задачи привязанной к meeting_id
- Если задач нет: "К этой встрече ещё не привязано задач"
  + Если есть transcript: "Обработайте транскрипцию через AI для автоматического создания"

**Таб 4: "Заметки"**

- Текстовое поле для свободных заметок (meeting.notes)
- Модератор: editable textarea, auto-save при blur
- Участник: read-only

=== КОМПОНЕНТЫ ===

Создай:
- frontend/src/components/meetings/MeetingHeader.tsx
- frontend/src/components/meetings/ZoomBlock.tsx
- frontend/src/components/meetings/TranscriptTab.tsx
- frontend/src/components/meetings/SummaryTab.tsx (с превью из старого SummaryPage)
- frontend/src/components/meetings/MeetingTasksTab.tsx
- frontend/src/components/meetings/NotesTab.tsx
- frontend/src/components/meetings/ParticipantsBlock.tsx

=== УДАЛЕНИЕ СТАРОГО ===

- УДАЛИ frontend/src/app/summary/page.tsx — больше не нужен
- УДАЛИ из sidebar/навигации ссылку на /summary
- Если в layout.tsx или navigation есть ссылка "Summary" — убери
```

**Результат:** Карточка встречи — единый hub для всего lifecycle.

**Как проверить:**
- Запланированная встреча: видна Zoom-ссылка, статус
- Завершённая: транскрипция → AI парсинг → превью → задачи созданы
- Ручная вставка текста работает
- Все 4 таба работают
- Страница /summary удалена, ссылки убраны

---

### Фаза M6: Интеграция, полировка, миграция данных

**Цель:** Связать всё вместе, обновить бот, мигрировать старые данные, тесты.

**Промпт для Claude Code:**

```
Прочитай docs/plans/archive/MEETINGS_PLAN.md.

=== ФАЗА M6: Интеграция и полировка ===

1. TELEGRAM-БОТ — обнови app/bot/handlers/meetings.py:

   /meetings — теперь показывает:
   
   "📋 Предстоящие встречи:
   
   📹 Планерка по контенту
   📅 Пн, 17 февраля · 15:00 МСК
   🔗 zoom.us/j/123456789
   
   📹 Планерка по медтуризму  
   📅 Вс, 23 февраля · 15:00 МСК
   🔗 zoom.us/j/987654321
   
   ───────────
   
   ✅ Последние завершённые:
   • Планерка по контенту — 10.02 (3 задачи)
   • Планерка руководителей — 10.02 (5 задач)
   
   Все встречи → веб-интерфейс"
   
   Inline-кнопка: [🌐 Открыть в браузере] → ссылка на /meetings

   /nextmeeting — показать СЛЕДУЮЩУЮ встречу:
   "📹 Следующая встреча:
   
   Планерка по контенту
   📅 Понедельник, 17 февраля 2026
   ⏰ 15:00 по МСК (через 2 дня)
   🔗 Подключиться: zoom.us/j/123456789"

2. DASHBOARD — обнови frontend/src/app/page.tsx:
   - Блок "Предстоящие встречи" вместо/рядом с "Последние встречи"
   - Показать ближайшие 3 встречи с Zoom-ссылками

3. SIDEBAR — обнови навигацию:
   - Убери ссылку "Summary" (уже должна быть убрана в M5)
   - "Встречи" остаётся, добавь бейдж с количеством предстоящих
   
4. МИГРАЦИЯ СТАРЫХ ДАННЫХ:
   Существующие записи в meetings (без zoom, без status):
   - Всем старым meetings проставить status='completed' (они уже с summary)
   - raw_summary оставить как есть (теперь nullable, но у старых она заполнена)
   
   Создай Alembic data migration:
   UPDATE meetings SET status = 'completed' WHERE status IS NULL OR status = 'scheduled';
   (Те что уже имеют parsed_summary — это точно завершённые)

5. ОБНОВИ CLAUDE.md — добавь прогресс фаз M1-M6.

6. ТЕСТИРОВАНИЕ полного flow:
   a) Модератор создаёт расписание:
      - Пн 15:00, Еженедельно, "Планерка по контенту"
      - Zoom включён, напоминание за 1 час
      - 2 Telegram-группы
   b) Scheduler триггерит:
      - Создаётся Zoom-конференция
      - Создаётся Meeting (status=scheduled)
      - В обе Telegram-группы приходит напоминание с ссылкой
   c) После встречи модератор:
      - Открывает карточку встречи
      - Нажимает "Получить транскрипцию" → Zoom API
      - Или вставляет текст вручную
      - Нажимает "Обработать AI" → превью
      - Редактирует, нажимает "Применить"
      - Задачи созданы, meeting.status=completed
   d) Все участники видят:
      - Предстоящие встречи в списке
      - Zoom-ссылки
      - Завершённые встречи с задачами

7. EDGE CASES:
   - Zoom не настроен (нет ENV) — всё работает без Zoom, просто нет ссылок
   - Telegram-группы не настроены — напоминания не отправляются (graceful)
   - Транскрипция Zoom не доступна — fallback на ручную вставку
   - Расписание biweekly — правильная логика чётных/нечётных недель
   - Расписание monthly_last_workday — последняя рабочая пятница
   - Удаление расписания — soft delete, связанные meetings остаются
```

**Результат:** Всё работает вместе, старые данные мигрированы.

---

## Сводка фаз

| Фаза | Что делаем | Зависимости |
|------|-----------|-------------|
| **M1** | БД + Zoom-сервис + Конфигурация | — |
| **M2** | API расписания + Scheduler (напоминания, Zoom) | M1 |
| **M3** | Переработка API встреч + Summary inside карточки | M1, M2 |
| **M4** | Фронтенд: расписание + Telegram-настройки | M2 |
| **M5** | Фронтенд: карточка встречи (транскрипция, AI, задачи) | M3 |
| **M6** | Интеграция, бот, dashboard, миграция, тесты | Все |

## Оценка трудозатрат

| Фаза | Объём |
|------|-------|
| M1 | Средний — модели, миграция, Zoom-сервис |
| M2 | Большой — scheduler, API, логика recurrence |
| M3 | Средний — переработка API |
| M4 | Большой — UI расписания, формы, Telegram-настройки |
| M5 | Очень большой — карточка встречи, 4 таба, AI-парсинг |
| M6 | Средний — интеграция, бот, полировка |

## Необходимые действия от Дмитрия (до начала разработки)

1. **Zoom App:** Создать Server-to-Server OAuth приложение на marketplace.zoom.us
   - Получить: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
   - Scopes: meeting:create:meeting:admin, meeting:read:meeting:admin, meeting:update:meeting:admin, meeting:delete:meeting:admin, cloud_recording:read:list_recording_files:admin

2. **Telegram Chat IDs:** Подготовить chat_id и thread_id для групп
   - Основная группа: -1003693766132 (из n8n workflow)
   - Группа школы: -1001686151789 (из n8n workflow)
   - Thread IDs если нужны

3. **Cloud Recording:** Убедиться что в Zoom включена запись в облако
   (Settings → Recording → Cloud recording: ON)
   Это нужно для автоматической транскрипции.
