# План: Участники встреч + Фильтрация на дашборде

## Обзор задачи

**Проблема:** Сейчас при создании встреч (как из расписания, так и вручную) участники не всегда сохраняются корректно. На дашборде показываются ВСЕ встречи, а не те, в которых участвует текущий пользователь. Переключатель «Мои / Отдел» не влияет на блок встреч.

**Цель:** Участники фиксируются при создании встречи → дашборд фильтрует встречи по участию → переключатель «Мои / Отдел» влияет на встречи.

---

## Что уже есть (текущее состояние)

### БД
- Таблица `meeting_participants` (meeting_id, member_id) — **существует**, связь M2M.
- Модель `MeetingParticipant` — **есть** в models.py.
- Relationship `Meeting.participants` → `MeetingParticipant` — **есть**.

### Бэкенд
- `MeetingSchedule.participant_ids` (ARRAY UUID) — **хранит** список ID участников расписания.
- При создании расписания (`POST /meeting-schedules`) участники **пробрасываются** в первую автоматически созданную встречу через `MeetingParticipant`.
- В `MeetingSchedulerService._trigger_meeting()` при создании meeting из расписания участники **тоже пробрасываются**.
- `MeetingService.complete_meeting_with_summary()` — **обновляет** participants из AI-парсинга.
- **НО:** `MeetingService.create_manual_meeting()` — участников **НЕ принимает** и **НЕ сохраняет**.
- **НО:** `MeetingResponse` — участников **НЕ возвращает** (нет поля participant_ids).

### Фронтенд
- Дашборд: `api.getMeetings({ upcoming: true })` — **без фильтрации** по пользователю.
- Переключатель «Мои / Отдел» — **не влияет** на встречи.
- `Meeting` type — **нет** поля participants/participant_ids.

---

## Архитектура решения

```
┌─────────────────────────────────────────────────────────────┐
│                    Что нужно изменить                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Backend:                                                    │
│  1. MeetingResponse + participant_ids                        │
│  2. create_manual_meeting + participant_ids                  │
│  3. GET /meetings?member_id= / GET /meetings?department_id= │
│  4. Eager load participants в list queries                   │
│  5. PATCH /meetings/{id} + participant_ids                   │
│                                                              │
│  Frontend:                                                   │
│  6. Meeting type + participant_ids                           │
│  7. Форма создания встречи + multi-select участники          │
│  8. Дашборд: фильтрация встреч по «Мои / Отдел»            │
│  9. Карточка встречи: отображение/редактирование участников  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Фазы реализации

### Фаза P1: Бэкенд — участники в API встреч

**Что делаем:**
1. `MeetingResponse` в schemas.py — добавить `participant_ids: list[UUID] = []`
2. `_meeting_response()` — заполнять participant_ids из meeting.participants
3. Eager load `.options(selectinload(Meeting.participants))` во ВСЕХ запросах
4. `ManualMeetingCreate` + `create_manual_meeting()` — принять и сохранить participant_ids
5. `MeetingUpdate` + `PATCH /meetings/{id}` — обновление участников
6. `GET /meetings` — фильтрация по `member_id` и `department_id` через JOIN с meeting_participants

**Объём:** Средний

### Фаза P2: Фронтенд — типы, API, форма создания, карточка

**Что делаем:**
1. Тип `Meeting` в types.ts — добавить `participant_ids: string[]`
2. API-клиент — обновить getMeetings, createMeetingManual, updateMeeting
3. Форма создания ручной встречи — multi-select участников
4. Карточка встречи — отображение и редактирование участников

**Объём:** Средний

### Фаза P3: Дашборд — фильтрация встреч по «Мои / Отдел»

**Что делаем:**
1. Два состояния: myUpcomingMeetings / departmentUpcomingMeetings
2. Два запроса с member_id / department_id
3. scopedMeetings по текущему scope
4. Всегда показывать блок встреч (EmptyState если пусто)

**Объём:** Небольшой

---

## Сводка

| Фаза | Что делаем | Объём |
|------|-----------|-------|
| **P1** | Backend: participant_ids в response, create/update, фильтрация | Средний |
| **P2** | Frontend: типы, API, форма, карточка участников | Средний |
| **P3** | Dashboard: фильтрация встреч по «Мои / Отдел» | Небольшой |

---

## Технические заметки

### Что НЕ нужно менять
- Таблица `meeting_participants` — уже есть
- Модель `MeetingParticipant` — уже есть
- Расписание `MeetingSchedule.participant_ids` — уже работает
- `MeetingSchedulerService._trigger_meeting` — уже создает MeetingParticipant

### Миграции БД
- **НЕ нужны** — всё уже есть в схеме

### На что обратить внимание
- JOIN + `.distinct()` при фильтрации — обязательно
- Встречи без участников не будут видны в режиме «Мои» — это ок
- `complete_meeting_with_summary()` перезаписывает participants из AI
