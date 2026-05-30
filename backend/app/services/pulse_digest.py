"""Pure builder for the company Pulse digest message.

A daily job queries yesterday's :class:`~app.db.models.ActivityEvent` rows and
passes them here to render the text posted to the company-wide Telegram channel.

This module is intentionally pure -- no DB, no aiogram, no I/O -- so it is
trivially unit-testable, mirroring the pure helpers in
``app/bot/handlers/escalation.py`` (e.g. ``build_escalation_dm_text``).

REDACTION CONTRACT: the company digest is readable by members from *all*
departments, so it must never leak another department's task details. Only safe
info is rendered -- actor name, department name and the kind of event. Task
titles, short_ids and blocker text are deliberately omitted.
"""

import html

from app.db.models import ActivityEvent


def _bullet(payload: dict) -> str:
    """Render a single redacted bullet: ``• {actor} ({department})``.

    Both interpolated values are user-supplied, so they are HTML-escaped to keep
    the ``parse_mode="HTML"`` message well-formed. When the department is missing
    we omit the parentheses entirely rather than render an empty ``()``.
    """
    actor = html.escape(str(payload.get("actor_name") or "—"))
    department = payload.get("department_name")
    if department:
        return f"• {actor} ({html.escape(str(department))})"
    return f"• {actor}"


def build_company_digest(events: list[ActivityEvent], tz: str) -> str | None:
    """Render the company Pulse digest text from a list of activity events.

    Returns an HTML-formatted string (sent with ``parse_mode="HTML"``) or
    ``None`` when there is no shareable content.

    Grouping:
      * ``task_completed``  -> "✅ Закрыто" section (redacted bullets).
      * ``blocker_raised``  -> "🔴 Блокеры (нужна помощь)" section (redacted).
      * ``progress_update`` -> ignored entirely (too noisy company-wide).

    Returns ``None`` if ``events`` is empty, or if after filtering there are no
    completions and no blockers (e.g. only progress updates) -- the job then
    skips sending so there is no "nothing happened" message.

    ``tz`` is accepted for signature stability (a future revision may label the
    digest with the localized "yesterday" date); it is currently unused.
    """
    completions = [e for e in events if e.event_type == "task_completed"]
    blockers = [e for e in events if e.event_type == "blocker_raised"]

    if not completions and not blockers:
        return None

    lines = [
        "📊 <b>Пульс команды</b>",
        f"За вчера: закрыто {len(completions)}, новых блокеров {len(blockers)}",
    ]

    if completions:
        lines.append("")
        lines.append("✅ <b>Закрыто:</b>")
        lines.extend(_bullet(e.payload or {}) for e in completions)

    if blockers:
        lines.append("")
        lines.append("🔴 <b>Блокеры (нужна помощь):</b>")
        lines.extend(_bullet(e.payload or {}) for e in blockers)

    return "\n".join(lines)


# ── Personal digest "Pulse" block (Task 15) ──

_PERSONAL_EVENT_VERBS = {
    "task_completed": "закрыл задачу",
    "blocker_raised": "отметил блокер",
    "progress_update": "обновил прогресс",
}


def build_personal_pulse_text(
    changed_events: list[ActivityEvent], completed_week_count: int
) -> str | None:
    """Render the personal "what changed about you" + weekly recap block.

    ``changed_events`` are activity events created in the last 24h on the
    member's OWN tasks by *other* people (caller filters by assignee/actor).
    Because these are the member's own tasks, no redaction is applied -- the
    member is allowed to see all details. Order is preserved as given (the
    caller passes newest-first).

    ``completed_week_count`` is how many tasks the member personally closed in
    the last 7 days; when positive a trophy recap line is appended.

    Returns an HTML-formatted string (sent with ``parse_mode="HTML"``) or
    ``None`` when there is nothing to show (no changed events AND a zero count).
    """
    if not changed_events and completed_week_count <= 0:
        return None

    lines: list[str] = []

    if changed_events:
        lines.append("🔔 <b>Что изменилось:</b>")
        for event in changed_events:
            actor = html.escape(str((event.payload or {}).get("actor_name") or "Коллега"))
            verb = _PERSONAL_EVENT_VERBS.get(event.event_type)
            if verb is None:
                continue
            lines.append(f"• {actor} {verb}")

    if completed_week_count > 0:
        lines.append(f"🏆 За неделю ты закрыл {completed_week_count} задач(и).")

    return "\n".join(lines)
