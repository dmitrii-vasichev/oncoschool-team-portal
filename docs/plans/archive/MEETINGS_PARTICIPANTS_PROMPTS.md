# Промпты для Claude Code — Участники встреч + Фильтрация

---

## Фаза P1: Бэкенд — участники в API встреч

```
Прочитай CLAUDE.md для контекста проекта.

=== ЗАДАЧА: Добавить участников (participant_ids) во встречи + фильтрация ===

Сейчас таблица meeting_participants и модель MeetingParticipant УЖЕ существуют.
Связь Meeting.participants → MeetingParticipant тоже есть.
НО: API не возвращает участников, ручное создание встреч не принимает участников,
и нет фильтрации встреч по участию.

=== ШАГ 1: Обнови MeetingResponse в backend/app/db/schemas.py ===

Добавь поле:
    participant_ids: list[uuid.UUID] = []

=== ШАГ 2: Обнови _meeting_response() в backend/app/api/meetings.py ===

После model_validate, подгрузи participant_ids:
    resp.participant_ids = [p.member_id for p in (meeting.participants or [])]

Убедись что meeting.participants загружен (selectinload).

=== ШАГ 3: Eager load participants во ВСЕХ запросах встреч ===

В MeetingRepository (backend/app/db/repositories.py):
- get_upcoming() — добавь .options(selectinload(Meeting.participants))
- get_past() — добавь .options(selectinload(Meeting.participants))

В backend/app/api/meetings.py endpoint list_meetings:
- Во все inline-запросы (select(Meeting)...) тоже добавь selectinload(Meeting.participants)

=== ШАГ 4: create_manual_meeting — принять participant_ids ===

В ManualMeetingCreate (api/meetings.py):
- Добавь: participant_ids: list[uuid.UUID] = []

В MeetingService.create_manual_meeting() (services/meeting_service.py):
- Добавь параметр participant_ids: list[uuid.UUID] = []
- После создания Meeting и flush — создай MeetingParticipant записи:
    from app.db.models import MeetingParticipant
    for pid in participant_ids:
        session.add(MeetingParticipant(meeting_id=meeting.id, member_id=pid))
    await session.flush()

В endpoint POST /meetings:
- Пробрось data.participant_ids в сервис

=== ШАГ 5: PATCH /meetings/{id} — обновление участников ===

В MeetingUpdate (api/meetings.py) — добавь:
    participant_ids: list[uuid.UUID] | None = None

В endpoint PATCH /meetings/{id}:
- Если "participant_ids" в fields:
    participant_ids = fields.pop("participant_ids")
    from sqlalchemy import delete as sa_delete
    from app.db.models import MeetingParticipant
    await session.execute(
        sa_delete(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting_id)
    )
    for pid in participant_ids:
        session.add(MeetingParticipant(meeting_id=meeting_id, member_id=pid))
    await session.flush()
  Обработай это ДО вызова meeting_service.update_meeting()

=== ШАГ 6: Фильтрация GET /meetings по участию ===

Добавь query-параметры в endpoint list_meetings:
    member_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,

Рефакторь endpoint: вынеси построение базового stmt в helper-функцию, чтобы фильтрация
применялась единообразно для upcoming, past и all запросов.

Логика фильтрации (применяется после базового stmt):

Если member_id передан:
    from app.db.models import MeetingParticipant
    stmt = stmt.join(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id).where(
        MeetingParticipant.member_id == member_id
    )

Если department_id передан:
    from app.db.models import MeetingParticipant, TeamMember
    stmt = stmt.join(MeetingParticipant, Meeting.id == MeetingParticipant.meeting_id).join(
        TeamMember, MeetingParticipant.member_id == TeamMember.id
    ).where(
        TeamMember.department_id == department_id
    )

В ОБОИХ случаях добавь .distinct() в конце (перед .limit()):
    stmt = stmt.distinct()

ВАЖНО: Добавь нужные импорты.
ВАЖНО: .distinct() обязателен чтобы не дублировать встречи.

=== ПРОВЕРКА ===

1. GET /meetings?upcoming=true — возвращает participant_ids в каждой встрече
2. POST /meetings с participant_ids=[...] — участники сохраняются
3. PATCH /meetings/{id} с participant_ids=[...] — участники обновляются
4. GET /meetings?upcoming=true&member_id=<uuid> — только встречи этого участника
5. GET /meetings?upcoming=true&department_id=<uuid> — встречи с участниками из отдела
6. Встречи созданные из расписания (уже имеющие participants) — тоже возвращают participant_ids
```

---

## Фаза P2: Фронтенд — типы, API, форма создания, карточка

```
Прочитай CLAUDE.md для контекста проекта. Прочитай docs/ai/frontend-design.md для дизайн-гайдлайнов.

=== ЗАДАЧА: Фронтенд — участники во встречах ===

Бэкенд теперь возвращает participant_ids в MeetingResponse и принимает их при создании/обновлении.
API поддерживает фильтрацию по member_id и department_id.

=== ШАГ 1: Обнови тип Meeting в frontend/src/lib/types.ts ===

Добавь поле в интерфейс Meeting:
    participant_ids: string[];

=== ШАГ 2: Обнови API-клиент в frontend/src/lib/api.ts ===

getMeetings — добавь параметры member_id и department_id:
    Передавай их как query-параметры: ?member_id=...&department_id=...

createMeetingManual — добавь participant_ids в body

updateMeeting — добавь participant_ids в допустимые поля для update

=== ШАГ 3: Форма создания ручной встречи — multi-select участников ===

Найди компонент/модалку для создания встречи на странице /meetings (page.tsx или компоненты).
Добавь multi-select "Участники" аналогично тому как сделано в ScheduleForm.tsx для расписания:
- Загрузи team_members через api.getTeam()
- Покажи multi-select с именами и аватарками
- Передай participant_ids при создании

=== ШАГ 4: Карточка встречи /meetings/[id] — блок участников ===

На странице /meetings/[id]:
- Всегда показывай участников из meeting.participant_ids
- Подтягивай данные (имена, аватарки) из team_members
- Модератор: кнопка "Редактировать участников" → multi-select → PATCH /meetings/{id} с новыми participant_ids

Если участники ещё не назначены — покажи placeholder "Участники не указаны"
с кнопкой "Добавить" для модератора.

=== ПРОВЕРКА ===

1. На странице /meetings создай встречу с выбранными участниками → они сохраняются
2. Открой карточку встречи → участники отображаются с аватарками
3. Отредактируй участников → обновление работает
4. Встречи из расписания → участники тоже видны
```

---

## Фаза P3: Дашборд — фильтрация встреч по «Мои / Отдел»

```
Прочитай CLAUDE.md для контекста проекта.

=== ЗАДАЧА: Дашборд — фильтрация встреч по переключателю «Мои / Отдел» ===

Сейчас на дашборде (frontend/src/app/page.tsx) блок "Предстоящие встречи" 
показывает ВСЕ предстоящие встречи без фильтрации. Переключатель «Мои / Отдел» 
влияет только на задачи.

Нужно: переключатель «Мои / Отдел» должен также фильтровать встречи.
- «Мои» → встречи где я являюсь участником (member_id = мой id)
- «Отдел» → встречи где хотя бы один участник из моего отдела (department_id)

API уже поддерживает параметры member_id и department_id в GET /meetings.

=== ШАГ 1: Добавь два состояния для встреч ===

Замени:
    const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);

На:
    const [myUpcomingMeetings, setMyUpcomingMeetings] = useState<Meeting[]>([]);
    const [departmentUpcomingMeetings, setDepartmentUpcomingMeetings] = useState<Meeting[]>([]);

=== ШАГ 2: Обнови запросы в fetchData ===

Замени текущий запрос:
    api.getMeetings({ upcoming: true })

На два запроса в Promise.all (добавь к существующим):
    api.getMeetings({ upcoming: true, member_id: userId }),
    selectedDepartmentParam
      ? api.getMeetings({ upcoming: true, department_id: selectedDepartmentParam })
      : Promise.resolve([]),

Сохрани результаты:
    const myMeetingsData = results[N] as Meeting[] | null;
    const deptMeetingsData = results[N+1] as Meeting[] | null;
    setMyUpcomingMeetings(myMeetingsData ? myMeetingsData.slice(0, 3) : []);
    setDepartmentUpcomingMeetings(deptMeetingsData ? deptMeetingsData.slice(0, 3) : []);

Удали старый setUpcomingMeetings.

=== ШАГ 3: Используй scopedMeetings при рендере ===

Добавь:
    const scopedMeetings = currentScope === "department" 
      ? departmentUpcomingMeetings 
      : myUpcomingMeetings;

Замени все ссылки на upcomingMeetings на scopedMeetings в JSX.

=== ШАГ 4: Обнови заголовок секции ===

    title={currentScope === "department" ? "Встречи отдела" : "Мои встречи"}

=== ШАГ 5: Всегда показывай блок встреч ===

Сейчас блок скрывается если upcomingMeetings.length === 0:
    {upcomingMeetings.length > 0 && ( ... )}

Измени на: всегда показывай блок. Если scopedMeetings пусто — покажи EmptyState:
    {scopedMeetings.length === 0 ? (
      <EmptyState
        variant="meetings"   // или подходящий вариант
        title={currentScope === "department" 
          ? "В отделе нет предстоящих встреч" 
          : "У вас нет предстоящих встреч"}
        description={currentScope === "department"
          ? "Встречи с участниками вашего отдела появятся здесь"
          : "Встречи, в которых вы участвуете, появятся здесь"}
        className="py-6"
      />
    ) : (
      <div className="grid gap-3 md:grid-cols-3">
        {scopedMeetings.map(...)}
      </div>
    )}

=== ПРОВЕРКА ===

1. Залогинься как member, у которого есть встречи → «Мои» → видишь свои встречи
2. Переключи на «Отдел» → видишь встречи отдела
3. Если member не участник ни одной встречи → пустое состояние, блок НЕ скрыт
4. Переключение между отделами (если доступно) → встречи обновляются
5. Модератор → те же правила фильтрации (модератор тоже видит только свои/отдела)
```
