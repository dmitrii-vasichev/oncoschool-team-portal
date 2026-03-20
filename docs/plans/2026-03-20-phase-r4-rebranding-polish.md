# Phase R4: Rebranding + Polish

**Date:** 2026-03-20
**PRD:** docs/prd-reports-and-rebranding.md
**Covers:** FR-13, FR-14, FR-18 (P1), FR-19 (P1), FR-21 (P2)
**Depends on:** Phase R3 (PR #86 merged)
**Project Board:** #14 (Oncoschool Portal)

## Task Dependency Order

```
R4.1 (Backend rebranding) ──┐
                             ├──→ R4.7 (README update)
R4.2 (Frontend rebranding) ─┤
                             │
R4.3 (Sidebar reorg) ───────┘

R4.4 (Section access rename) ──┬──→ R4.8 (Tests)
R4.5 (Per-section role labels) ─┘

R4.6 (Collection progress) ──→ R4.8
```

---

## R4.1 — Backend rebranding: "Task Manager" → "Портал"

**Description:** Replace all "Task Manager" branding in backend code with "Портал" / "Portal".

**Files:**
- `backend/app/main.py` — FastAPI app title
- `backend/app/bot/handlers/common.py` — bot auth message

**Implementation:**

1. `main.py`: Change FastAPI `title="Oncoschool Task Manager"` → `title="Oncoschool Portal"`
2. `common.py`: Change auth message `"Кто-то запрашивает вход в Task Manager Онкошколы через ваш аккаунт."` → `"Кто-то запрашивает вход в Портал Онкошколы через ваш аккаунт."`

**Acceptance Criteria:**
- FastAPI docs page shows "Oncoschool Portal"
- Bot auth message says "Портал Онкошколы"

**Verification:** `grep -r "Task Manager" backend/` returns no results

---

## R4.2 — Frontend rebranding: "Task Manager" → "Портал"

**Description:** Replace all "Task Manager" / "Таск-менеджер" branding in frontend code.

**Files:**
- `frontend/src/app/layout.tsx` — metadata title + description
- `frontend/src/app/login/page.tsx` — login page header
- `frontend/src/components/layout/Sidebar.tsx` — logo subtitle
- `frontend/src/app/globals.css` — design system comment

**Implementation:**

1. `layout.tsx`:
   - Title template: `"Онкошкола — Таск-менеджер"` → `"Онкошкола — Портал"`
   - Description: `"Система управления задачами для команды Онкошколы"` → `"Рабочий портал команды Онкошколы"`
2. `login/page.tsx`: `"Онкошкола · Таск-менеджер"` → `"Онкошкола · Портал"`
3. `Sidebar.tsx`: Subtitle `"Task Manager"` → `"Портал"` (line 223)
4. `globals.css`: Comment `"Design System — Онкошкола Task Manager"` → `"Design System — Онкошкола Portal"`

**Acceptance Criteria:**
- Browser tab shows "Онкошкола — Портал"
- Login page shows "Портал"
- Sidebar subtitle shows "Портал"

**Verification:** `grep -r "Task Manager\|Таск-менеджер\|Таск менеджер" frontend/src/` returns no results

---

## R4.3 — Sidebar reorganization into named sections

**Description:** Restructure sidebar navigation from 3 sections (main/content/manage) into 5 logical groups per PRD FR-14.

**Files:**
- `frontend/src/components/layout/Sidebar.tsx` — section structure + labels

**Implementation:**

Current sections: `main` (Dashboard, Задачи, Встречи, Аналитика, Команда) | `content` (Telegram-анализ, Отчёты) | `manage` (Рассылки, Настройки)

New structure:

| Section key | Label | Items |
|-------------|-------|-------|
| `dashboard` | *(no label, standalone)* | Dashboard |
| `work` | Операционное | Задачи, Встречи |
| `analytics` | Аналитика | Аналитика, Отчёты* |
| `content` | Контент | Telegram-анализ |
| `manage` | Управление | Команда, Рассылки, Настройки |

*Отчёты moves to "Аналитика" section (same content access check applies).

Changes:
1. Update `NavItem.section` type to `"dashboard" | "work" | "analytics" | "content" | "manage"`
2. Reassign nav items to new sections
3. Render sections with dividers and labels (dashboard has no label)
4. Keep existing access control logic (moderatorOnly, contentAccess) per item
5. "Команда" moves to "Управление" (moderatorOnly: true)

**Acceptance Criteria:**
- Dashboard stands alone at top without section label
- "Операционное" section contains Задачи + Встречи
- "Аналитика" section contains Аналитика + Отчёты
- "Контент" section contains Telegram-анализ
- "Управление" section contains Команда + Рассылки + Настройки
- Sections only visible when they have at least one visible item
- Collapsed sidebar shows dividers but no labels (existing behavior)

**Verification:** Visual check of sidebar in expanded and collapsed modes

---

## R4.4 — "Доступ к контенту" → "Доступ к разделам" rename

**Description:** Rename the content access management section in settings to reflect broader scope (reports + telegram analysis + future sections).

**Files:**
- `frontend/src/components/settings/ContentAccessSection.tsx` — title, description, sub-section labels

**Implementation:**

1. Title: `"Доступ к контенту"` → `"Доступ к разделам"` (line 118)
2. Description: `"Управление доступом пользователей и отделов к модулю контента"` → `"Управление доступом пользователей и отделов к разделам портала"` (line 121)
3. Add `reports` to `SUB_SECTION_LABELS`: `{ telegram_analysis: "Telegram-анализ", reports: "Отчёты" }` (line 41-43)
4. Add `reports` option to AddAccessDialog sub-section Select (line 317-321):
   ```tsx
   <SelectItem value="telegram_analysis">Telegram-анализ</SelectItem>
   <SelectItem value="reports">Отчёты</SelectItem>
   ```

**Acceptance Criteria:**
- Settings page shows "Доступ к разделам" heading
- Can grant access to both "Telegram-анализ" and "Отчёты" sub-sections
- Existing grants display correctly with new labels

**Verification:** Open /settings as admin, verify title and both sub-section options in add dialog

---

## R4.5 — Per-sub_section role labels and viewer role

**Description:** Different sections need different role labels: telegram_analysis uses Оператор/Редактор, reports uses Просмотр. Add `viewer` role to frontend type and UI.

**Files:**
- `frontend/src/lib/types.ts` — add `viewer` to ContentRole, update CONTENT_ROLE_LABELS
- `frontend/src/components/settings/ContentAccessSection.tsx` — dynamic role options per sub_section

**Implementation:**

1. `types.ts` (line 747): `ContentRole = "viewer" | "operator" | "editor"`
2. `types.ts` (line 751-754): Add viewer label:
   ```typescript
   export const CONTENT_ROLE_LABELS: Record<ContentRole, string> = {
     viewer: "Просмотр",
     operator: "Оператор",
     editor: "Редактор",
   };
   ```
3. `ContentAccessSection.tsx` — add `viewer` to ROLE_LABELS and ROLE_COLORS:
   ```typescript
   const ROLE_LABELS: Record<string, string> = {
     viewer: "Просмотр",
     operator: "Оператор",
     editor: "Редактор",
   };
   const ROLE_COLORS: Record<string, string> = {
     viewer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
     operator: "bg-blue-500/10 text-blue-600 border-blue-500/20",
     editor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
   };
   ```
4. Define available roles per sub_section:
   ```typescript
   const ROLES_BY_SECTION: Record<string, { value: ContentRole; label: string; desc: string }[]> = {
     telegram_analysis: [
       { value: "operator", label: "Оператор", desc: "просмотр и запуск анализа" },
       { value: "editor", label: "Редактор", desc: "управление каналами и промптами" },
     ],
     reports: [
       { value: "viewer", label: "Просмотр", desc: "просмотр отчётов и дашборда" },
     ],
   };
   ```
5. AddAccessDialog: When sub_section changes, reset role to first available. Render role options dynamically from `ROLES_BY_SECTION[subSection]`.

**Acceptance Criteria:**
- Granting access to "Telegram-анализ" shows roles: Оператор, Редактор
- Granting access to "Отчёты" shows role: Просмотр
- Table displays "Просмотр" badge in emerald for viewer grants
- Switching sub_section resets role to first available option

**Verification:** Create grants for both sub-sections, verify role options and table display

---

## R4.6 — Collection progress indicators

**Description:** Improve UX during GetCourse data collection (~15 min process). Show stage-based progress instead of a simple spinner.

**Files:**
- `frontend/src/app/reports/page.tsx` — enhanced collection UI

**Implementation:**

Current behavior: Button shows `Loader2` spinner while `collecting === true`. No stages.

Enhanced approach (UI-only, no backend changes):
1. Replace simple boolean `collecting` with a progress state:
   ```typescript
   type CollectionStage = "idle" | "requesting" | "collecting" | "done" | "error";
   const [stage, setStage] = useState<CollectionStage>("idle");
   const [collectStartTime, setCollectStartTime] = useState<number | null>(null);
   const [elapsedSeconds, setElapsedSeconds] = useState(0);
   ```
2. Show progress banner below KPI cards when collecting:
   ```
   ┌──────────────────────────────────────────────────┐
   │ ⏳ Сбор данных...  Прошло: 2:34 / ~15 мин       │
   │ ████████░░░░░░░░░░░░  ~17%                       │
   │ Собираем данные из GetCourse (пользователи,       │
   │ платежи, заказы). Можно продолжить работу.        │
   └──────────────────────────────────────────────────┘
   ```
3. Progress bar estimates based on elapsed time vs 15 min (max 95% until actually done)
4. Timer: `useEffect` with `setInterval(1000)` increments `elapsedSeconds` while stage is active
5. "Обновить данные" button disabled during collection, shows "Сбор данных..." text
6. On completion: green success banner for 5 seconds, then auto-dismiss + refetch data

**Acceptance Criteria:**
- Clicking "Обновить данные" shows progress banner with elapsed timer
- Progress bar moves based on elapsed time (estimated 15 min)
- User sees helpful message that they can continue working
- Success/error banner appears when collection completes
- Button re-enables after completion

**Verification:** Trigger manual collection, observe progress UI

---

## R4.7 — README and docs update

**Description:** Update README.md and project docs with new "Портал" branding.

**Files:**
- `README.md` — title, description

**Implementation:**

1. `README.md`:
   - Title: `"# Онкошкола — Таск-менеджер"` → `"# Онкошкола — Портал"`
   - Update description to reflect portal scope (tasks + meetings + reports + content analysis + broadcasts)

**Acceptance Criteria:**
- README reflects "Портал" branding
- Description matches current feature set

**Verification:** Read updated README

---

## R4.8 — Tests

**Description:** Add tests covering rebranding, sidebar structure, and role labels.

**Files:**
- `backend/tests/test_rebranding.py` — NEW: verify FastAPI title, bot message text
- `frontend/src/__tests__/sidebar.test.ts` or equivalent — verify nav structure (if test infra exists)

**Implementation:**

Backend tests:
1. Test FastAPI app title contains "Portal" (not "Task Manager")
2. Test auth message contains "Портал"

Frontend tests (if test infra available):
1. Verify NAV_ITEMS section assignments match expected structure
2. Verify ROLES_BY_SECTION contains correct roles per sub_section
3. Verify SUB_SECTION_LABELS covers all ContentSubSection values

**Acceptance Criteria:**
- All tests pass
- `npm run build` succeeds (frontend type-check)
- `npm run lint` passes

**Verification:** `cd backend && python -m pytest tests/test_rebranding.py -v` + `cd frontend && npm run build`
