# Блок «Отчётность» — План реализации

> **Цель:** перенести ежедневный отчёт из n8n на собственную платформу, создать страницу отчётности на портале с дашбордом и графиками, расширенные Telegram-нотификации с sparkline-графиком, ребрендинг портала.

## Принятые решения

- **Вложенность отчётов:** Вариант A — саб-табы (L1 = источник данных, L2 = вид отчёта). Пока один отчёт — табы не показываются, появляются автоматически при L1 > 1 или L2 > 1.
- **Telegram:** Сразу с sparkline-графиком (matplotlib на бэкенде), отправляется как фото с caption.
- **Ребрендинг:** Включён как финальная фаза (sidebar «Task Manager» → «Портал», перегруппировка навигации).
- **API-префиксы:** Сразу `/reports/getcourse/...` для расширяемости.
- **Git-стратегия:** Работа в main. Коммиты локально после каждой фазы, пуш только после завершения всех фаз.

## Правила работы

- **Работаем пофазно.** Одна фаза за сессию. Не забегай вперёд.
- **Перед началом фазы** прочитай этот план и найди текущую фазу (первая с `[ ]` в критериях).
- **Не трогай этот план.** Можно ТОЛЬКО менять `[ ]` на `[x]` в критериях завершения.
- **После завершения фазы:**
  1. Проверь все критерии, отметь `[x]`
  2. Выполни `git add -A && git commit -m "R{N}: {описание}"` (сообщение указано в каждой фазе)
  3. **НЕ делай `git push`** — пуш выполняет человек вручную после всех фаз
  4. Сообщи: что сделано, какие файлы созданы/изменены, как проверить
- **При ошибках** — исправляй сам, не проси человека править вручную.
- **Тесты** — пиши базовые тесты для новых сервисов если позволяет время фазы.

---

## Фаза R1: Модель данных + GetCourse-сервис

### Что делаем
1. Добавить ENV-переменные в `config.py`:
   - `GETCOURSE_API_KEY: str = ""` (пустая строка = сервис не активен, graceful fallback)
   - `GETCOURSE_ACCOUNT_SLUG: str = ""` (например `oncoschoolru`)
   - Добавить property `getcourse_configured` по аналогии с `zoom_configured`

2. Создать модель `GetCourseDailyReport` в `db/models.py`:
   ```
   Таблица: getcourse_daily_reports
   Поля:
   - id: UUID PK
   - report_date: Date, unique, indexed DESC
   - new_users: Integer
   - payments_count: Integer
   - payments_sum: Numeric(12,2)
   - orders_count: Integer
   - orders_sum: Numeric(12,2)
   - users_delta_pct: Numeric(6,2), nullable — % к предыдущему дню
   - payments_sum_delta_pct: Numeric(6,2), nullable — % к среднему за 7 дней
   - raw_response: JSONB, nullable — сырые данные для дебага
   - created_at: DateTime, server_default=now()
   ```

3. Создать Alembic-миграцию, применить.

4. Создать `services/getcourse_service.py`:
   - Класс `GetCourseService` с async-методами
   - `__init__(api_key, account_slug)` — инициализация httpx.AsyncClient
   - `async def fetch_daily_report(date: date) -> dict` — основной метод
     - Внутри: 3 последовательных вызова API (users, payments, deals)
     - Каждый вызов: POST запрос → получить export_id → polling GET с retry (asyncio.sleep + timeout 10 минут)
     - GetCourse API URL: `https://{account_slug}.getcourse.ru/pl/api/account/{endpoint}`
     - Эндпоинты: `/users` (пользователи), `/payments` (платежи, status=accepted), `/deals` (заказы)
     - Query params: `key={api_key}`, `created_at[from]={date}`, `created_at[to]={date}`
     - Export polling: GET `/account/exports/{export_id}?key={api_key}`
     - Агрегация: users — count(items), payments — count + sum(item[7]), orders — count + sum(item[10]) где sum > 0
   - `async def close()` — закрытие httpx-клиента
   - Обработка ошибок: retry 3 раза на каждый export, таймаут, логирование

5. Создать Pydantic-схемы в `db/schemas.py`:
   - `GetCourseReportOut` — для API-ответа (одна запись)
   - `GetCourseReportRangeOut` — список отчётов за период
   - `GetCourseReportSummaryOut` — агрегация с дельтами

### Файлы создаются/изменяются
- `backend/app/config.py` — +3 строки (ENV + property)
- `backend/app/db/models.py` — +класс GetCourseDailyReport
- `backend/app/db/schemas.py` — +3 схемы
- `backend/app/services/getcourse_service.py` — НОВЫЙ файл
- `backend/alembic/versions/xxx_add_getcourse_reports.py` — НОВАЯ миграция

### Критерий завершения
- [ ] `alembic upgrade head` — таблица `getcourse_daily_reports` создана без ошибок
- [ ] Класс GetCourseService создан с методами fetch_daily_report, close
- [ ] При пустом `GETCOURSE_API_KEY` — property `getcourse_configured` возвращает False
- [ ] Pydantic-схемы проходят базовую валидацию
- [ ] Коммит: `git add -A && git commit -m "R1: модель GetCourseDailyReport + GetCourseService"`

---

## Фаза R2: Планировщик + Telegram-нотификация со sparkline

### Что делаем
1. Добавить `matplotlib` в зависимости (`backend/pyproject.toml`).

2. Создать `services/report_chart_service.py`:
   - Функция `def generate_sparkline(reports: list[dict]) -> bytes`
   - Использует matplotlib (backend: `matplotlib.use('Agg')` — без GUI)
   - Генерирует PNG-изображение ~800x400:
     - Два субграфика: динамика пользователей (линия) + динамика суммы платежей (линия)
     - Последняя точка — акцентным цветом, увеличенный маркер
     - Дельта-текст в углу графика (↑12% или ↓5%)
     - Стиль: минимальный, тёмный фон (#1e293b), белые линии, без сетки
     - Даты по оси X (последние 7 дней)
   - Возвращает bytes PNG для отправки в Telegram

3. Создать `services/report_scheduler_service.py`:
   - Класс `ReportSchedulerService` (по образцу MeetingSchedulerService)
   - `__init__(bot, session_maker, getcourse_service)` — принимает зависимости
   - `start()` / `stop()` — управление APScheduler
   - CronTrigger: 05:45 по TIMEZONE из config
   - Основной job `async def _collect_and_send_report()`:
     1. Определить дату: вчера (по TIMEZONE)
     2. Проверить, нет ли уже отчёта за эту дату в БД (идемпотентность)
     3. Вызвать `getcourse_service.fetch_daily_report(yesterday)`
     4. Загрузить предыдущий отчёт из БД для расчёта дельт
     5. Загрузить отчёты за 7 дней для среднего
     6. Рассчитать: `users_delta_pct` (% к вчера), `payments_sum_delta_pct` (% к среднему за 7 дней)
     7. Сохранить `GetCourseDailyReport` в БД
     8. Загрузить отчёты за 7 дней для sparkline
     9. Сгенерировать PNG через `generate_sparkline()`
     10. Сформировать Telegram-сообщение (HTML):
         ```
         📊 <b>Отчёт за {дата}</b>

         👤 Новые пользователи — <b>{N}</b> {↑12%}
         💳 Платежей — <b>{N}</b>
         💰 Сумма платежей — <b>{сумма} ₽</b>
         📦 Заказов — <b>{N}</b>
         🧾 Сумма заказов — <b>{сумма} ₽</b>

         📈 Тренд: пользователи {дельта}% к вчера, сумма платежей {дельта}% к среднему 7д
         ```
     11. Отправить через `bot.send_photo()` с inline-кнопкой «📊 Открыть дашборд» (url → /reports)
     12. Отправить в Telegram-группы:
         - Использовать существующую систему `TelegramNotificationTarget` (таблица `telegram_notification_targets`)
         - Тип цели: `report:getcourse` (по источнику, не по каждому отчёту)
         - Бот — тот же `bot` из `main.py` (BOT_TOKEN портала)
         - Группы и треды выбираются через UI в `/settings` → «Telegram-цели»
         - Если целей типа `report:getcourse` нет — fallback на NOTIFICATION_CHAT_IDS
   - Error handling: при ошибке — отправить текст ошибки в личку ADMIN_TELEGRAM_IDS
   - Публичный метод `async def collect_report_manually(date)` — для ручного вызова из API

4. Зарегистрировать новый тип цели `report:getcourse` в TelegramNotificationTarget:
   - Добавить `report:getcourse` в список допустимых типов целей (там где `meeting_reminder`, `task_digest` и т.д.)
   - Формат типа: `report:{source_slug}` — по источнику данных (не по каждому отчёту)
   - Все отчёты из GetCourse отправляются в одни и те же группы
   - Когда появится блок «Финансы» — добавится `report:finance` как отдельный тип цели
   - Это позволит в UI `/settings` выбрать, в какие группы/треды отправлять отчёты GetCourse
   - Бот для отправки — тот же `bot` из `main.py` (BOT_TOKEN портала, НЕ старый бот из n8n)

5. Подключить в `main.py`:
   - Импортировать GetCourseService, ReportSchedulerService
   - В блоке инициализации (после zoom_service):
     ```python
     getcourse_service = None
     if settings.getcourse_configured:
         getcourse_service = GetCourseService(...)
     app.state.getcourse_service = getcourse_service
     ```
   - Создать ReportSchedulerService (если getcourse_service не None)
   - Добавить start() в startup, stop() в shutdown
   - `app.state.report_scheduler = report_scheduler`

### Файлы создаются/изменяются
- `backend/app/services/report_chart_service.py` — НОВЫЙ
- `backend/app/services/report_scheduler_service.py` — НОВЫЙ
- `backend/app/main.py` — +15-20 строк (инициализация, startup/shutdown)
- `backend/pyproject.toml` — +matplotlib в зависимости

### Критерий завершения
- [ ] matplotlib добавлен в зависимости
- [ ] `generate_sparkline()` генерирует валидный PNG (можно проверить записью в файл)
- [ ] ReportSchedulerService создан, APScheduler CronTrigger настроен на 05:45
- [ ] Метод `_collect_and_send_report()` реализован с полным flow
- [ ] При `getcourse_configured == False` — планировщик не создаётся, приложение стартует как раньше
- [ ] main.py: инициализация getcourse_service и report_scheduler добавлена
- [ ] Коммит: `git add -A && git commit -m "R2: ReportSchedulerService + Telegram sparkline"`

---

## Фаза R3: REST API для дашборда

### Что делаем
1. Создать `api/reports.py`:
   - Router с prefix `/reports/getcourse`, tags=["reports"]
   - Все эндпоинты — `require_moderator` через PermissionService (по аналогии с другими moderator-only эндпоинтами)

   - **GET `/reports/getcourse/today`**
     - Возвращает отчёт за сегодня; если нет — за вчера; если нет — 404
     - Response: `GetCourseReportOut`

   - **GET `/reports/getcourse/range`**
     - Query params: `date_from: date`, `date_to: date`
     - Валидация: date_from <= date_to, максимум 90 дней
     - Response: `GetCourseReportRangeOut` (items: list + count)

   - **GET `/reports/getcourse/summary`**
     - Query params: `period: Literal["7d", "30d", "month"]`
     - Расчёт: средние значения, суммы, min/max, текущие дельты
     - Response: `GetCourseReportSummaryOut`

   - **POST `/reports/getcourse/collect`**
     - Query param: `date: date | None` (дефолт = вчера)
     - Вызывает `report_scheduler.collect_report_manually(date)`
     - Response: `GetCourseReportOut` (свежесобранный отчёт)
     - Только admin (require_admin)

2. Подключить в `api/router.py`:
   - `from app.api.reports import router as reports_router`
   - `api_router.include_router(reports_router)`

### Файлы создаются/изменяются
- `backend/app/api/reports.py` — НОВЫЙ
- `backend/app/api/router.py` — +2 строки (import + include)

### Критерий завершения
- [ ] Файл `api/reports.py` создан со всеми 4 эндпоинтами
- [ ] Router подключен в `api/router.py`
- [ ] Эндпоинты требуют авторизацию moderator/admin
- [ ] POST /collect — только admin
- [ ] Валидация параметров (date_from <= date_to, period enum)
- [ ] Коммит: `git add -A && git commit -m "R3: REST API /reports/getcourse/*"`

---

## Фаза R4: Frontend — страница отчётности

### Что делаем
1. Добавить типы в `lib/types.ts`:
   - `GetCourseReport` — одна запись (все поля из модели)
   - `GetCourseReportSummary` — агрегация (средние, суммы, дельты)

2. Добавить API-методы в `lib/api.ts`:
   - `getGetCourseReportToday(): Promise<GetCourseReport>`
   - `getGetCourseReportRange(dateFrom: string, dateTo: string): Promise<{items: GetCourseReport[], count: number}>`
   - `getGetCourseReportSummary(period: '7d' | '30d' | 'month'): Promise<GetCourseReportSummary>`
   - `collectGetCourseReport(date?: string): Promise<GetCourseReport>`

3. Создать компоненты `components/reports/`:

   - **`ReportKPICard.tsx`** — карточка метрики:
     - Props: label, value, delta (%), icon, accentColor
     - Дельта: зелёная стрелка вверх / красная вниз
     - Стиль: аналогичный StatCard из analytics/page.tsx

   - **`ReportChart.tsx`** — обёртка recharts:
     - Props: data (массив {date, value}), title, color
     - LineChart с area fill, tooltip, responsive
     - Стиль: аналогичный графикам в analytics

   - **`ReportDateFilter.tsx`** — фильтр периода:
     - Пресеты: 7д, 30д, Этот месяц, Прошлый месяц
     - Активный пресет подсвечивается
     - Возвращает {dateFrom, dateTo}

   - **`ReportTable.tsx`** — таблица по дням:
     - Колонки: Дата, Пользователи, Платежи, Сумма платежей, Заказы, Сумма заказов
     - Сортировка по дате (DESC по умолчанию)
     - Дельты цветом в ячейках

   - **`GetCourseTab.tsx`** — главный компонент вкладки:
     - Использует все компоненты выше
     - Состояние: период (useState), данные (useEffect → API)
     - Layout:
       1. ReportDateFilter сверху
       2. 4 × ReportKPICard в ряд (пользователи, платежи, сумма платежей, сумма заказов)
       3. 2 × ReportChart в ряд (динамика пользователей, динамика суммы платежей)
       4. ReportTable снизу
     - Loading skeleton (по аналогии с AnalyticsSkeleton)
     - Empty state если данных нет

4. Создать страницу `app/reports/page.tsx`:
   - Архитектура расширяемости:
     ```typescript
     const REPORT_TABS = [
       { key: "getcourse", label: "GetCourse", icon: BarChart3, component: GetCourseTab },
       // Будущие табы добавляются сюда
     ];
     // Если один таб — рендерим без таб-бара
     // Если >1 — показываем табы
     ```
   - Проверка роли: только moderator/admin (редирект или сообщение для member)

5. Добавить пункт «Отчётность» в sidebar (`components/layout/Sidebar.tsx`):
   - В массив NAV_ITEMS, после "Аналитика":
     ```typescript
     { href: "/reports", label: "Отчётность", icon: FileBarChart, moderatorOnly: true, section: "main" }
     ```
   - Импорт: `import { FileBarChart } from "lucide-react"`

6. Дизайн — строго по гайдлайнам из `docs/ai/frontend-design.md`:
   - Те же анимации (animate-fade-in-up, stagger)
   - Те же цвета из палитры проекта
   - Те же карточки с accent bar сверху
   - Те же rounded-2xl, border-border/60, bg-card

### Файлы создаются/изменяются
- `frontend/src/lib/types.ts` — +2 типа
- `frontend/src/lib/api.ts` — +4 метода
- `frontend/src/app/reports/page.tsx` — НОВЫЙ
- `frontend/src/components/reports/GetCourseTab.tsx` — НОВЫЙ
- `frontend/src/components/reports/ReportKPICard.tsx` — НОВЫЙ
- `frontend/src/components/reports/ReportChart.tsx` — НОВЫЙ
- `frontend/src/components/reports/ReportDateFilter.tsx` — НОВЫЙ
- `frontend/src/components/reports/ReportTable.tsx` — НОВЫЙ
- `frontend/src/components/layout/Sidebar.tsx` — +1 элемент в NAV_ITEMS + import

### Критерий завершения
- [ ] Страница `/reports` открывается, показывает GetCourse-дашборд (или empty state)
- [ ] KPI-карточки отображают данные с дельтами
- [ ] Графики рендерятся (recharts LineChart)
- [ ] Фильтр по периоду работает (7д, 30д, месяц)
- [ ] Таблица по дням отображается
- [ ] Расширяемая архитектура: массив REPORT_TABS, табы скрыты при одном элементе
- [ ] Пункт «Отчётность» виден в sidebar для moderator/admin
- [ ] Пункт «Отчётность» НЕ виден для member
- [ ] `npm run build` — без ошибок
- [ ] Все существующие страницы работают как раньше
- [ ] Коммит: `git add -A && git commit -m "R4: страница отчётности + GetCourse-дашборд"`

---

## Фаза R5: Ребрендинг → «Портал» + перегруппировка навигации

### Что делаем
1. Sidebar — обновить `components/layout/Sidebar.tsx`:
   - Логотип: подзаголовок `TASK MANAGER` → `ПОРТАЛ`
   - Перегруппировать NAV_ITEMS с 4 секциями:

     **Операционное** (section: "operations"):
     - Dashboard `/`
     - Задачи `/tasks`
     - Встречи `/meetings`

     **Аналитика** (section: "analytics"):
     - Аналитика задач `/analytics`
     - Отчётность `/reports` (moderatorOnly)

     **Коммуникации** (section: "communications"):
     - Рассылки `/broadcasts` (moderatorOnly)

     **Управление** (section: "manage"):
     - Команда `/team`
     - Настройки `/settings` (moderatorOnly)

   - Расширить тип section: `"main" | "manage"` → `"operations" | "analytics" | "communications" | "manage"`
   - Секционные заголовки для каждой группы (как сейчас есть «Управление»)

2. Обновить мета-данные:
   - `frontend/src/app/layout.tsx` — title: "Онкошкола — Портал"
   - `backend/app/main.py` — FastAPI title: "Oncoschool Portal"

3. Обновить `CLAUDE.md`:
   - Добавить секцию "Блок «Отчётность»" с чеклистом фаз R1-R5
   - Обновить количество таблиц: 11 → 12 (+ getcourse_daily_reports)
   - Обновить описание: «Таск-менеджер» → «Портал для команды ~20 человек»

### Файлы изменяются
- `frontend/src/components/layout/Sidebar.tsx` — рефакторинг навигации
- `frontend/src/app/layout.tsx` — title
- `backend/app/main.py` — title строка
- `CLAUDE.md` — описание + чеклист

### Критерий завершения
- [ ] Sidebar показывает «Портал» вместо «Task Manager»
- [ ] Навигация разбита на 4 секции с заголовками
- [ ] Все ссылки работают, ничего не потерялось
- [ ] Title в браузере: «Онкошкола — Портал»
- [ ] CLAUDE.md актуализирован с секцией отчётности
- [ ] `npm run build` — без ошибок
- [ ] Коммит: `git add -A && git commit -m "R5: ребрендинг → Портал + навигация"`

---

## Сводка

| Фаза | Описание | Оценка |
|------|----------|--------|
| R1 | Модель данных + GetCourse-сервис | 3–4 ч |
| R2 | Планировщик + Telegram со sparkline | 3–4 ч |
| R3 | REST API для дашборда | 2–3 ч |
| R4 | Frontend — страница отчётности | 4–5 ч |
| R5 | Ребрендинг → «Портал» | 1–2 ч |
| **Итого** | | **13–18 ч** |
