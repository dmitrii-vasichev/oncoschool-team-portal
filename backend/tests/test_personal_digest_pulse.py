"""Pure unit tests for the personal-digest Pulse helpers (Task 15).

No DB, no async, no aiogram I/O: transient objects are built in memory and
passed straight to the pure builders. ``build_personal_pulse_text`` renders the
"what changed about you" + weekly-recap block; ``build_pulse_task_action_rows``
builds the one-tap action button rows.
"""

import types

from app.bot.keyboards import build_pulse_task_action_rows
from app.db.models import ActivityEvent
from app.services.pulse_digest import build_personal_pulse_text


def _ev(event_type: str, payload: dict) -> ActivityEvent:
    return ActivityEvent(event_type=event_type, payload=payload)


# ---------------------------------------------------------------------------
# build_personal_pulse_text
# ---------------------------------------------------------------------------

def test_empty_events_and_zero_count_returns_none():
    assert build_personal_pulse_text([], 0) is None


def test_empty_events_with_count_returns_recap_only():
    out = build_personal_pulse_text([], 3)
    assert out is not None
    assert "3" in out
    # No "what changed" header when there are no changed events.
    assert "Что изменилось" not in out


def test_single_blocker_event_no_recap():
    out = build_personal_pulse_text(
        [_ev("blocker_raised", {"actor_name": "Игорь"})], 0
    )
    assert out is not None
    assert "Игорь" in out
    assert "блокер" in out
    # No weekly recap line when count is 0.
    assert "неделю" not in out


def test_actor_name_is_html_escaped():
    out = build_personal_pulse_text(
        [_ev("progress_update", {"actor_name": "<b>x</b>"})], 0
    )
    assert out is not None
    assert "&lt;b&gt;x&lt;/b&gt;" in out
    assert "<b>x</b>" not in out


def test_missing_actor_name_falls_back_to_kollega():
    out = build_personal_pulse_text([_ev("blocker_raised", {})], 0)
    assert out is not None
    assert "Коллега" in out


def test_event_type_rendering():
    out = build_personal_pulse_text(
        [
            _ev("task_completed", {"actor_name": "A"}),
            _ev("blocker_raised", {"actor_name": "B"}),
            _ev("progress_update", {"actor_name": "C"}),
        ],
        0,
    )
    assert out is not None
    assert "A закрыл задачу" in out
    assert "B отметил блокер" in out
    assert "C обновил прогресс" in out


def test_mixed_events_and_count_both_sections():
    out = build_personal_pulse_text(
        [_ev("blocker_raised", {"actor_name": "Игорь"})], 5
    )
    assert out is not None
    assert "Что изменилось" in out
    assert "блокер" in out
    # Weekly recap present too.
    assert "5" in out
    assert "неделю" in out


def test_events_preserve_given_order():
    out = build_personal_pulse_text(
        [
            _ev("blocker_raised", {"actor_name": "First"}),
            _ev("progress_update", {"actor_name": "Second"}),
        ],
        0,
    )
    assert out is not None
    assert out.index("First") < out.index("Second")


# ---------------------------------------------------------------------------
# build_pulse_task_action_rows
# ---------------------------------------------------------------------------

def test_action_rows_empty():
    assert build_pulse_task_action_rows([]) == []


def test_action_rows_two_tasks():
    tasks = [types.SimpleNamespace(short_id=42), types.SimpleNamespace(short_id=7)]
    rows = build_pulse_task_action_rows(tasks)
    assert len(rows) == 2
    for row in rows:
        assert len(row) == 3
    # First row callbacks reference short_id 42.
    first = rows[0]
    assert first[0].callback_data == "pulse:done:42"
    assert first[1].callback_data == "pulse:wip:42"
    assert first[2].callback_data == "pulse:blk:42"
    assert first[0].text == "✅ #42"
    assert first[1].text == "⏳"
    assert first[2].text == "🚧"
    # Second row references short_id 7.
    assert rows[1][0].callback_data == "pulse:done:7"


def test_action_rows_capped_at_limit():
    tasks = [types.SimpleNamespace(short_id=i) for i in range(7)]
    rows = build_pulse_task_action_rows(tasks)
    assert len(rows) == 5


def test_action_rows_custom_limit():
    tasks = [types.SimpleNamespace(short_id=i) for i in range(7)]
    rows = build_pulse_task_action_rows(tasks, limit=2)
    assert len(rows) == 2


def test_action_rows_callback_under_64_bytes():
    tasks = [types.SimpleNamespace(short_id=9_999_999)]
    rows = build_pulse_task_action_rows(tasks)
    for btn in rows[0]:
        assert len(btn.callback_data.encode("utf-8")) <= 64
