# Переделка вкладки «Команда» — Детальный план

## Обзор изменений

**Что было:** Плоский список участников с карточками (имя, username, роль moderator/member, статистика задач). Доступ только модераторам. Редактирование inline.

**Что будет:** Полноценный оргчарт команды:
- Иерархическое дерево с группировкой по отделам
- Справочник отделов (CRUD) с цветами и руководителями
- 3 роли: admin / moderator / member
- Карточки-превью (аватар, имя, должность, роль)
- Детальная карточка (email, дата рождения, отдел, статистика)
- Аватары: Telegram photo + загрузка через UI
- Страница доступна ВСЕМ (не только модераторам), редактирование — moderator+

---

## Новая схема БД (изменения)

```sql
-- Справочник отделов (НОВАЯ)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    head_id UUID REFERENCES team_members(id),   -- руководитель
    sort_order INT DEFAULT 0,
    color VARCHAR(7),                            -- HEX, например "#4F46E5"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Расширение team_members
ALTER TABLE team_members ADD COLUMN department_id UUID REFERENCES departments(id);
ALTER TABLE team_members ADD COLUMN position VARCHAR(200);       -- должность
ALTER TABLE team_members ADD COLUMN email VARCHAR(255);
ALTER TABLE team_members ADD COLUMN birthday DATE;
ALTER TABLE team_members ADD COLUMN avatar_url VARCHAR(500);     -- URL аватара

-- Миграция ролей: moderator → admin (все текущие moderator получают admin)
UPDATE team_members SET role = 'admin' WHERE role = 'moderator';
-- Теперь role ∈ {'admin', 'moderator', 'member'}
```

### Ролевая модель (3 уровня)

| Роль | Права |
|------|-------|
| **admin** | Полный доступ. Все права moderator + управление ролями, AI-настройки, глобальные напоминания |
| **moderator** | Управление задачами других, summary, аналитика, управление отделами, редактирование участников |
| **member** | Только свои задачи, просмотр дерева команды (read-only) |

**Принцип:** `is_moderator()` возвращает True для admin И moderator → весь существующий код работает без изменений.

---

## Фаза 8 — Финальная матрица доступа (Web + API + Telegram)

| Роль / сценарий | Что видит в Web Dashboard | Что видит в Web `/tasks` + API `/api/tasks` | Что видит в Telegram |
|---|---|---|---|
| `member` с отделом | Большие метрики = мои задачи; малые = выбранный доступный отдел (обычно свой). Блок задач: «мои». | Задачи своего отдела; вне отдела доступ запрещён (`403`). | `/tasks` — свои. `/all` — задачи своего отдела. |
| `member` без отдела | Большие метрики = мои задачи; отделные метрики пустые (0). | Fallback-сценарий: только свои задачи. | `/tasks` и `/all` показывают только свои задачи. |
| `department head` (роль `member`, не `moderator`) | Может переключать блок «мои/отдел» для доступного отдела (где он head). | Видит задачи в доступных отделах (свой + где является head), без доступа к чужим отделам. | `/tasks` — свои. `/all` — задачи выбранного доступного отдела (с переключением отдела). |
| `moderator` / `admin` | Полный обзор по компании, включая выбор любого отдела. | Полный доступ к задачам компании, фильтры по отделу/исполнителю доступны без ограничений по отделам. | `/tasks` — свои. `/all` — задачи компании (все отделы или выбранный отдел), фильтры и пагинация. |

### Инварианты доступа

- Backend — источник истины: доступ к списку задач, карточке задачи и апдейтам проверяется сервером.
- Для недоступного `department_id` API возвращает `403`.
- Telegram карточка и timeline не открываются вне зоны видимости.

### Известные ограничения

- В Web на вкладке задач справочник отделов/исполнителей в фильтрах загружается полностью; для `member` недоступные значения не раскрывают данные, но могут приводить к `403` и пустому результату.
- Для матрицы доступа нет отдельного автоматизированного e2e-набора; актуальность подтверждается ручной проверкой и серверными ограничениями.

---

## Фазы реализации

---

### Фаза T1: Миграция БД + Модели

**Цель:** Новая таблица departments, расширение team_members, обновление ролей, schemas, repository.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md для контекста проекта. Затем прочитай TEAM_PLAN.md полностью.

=== ФАЗА T1: Миграция БД + Модели ===

1. МОДЕЛЬ Department — в backend/app/db/models.py:

   Добавь ПЕРЕД классом TeamMember:

   class Department(Base):
       __tablename__ = "departments"

       id: UUID PK, default=uuid4
       name: String(200), NOT NULL, unique=True
       description: Text, nullable
       head_id: ForeignKey("team_members.id"), nullable
       sort_order: Integer, default=0, server_default="0"
       color: String(7), nullable   # HEX цвет
       is_active: Boolean, default=True, server_default="true"
       created_at: server_default=func.now()

       Relationships:
       head → TeamMember (foreign_keys=[head_id])
       members → list[TeamMember] (back_populates="department", foreign_keys="TeamMember.department_id")

2. РАСШИРЕНИЕ TeamMember — в backend/app/db/models.py:

   Добавь новые поля (после name_variants, перед role):

   department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
   position: Mapped[str | None] = mapped_column(String(200), nullable=True)
   email: Mapped[str | None] = mapped_column(String(255), nullable=True)
   birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
   avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

   Добавь relationship:
   department: Mapped["Department | None"] = relationship(back_populates="members", foreign_keys=[department_id])

3. SCHEMAS — в backend/app/db/schemas.py:

   a) Изменить MemberRoleType:
      БЫЛО:  MemberRoleType = Literal["moderator", "member"]
      СТАЛО: MemberRoleType = Literal["admin", "moderator", "member"]

   b) Добавить в TeamMemberResponse (после name_variants):
      department_id: uuid.UUID | None
      position: str | None
      email: str | None
      birthday: date | None
      avatar_url: str | None

   c) Добавить в TeamMemberUpdate:
      department_id: uuid.UUID | None = None
      position: str | None = None
      email: str | None = None
      birthday: date | None = None

   d) Новые схемы:

      class DepartmentCreate(BaseModel):
          name: str
          description: str | None = None
          head_id: uuid.UUID | None = None
          color: str | None = None
          sort_order: int = 0

      class DepartmentUpdate(BaseModel):
          name: str | None = None
          description: str | None = None
          head_id: uuid.UUID | None = None
          color: str | None = None
          sort_order: int | None = None
          is_active: bool | None = None

      class DepartmentResponse(BaseModel):
          model_config = ConfigDict(from_attributes=True)
          id: uuid.UUID
          name: str
          description: str | None
          head_id: uuid.UUID | None
          color: str | None
          sort_order: int
          is_active: bool
          created_at: datetime

4. ALEMBIC МИГРАЦИЯ — backend/alembic/versions/004_team_departments_roles.py:

   upgrade:
   1. CREATE TABLE departments (все колонки из модели)
   2. ALTER TABLE team_members ADD COLUMN department_id, position, email, birthday, avatar_url
   3. op.execute("UPDATE team_members SET role = 'admin' WHERE role = 'moderator'")

   downgrade:
   1. op.execute("UPDATE team_members SET role = 'moderator' WHERE role = 'admin'")
   2. DROP COLUMNs: department_id, position, email, birthday, avatar_url
   3. DROP TABLE departments

5. REPOSITORY — backend/app/db/repositories.py:

   a) TeamMemberRepository.get_all_active — добавить eager loading:
      stmt = select(TeamMember).options(selectinload(TeamMember.department)).where(...)

   b) Новый DepartmentRepository:
      - get_all(session) → list[Department], order_by(sort_order, name), filter is_active
      - get_by_id(session, dept_id) → Department | None
      - create(session, **kwargs) → Department
      - update(session, dept_id, **kwargs) → Department | None
      - delete(session, dept_id) → bool

   Не забудь импортировать Department.

ПРОВЕРКА:
- alembic upgrade head → без ошибок
- Таблица departments создана
- team_members: новые колонки есть
- Все бывшие moderator → теперь admin
- python -m app.main стартует без ошибок
```

---

### Фаза T2: Backend — PermissionService + Auth + API

**Цель:** PermissionService для 3 ролей, обновлённый auth, CRUD отделов, endpoint дерева, загрузка аватаров.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md и TEAM_PLAN.md для контекста.

=== ФАЗА T2: Backend — PermissionService + Auth + API ===

1. PERMISSION SERVICE — полная замена backend/app/services/permission_service.py:

   Ключевая логика:
   - is_admin(member) → member.role == "admin"
   - is_moderator(member) → member.role in ("admin", "moderator")  ← admin = тоже moderator!
   - Все существующие can_* методы → используют is_moderator() (поведение НЕ меняется)
   - Новые admin-only:
     can_manage_roles → is_admin
     can_change_ai_settings → is_admin (ПОВЫСИТЬ с moderator)
     can_configure_reminders → is_admin (ПОВЫСИТЬ с moderator)
   - Новые moderator+:
     can_manage_departments → is_moderator

   Полный список методов (все @staticmethod):
   is_admin, is_moderator,
   can_create_task_for_others (moderator+), can_assign_task (moderator+),
   can_change_task_status (moderator+ или свой), can_add_task_update (moderator+ или свой),
   can_delete_task (moderator+), can_manage_team (moderator+),
   can_submit_summary (moderator+), can_subscribe_notifications (moderator+),
   can_manage_roles (admin), can_manage_departments (moderator+),
   can_change_ai_settings (admin), can_configure_reminders (admin)

2. AUTH — backend/app/api/auth.py:

   a) require_moderator:
      БЫЛО:  if member.role != "moderator"
      СТАЛО: if member.role not in ("admin", "moderator")

   b) Добавить require_admin:
      async def require_admin(member = Depends(get_current_user)) → TeamMember:
          if member.role != "admin": raise 403 "Доступ только для администраторов"

   c) login_telegram — сохранять Telegram photo:
      if data.photo_url:
          if not member.avatar_url or not member.avatar_url.startswith("/static/avatars/"):
              member.avatar_url = data.photo_url
      (Логика: перезаписывать только если нет кастомного аватара из /static/avatars/)

   d) /auth/me — расширить ответ:
      Добавить: position, department_id, avatar_url, email, birthday, name_variants, created_at, updated_at

3. DEPARTMENTS API — новый файл backend/app/api/departments.py:

   router = APIRouter(prefix="/departments", tags=["departments"])

   GET /departments → list[DepartmentResponse], Depends(get_current_user)
   GET /departments/{id} → DepartmentResponse, Depends(get_current_user)
   POST /departments → DepartmentResponse, status_code=201, Depends(require_moderator)
   PATCH /departments/{id} → DepartmentResponse, Depends(require_moderator)
   DELETE /departments/{id} → 204, Depends(require_moderator)
     При DELETE: проверить count участников с department_id == id, если > 0 → 400 "Нельзя удалить, сначала переместите участников"

4. TEAM API — обновить backend/app/api/team.py:

   a) Новый endpoint GET /team/tree:
      Возвращает:
      {
        "departments": [
          { ...dept_fields, "members": [ ...member_fields ] }
        ],
        "unassigned": [ ...member_fields ]
      }
      Группировка: members по department_id, без отдела → unassigned.
      Сортировка отделов: sort_order, name. Участники: full_name.

   b) PATCH /team/{id} — добавить проверку:
      if "role" in update_data and update_data["role"] != target.role:
          if not PermissionService.can_manage_roles(member):
              raise 403 "Только администратор может менять роли"

5. AVATAR UPLOAD — в backend/app/api/team.py:

   Константы:
   AVATAR_DIR = backend/static/avatars/
   ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
   MAX_SIZE = 2MB

   POST /team/{id}/avatar (require_moderator):
   - Принять UploadFile, валидация тип + размер
   - Pillow: Image.open → convert("RGB") → thumbnail(256,256) → save WebP quality=85
   - Сохранить в AVATAR_DIR/{member_id}.webp
   - Обновить avatar_url = "/static/avatars/{member_id}.webp"
   - Return: { "avatar_url": "..." }

   DELETE /team/{id}/avatar (require_moderator):
   - Удалить файл если есть
   - avatar_url = None
   - Return: { "avatar_url": null }

6. ПОДКЛЮЧЕНИЕ:

   a) backend/app/api/router.py — добавить departments_router
   b) backend/app/main.py — StaticFiles mount ПОСЛЕ include_router:
      from fastapi.staticfiles import StaticFiles
      app.mount("/static", StaticFiles(directory="backend/static"), name="static")
      Создать папку static/avatars/.
   c) Pillow: pip install Pillow --break-system-packages

ПРОВЕРКА:
- POST /api/departments {"name": "Разработка", "color": "#4F46E5"} → 201
- GET /api/departments → список
- PATCH /api/team/{id} {"department_id": "...", "position": "Dev"} → 200
- PATCH /api/team/{id} {"role": "moderator"} от non-admin → 403
- GET /api/team/tree → departments + unassigned
- POST /api/team/{id}/avatar + файл → avatar_url обновлён
- DELETE /api/team/{id}/avatar → null
- GET /api/auth/me → новые поля
```

---

### Фаза T3: Backend — Обновление бота

**Цель:** Обновить middleware, /start, /help, хендлеры для 3-ролевой модели.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md и TEAM_PLAN.md для контекста.

=== ФАЗА T3: Backend — Обновление бота ===

1. MIDDLEWARE — backend/app/bot/middlewares.py:

   a) Авторегистрация:
      БЫЛО:  role = "moderator" if user.id in ADMIN_TELEGRAM_IDS else "member"
      СТАЛО: role = "admin" if user.id in ADMIN_TELEGRAM_IDS else "member"

   b) Повышение существующих:
      БЫЛО:  member.role != "moderator" → role = "moderator"
      СТАЛО: member.role != "admin" → role = "admin"

2. /start — backend/app/bot/handlers/common.py:

   Три варианта роли:
   if PermissionService.is_admin(member):
       role_emoji, role_text = "👑", "Администратор"
   elif PermissionService.is_moderator(member):
       role_emoji, role_text = "🛡️", "Модератор"
   else:
       role_emoji, role_text = "👤", "Участник"

3. /help — backend/app/bot/handlers/common.py:

   Добавить: is_adm = PermissionService.is_admin(member)

   Оставить текущие модераторские команды для is_mod.
   Добавить секцию admin (если is_adm):
   "\n\n<b>👑 Администрирование:</b>\n"
   "/setrole @username admin|moderator|member — изменить роль\n"
   "⚙️ Настройки AI, напоминания — через веб-интерфейс"

4. ПРОВЕРКА ХЕНДЛЕРОВ:

   Пройдись по ВСЕМ файлам в backend/app/bot/handlers/:
   - tasks.py, task_updates.py, summary.py, meetings.py, voice.py
     → проверки is_moderator → ОСТАВИТЬ (admin проходит автоматически)
   - settings.py → AI/reminder настройки:
     если есть is_moderator для AI → заменить на is_admin
     если есть is_moderator для reminders → заменить на is_admin

5. (ОПЦИОНАЛЬНО) /setrole — в common.py или отдельный файл:

   @router.message(Command("setrole"))
   async def cmd_setrole(message, member):
       if not PermissionService.is_admin(member): → "⛔ Только администратор"
       args = message.text.split(maxsplit=2)
       if len(args) < 3: → usage
       username = args[1].lstrip("@"), new_role = args[2].lower()
       Валидация: new_role in ("admin", "moderator", "member")
       Найти по telegram_username → обновить role
       Ответ: "✅ Роль @username изменена на {new_role}"

   Для этого добавь в TeamMemberRepository метод:
   get_by_telegram_username(session, username) → select where telegram_username == username

ПРОВЕРКА:
- /start → "👑 Администратор" / "🛡️ Модератор" / "👤 Участник"
- /help → разные секции команд для каждой роли
- Все существующие бот-команды работают как раньше
```

---

### Фаза T4: Frontend — Типы, API, хуки, подготовка

**Цель:** Обновить types, API клиент, permissions, RoleBadge, создать хуки. Подготовка к фазе T5.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md и TEAM_PLAN.md для контекста.

=== ФАЗА T4: Frontend — Типы, API, хуки ===

1. TYPES — frontend/src/lib/types.ts:

   a) MemberRole: добавить "admin"
      СТАЛО: export type MemberRole = "admin" | "moderator" | "member";

   b) ROLE_LABELS: добавить admin: "Администратор"

   c) Новый интерфейс (перед TeamMember):
      export interface Department {
        id: string; name: string; description: string | null;
        head_id: string | null; color: string | null;
        sort_order: number; is_active: boolean; created_at: string;
      }

   d) TeamMember — добавить поля:
      department_id: string | null;
      position: string | null;
      email: string | null;
      birthday: string | null;
      avatar_url: string | null;

   e) Новые интерфейсы:
      export interface DepartmentWithMembers extends Department { members: TeamMember[]; }
      export interface TeamTreeResponse { departments: DepartmentWithMembers[]; unassigned: TeamMember[]; }

2. API — frontend/src/lib/api.ts:

   Новые методы:
   - getDepartments(): Promise<Department[]>
   - createDepartment(data): Promise<Department>
   - updateDepartment(id, data): Promise<Department>
   - deleteDepartment(id): Promise<void>
   - getTeamTree(): Promise<TeamTreeResponse>
   - uploadAvatar(memberId, file: File): Promise<{avatar_url: string}>
     ВАЖНО: использовать FormData, НЕ JSON. Без Content-Type header (браузер сам поставит multipart).
   - deleteAvatar(memberId): Promise<void>

3. PERMISSIONS — полная замена frontend/src/lib/permissions.ts:

   isAdmin(member) → role === "admin"
   isModerator(member) → role === "admin" || role === "moderator"
   Все can_* → используют isModerator (как раньше)
   Новые: canManageRoles (admin), canManageDepartments (moderator+),
          canChangeAiSettings (admin), canConfigureReminders (admin)

4. ROLEBADGE — frontend/src/components/shared/RoleBadge.tsx:

   Добавить import { Crown } from "lucide-react"
   В ROLE_CONFIG добавить:
   admin: { label: "Администратор", icon: Crown,
     className: "bg-role-admin-bg text-role-admin-fg ring-1 ring-inset ring-role-admin-ring" }

5. CSS + TAILWIND:

   a) globals.css — найти секцию role-* переменных, добавить admin:
      Light: --role-admin-bg: 270 60% 96%; --role-admin-fg: 270 60% 40%; --role-admin-ring: 270 40% 85%;
      Dark:  --role-admin-bg: 270 40% 20%; --role-admin-fg: 270 60% 75%; --role-admin-ring: 270 30% 35%;

   b) tailwind.config.ts — в colors.role добавить:
      admin: { bg, fg, ring } (аналогично moderator/member)

6. ХУКИ:

   a) frontend/src/hooks/useDepartments.ts:
      Стандартный хук: getDepartments → departments, loading, error, refetch

   b) frontend/src/hooks/useTeamTree.ts:
      Стандартный хук: getTeamTree → tree (TeamTreeResponse | null), loading, error, refetch

7. СОВМЕСТИМОСТЬ:

   Поискать grep -rn "role === \"moderator\"" по всему frontend/src/.
   Все прямые сравнения → заменить на PermissionService.isModerator(member).

ПРОВЕРКА:
- npm run build → без TS ошибок
- RoleBadge admin: фиолетовый с короной
- Sidebar: admin и moderator видят секцию "Управление"
```

---

### Фаза T5: Frontend — Дерево команды + Карточки

**Цель:** Полная переработка /team — дерево, карточки-превью, детальная карточка, редактирование, управление отделами, аватары.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md и TEAM_PLAN.md для контекста.
Прочитай docs/ai/frontend-design.md для дизайн-гайдлайнов.

=== ФАЗА T5: Frontend — Дерево команды + Карточки ===

ВАЖНО: Убрать ModeratorGuard со страницы /team — дерево видно ВСЕМ.
Кнопки редактирования и управления отделами — только для moderator+.

1. USERAVATAR — обновить frontend/src/components/shared/UserAvatar.tsx:

   Добавить props: avatarUrl?: string | null
   Добавить размер: xl → "h-20 w-20 text-2xl"
   Использовать AvatarImage из shadcn/ui:
     import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
   Если avatarUrl → <AvatarImage src={avatarUrl} />, fallback → инициалы (как сейчас).
   Если AvatarImage нет в ui/avatar — добавить.

2. СТРУКТУРА ФАЙЛОВ — создать frontend/src/app/team/components/:

   TeamTree.tsx, DepartmentNode.tsx, MemberCard.tsx,
   MemberDetailModal.tsx, MemberEditModal.tsx,
   DepartmentManager.tsx, AvatarUpload.tsx

3. page.tsx — ПОЛНАЯ ПЕРЕРАБОТКА frontend/src/app/team/page.tsx:

   "use client" — БЕЗ ModeratorGuard.
   Хуки: useTeamTree, useDepartments, useCurrentUser, memberStats (getMembersAnalytics).
   Состояния: search, selectedMember (detail modal), editMember (edit modal), showDeptManager.

   Layout:
   - Header: "Команда" + статистика (всего, активных, отделов) + поиск (Input)
   - Кнопка "Управление отделами" (Settings2 icon) — только если isModerator(user)
   - При search → плоский filtered список MemberCard
   - Без search → TeamTree
   - MemberDetailModal (selectedMember)
   - MemberEditModal (editMember)

4. TeamTree.tsx:
   Props: tree, memberStats, onMemberClick, onMemberEdit, canEdit
   Рендер: tree.departments.map → DepartmentNode
   + tree.unassigned → DepartmentNode с name="Без отдела", color="#6B7280"
   Staggered fade-in анимация.

5. DepartmentNode.tsx:
   Props: department (с members), memberStats, onMemberClick, onMemberEdit, canEdit, defaultExpanded=true
   Визуал: цветная полоска слева (border-l-4, style color), заголовок + badge "N чел."
   ChevronDown/ChevronRight toggle. Контент: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3
   Руководитель (head_id === member.id) помечен.

6. MemberCard.tsx:
   Props: member, stats?, isHead?, onClick, onEdit?
   КОМПАКТНАЯ карточка (~80px): rounded-2xl border bg-card p-4
   Flex row: Avatar (lg, с avatarUrl) + info + edit button
   Info: full_name (semibold), position (sm muted), RoleBadge
   isHead → ring ring-amber-400/50 или ⭐
   Hover: shadow-lg, -translate-y-0.5. Click → onClick. Edit button → group-hover:opacity-100
   !is_active → opacity-60. НЕ показывать статистику.

7. MemberDetailModal.tsx:
   Props: member | null, stats?, departments, onClose
   Dialog sm:max-w-lg.
   Desktop flex row: Левая (1/3): Avatar xl, name, position, RoleBadge.
   Правая (2/3): Контакты (Email mailto:, Telegram t.me/), Информация (Отдел цветная метка,
   Birthday "15 марта 1990", В команде с "март 2024"), Статистика задач (3 метрики),
   Варианты имени (chips).
   Мобильный: flex col. Пустые поля не показывать.

8. MemberEditModal.tsx:
   Props: member | null, departments, currentUserRole, onSave, onClose
   Поля: имя, роль (Select, DISABLED если не admin), статус, отдел (Select + "Без отдела"),
   должность, email, birthday (type="date"), варианты имени (chips), AvatarUpload.
   onSave → api.updateTeamMember + refetch.

9. AvatarUpload.tsx:
   Props: memberId, currentAvatarUrl, memberName, onAvatarChange
   UserAvatar xl → кнопка "Загрузить" (Upload) → hidden input accept="image/*"
   → превью → "Сохранить"/"Отмена"
   → api.uploadAvatar → onAvatarChange(newUrl)
   Если /static/avatars/ → кнопка "Удалить" → api.deleteAvatar → onAvatarChange(null)
   Loading state (Loader2).

10. DepartmentManager.tsx:
    Props: departments, members, onUpdate
    Dialog: список отделов (цветной кружок + название + count + Edit/Delete).
    Форма: название (required), описание, цвет (10 кружков:
    "#4F46E5","#0891B2","#059669","#D97706","#DC2626","#7C3AED","#DB2777","#2563EB","#65A30D","#EA580C"),
    руководитель (Select), порядок (number).
    CRUD через api. Delete только если 0 участников.

ПРОВЕРКА:
- Дерево: отделы + "Без отдела"
- Клик → детальная карточка (email, birthday, отдел, статистика)
- Аватары: фото или инициалы
- Редактирование: все поля + аватар + роли
- Управление отделами: создание/редактирование/удаление
- Поиск фильтрует
- member видит дерево, не видит кнопки редактирования
- Responsive: mobile OK
- Анимации: stagger, hover, collapse
```

---

### Фаза T6: Полировка, совместимость, тесты

**Цель:** Обновить sidebar, все UserAvatar, settings, CLAUDE.md. End-to-end проверка.

**Промпт для Claude Code:**

```
Прочитай CLAUDE.md и TEAM_PLAN.md для контекста.

=== ФАЗА T6: Полировка + совместимость ===

1. SIDEBAR — frontend/src/components/layout/Sidebar.tsx:

   a) /team → перенести из "manage" в "main", убрать moderatorOnly:
      БЫЛО: { href: "/team", label: "Команда", icon: Users, moderatorOnly: true, section: "manage" }
      СТАЛО: { href: "/team", label: "Команда", icon: Users, section: "main" }

   b) UserAvatar в footer → добавить avatarUrl:
      <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="default" />

2. ВСЕ USERAVATAR — обновить во всём проекте:

   Найди: grep -rn "UserAvatar" frontend/src/ --include="*.tsx"
   Для каждого вхождения → добавить avatarUrl={...avatar_url} если member/user объект доступен.
   Типичные места: Sidebar, Kanban карточки, Task detail/timeline, Meeting participants, Dashboard.
   Где объект недоступен — оставить без avatarUrl (fallback на инициалы).

3. SETTINGS — frontend/src/app/settings/:

   Если AI-настройки и напоминания сейчас показываются moderator:
   → Проверить что доступ теперь admin-only (canChangeAiSettings, canConfigureReminders)
   → Скрыть для moderator, показать только admin.

4. СОВМЕСТИМОСТЬ БОТА:

   grep -rn '== "moderator"' backend/app/ --include="*.py"
   Любые прямые == "moderator" (кроме PermissionService) → заменить на is_moderator().

5. CLAUDE.md — обновить:

   a) В "Текущий прогресс" добавить:

      ### Переработка вкладки «Команда» (TEAM_PLAN.md)

      - [x] Фаза T1: Миграция БД + Модели
      - [x] Фаза T2: Backend API + Permissions
      - [x] Фаза T3: Бот + совместимость
      - [x] Фаза T4: Frontend типы + API + хуки
      - [x] Фаза T5: Дерево + карточки
      - [x] Фаза T6: Полировка + совместимость

   b) Обновить описание:
      - 11 таблиц (добавить departments)
      - Ролевая модель: admin / moderator / member
      - В "Ключевые архитектурные решения" добавить описание 3 ролей

   c) В чеклист тестирования:
      | T1-T6 | Дерево команды, отделы, 3 роли, аватары, поиск, responsive |

6. END-TO-END ТЕСТ (вручную пройди):

   1. Создать 3 отдела с цветами
   2. Назначить участников + должности
   3. Загрузить аватар
   4. /team → дерево корректно
   5. Клик → детальная карточка
   6. Редактирование → все поля
   7. Поиск
   8. member → read-only
   9. Kanban → аватары с фото
   10. Бот /start → правильная роль
   11. npm run build → OK
   12. CLAUDE.md обновлён

ПРОВЕРКА:
- Всё работает end-to-end
- npm run build без ошибок
- Нет runtime ошибок в консоли
- Все UserAvatar показывают фото где доступно
- CLAUDE.md актуален
```

---

## Сводная таблица

| Фаза | Название | Оценка |
|------|----------|--------|
| **T1** | Миграция БД + Модели | 1 сессия |
| **T2** | Backend API + Permissions | 1-2 сессии |
| **T3** | Бот + совместимость | 1 сессия |
| **T4** | Frontend типы + API + хуки | 1 сессия |
| **T5** | Дерево + карточки (ОСНОВНАЯ) | 2-3 сессии |
| **T6** | Полировка + совместимость | 1 сессия |

**Итого: 7-9 сессий Claude Code**
