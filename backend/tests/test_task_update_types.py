from app.services.task_service import VALID_UPDATE_TYPES


def test_cancellation_is_valid_update_type():
    assert "cancellation" in VALID_UPDATE_TYPES


def test_all_legacy_types_present():
    """Regression: existing update types must not be dropped."""
    for t in ("comment", "progress", "status_change", "blocker", "completion"):
        assert t in VALID_UPDATE_TYPES, f"Missing legacy type: {t}"
