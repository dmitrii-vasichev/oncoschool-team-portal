import ast
from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "042_content_factory_guest_story.py"
)
EVENT_MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "043_content_factory_guest_story_events.py"
)
THREAD_MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "044_cf_guest_story_event_threads.py"
)
ALEMBIC_VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"
ALEMBIC_VERSION_NUM_MAX_LENGTH = 32


def _extract_literal_assignment(source: str, name: str) -> str | None:
    module = ast.parse(source)
    for node in module.body:
        if not isinstance(node, ast.AnnAssign):
            continue
        if not isinstance(node.target, ast.Name):
            continue
        if node.target.id != name or not isinstance(node.value, ast.Constant):
            continue
        if isinstance(node.value.value, str):
            return node.value.value
    return None


def test_alembic_revision_ids_fit_version_table_limit():
    oversized_revisions = []

    for migration in sorted(ALEMBIC_VERSIONS.glob("*.py")):
        if migration.name == "__init__.py":
            continue
        revision = _extract_literal_assignment(migration.read_text(), "revision")
        if revision is not None and len(revision) > ALEMBIC_VERSION_NUM_MAX_LENGTH:
            oversized_revisions.append((migration.name, revision, len(revision)))

    assert oversized_revisions == []


def test_guest_story_migration_creates_table_and_consent_columns():
    source = MIGRATION.read_text()

    assert 'revision: str = "042_content_factory_guest_story"' in source
    assert 'down_revision: Union[str, None] = "041"' in source
    assert '"cf_guest_story"' in source
    assert '"display_name"' in source
    assert '"status"' in source
    assert '"owner_id"' in source
    assert '"consent_status"' in source
    assert '"consent_version"' in source
    assert '"consent_signed_at"' in source
    assert '"allowed_channels"' in source
    assert '"anonymity_level"' in source
    assert '"sensitive_topics"' in source
    assert '"legal_notes"' in source
    assert '"gift_status"' in source
    assert '"follow_up_due_at"' in source


def test_guest_story_migration_indexes_and_downgrade():
    source = MIGRATION.read_text()

    assert '"ix_cf_guest_story_status"' in source
    assert '"ix_cf_guest_story_owner"' in source
    assert '"ix_cf_guest_story_bundle"' in source
    assert '"ix_cf_guest_story_publication"' in source
    assert '"ix_cf_guest_story_stage_due"' in source
    assert 'op.drop_table("cf_guest_story")' in source


def test_guest_story_event_migration_creates_table_and_indexes():
    source = EVENT_MIGRATION.read_text()

    assert 'revision: str = "043_cf_guest_story_events"' in source
    assert 'down_revision: Union[str, None] = "042_content_factory_guest_story"' in source
    assert '"cf_guest_story_event"' in source
    assert '"guest_story_id"' in source
    assert '"actor_id"' in source
    assert '"event_type"' in source
    assert '"body"' in source
    assert '"old_value"' in source
    assert '"new_value"' in source
    assert '"payload"' in source
    assert '"ix_cf_guest_story_event_story_created"' in source
    assert '"ix_cf_guest_story_event_type"' in source
    assert 'op.drop_table("cf_guest_story_event")' in source


def test_guest_story_event_thread_migration_adds_parent_reference():
    source = THREAD_MIGRATION.read_text()

    assert 'revision: str = "044_cf_guest_event_threads"' in source
    assert 'down_revision: Union[str, None] = "043_cf_guest_story_events"' in source
    assert '"cf_guest_story_event"' in source
    assert '"parent_event_id"' in source
    assert '"fk_cf_guest_story_event_parent"' in source
    assert '"ix_cf_guest_story_event_parent"' in source
    assert 'op.drop_column("cf_guest_story_event", "parent_event_id")' in source
