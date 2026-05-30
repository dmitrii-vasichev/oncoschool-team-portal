"""Unit tests for the Team Pulse Telegram reaction glue (Task 13).

Two pure, DB-free surfaces are covered:
  - ``parse_pulse_callback`` — the aiogram-free callback_data parser
    (mirrors ``parse_escalation_callback``);
  - ``build_pulse_reaction_keyboard`` — builds the 👏 reaction keyboard
    attached to the company Pulse digest.

The aiogram callback handler itself is thin glue over ``toggle_reaction`` +
``notify_reaction`` (already covered in Task 6/7), so it is not exercised here.
"""

import uuid

import pytest
from aiogram.types import InlineKeyboardMarkup

from app.bot.handlers.pulse import parse_pulse_callback
from app.bot.keyboards import build_pulse_reaction_keyboard
from app.db.models import ActivityEvent


# ---------------------------------------------------------------------------
# Pure parser tests (table-driven)
# ---------------------------------------------------------------------------

_VALID_CASES = [
    # react form (4 parts) — regression, must stay a 3-tuple with the event id
    (
        f"pulse:react:clap:{uuid.UUID(int=1)}",
        ("react", "clap", str(uuid.UUID(int=1))),
    ),
    (
        f"pulse:react:fire:{uuid.UUID(int=2)}",
        ("react", "fire", str(uuid.UUID(int=2))),
    ),
    (
        "pulse:react:party:abc-123",
        ("react", "party", "abc-123"),
    ),
    # one-tap task-update forms (3 parts) — extra is always None
    ("pulse:done:42", ("done", "42", None)),
    ("pulse:wip:7", ("wip", "7", None)),
    ("pulse:blk:99", ("blk", "99", None)),
]


@pytest.mark.parametrize("data, expected", _VALID_CASES)
def test_parse_pulse_callback_valid(data: str, expected: tuple) -> None:
    assert parse_pulse_callback(data) == expected


_MALFORMED_CASES = [
    "pulse:react:clap",          # react with too few parts
    "esc:complete:5",            # wrong prefix
    "pulse:done",                # action with too few parts (2)
    "pulse:done:1:2",            # non-react action with too many parts (4)
    "pulse:react:clap:x:extra",  # react with too many parts
    "pulse:unknown:1",           # unknown action
    "",                          # empty
    "pulse",                     # single token
]


@pytest.mark.parametrize("data", _MALFORMED_CASES)
def test_parse_pulse_callback_malformed(data: str) -> None:
    with pytest.raises(ValueError):
        parse_pulse_callback(data)


# ---------------------------------------------------------------------------
# Keyboard builder tests (pure, no DB)
# ---------------------------------------------------------------------------

def _completion(actor_name: str = "Anna") -> ActivityEvent:
    """A transient task_completed event with a fixed UUID (no flush)."""
    return ActivityEvent(
        id=uuid.uuid4(),
        event_type="task_completed",
        payload={"actor_name": actor_name},
    )


def _non_completion(event_type: str) -> ActivityEvent:
    return ActivityEvent(
        id=uuid.uuid4(),
        event_type=event_type,
        payload={"actor_name": "Bob"},
    )


def test_keyboard_one_button_per_completion() -> None:
    ev = _completion("Anna")
    markup = build_pulse_reaction_keyboard([ev])

    assert isinstance(markup, InlineKeyboardMarkup)
    buttons = [btn for row in markup.inline_keyboard for btn in row]
    assert len(buttons) == 1
    assert "Anna" in buttons[0].text
    assert buttons[0].callback_data == f"pulse:react:clap:{ev.id}"


def test_keyboard_multiple_completions() -> None:
    events = [_completion(f"User{i}") for i in range(3)]
    markup = build_pulse_reaction_keyboard(events)

    buttons = [btn for row in markup.inline_keyboard for btn in row]
    assert len(buttons) == 3
    expected = {f"pulse:react:clap:{ev.id}" for ev in events}
    assert {btn.callback_data for btn in buttons} == expected


def test_keyboard_missing_actor_name_falls_back() -> None:
    ev = ActivityEvent(
        id=uuid.uuid4(), event_type="task_completed", payload={}
    )
    markup = build_pulse_reaction_keyboard([ev])
    buttons = [btn for row in markup.inline_keyboard for btn in row]
    assert "Коллега" in buttons[0].text


def test_keyboard_no_completions_returns_none() -> None:
    events = [_non_completion("task_blocked"), _non_completion("task_progress")]
    assert build_pulse_reaction_keyboard(events) is None


def test_keyboard_empty_list_returns_none() -> None:
    assert build_pulse_reaction_keyboard([]) is None


def test_keyboard_ignores_non_completion_events() -> None:
    events = [
        _non_completion("task_blocked"),
        _completion("Anna"),
        _non_completion("task_progress"),
    ]
    markup = build_pulse_reaction_keyboard(events)
    buttons = [btn for row in markup.inline_keyboard for btn in row]
    assert len(buttons) == 1
    assert "Anna" in buttons[0].text


def test_keyboard_caps_at_eight() -> None:
    events = [_completion(f"User{i}") for i in range(12)]
    markup = build_pulse_reaction_keyboard(events)
    buttons = [btn for row in markup.inline_keyboard for btn in row]
    assert len(buttons) == 8
    # The first 8 completions are the ones kept.
    expected = {f"pulse:react:clap:{ev.id}" for ev in events[:8]}
    assert {btn.callback_data for btn in buttons} == expected


def test_keyboard_callback_data_within_limit() -> None:
    events = [_completion(f"User{i}") for i in range(8)]
    markup = build_pulse_reaction_keyboard(events)
    buttons = [btn for row in markup.inline_keyboard for btn in row]
    for btn in buttons:
        assert len(btn.callback_data.encode("utf-8")) <= 64
