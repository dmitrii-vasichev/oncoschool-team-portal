from __future__ import annotations

import importlib.util
from pathlib import Path

from app.db.models import Base


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "038_enable_rls_on_public_tables.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("enable_rls_on_public_tables", MIGRATION_PATH)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_rls_migration_covers_every_application_table() -> None:
    migration = _load_migration()

    assert set(migration.PUBLIC_TABLES) == set(Base.metadata.tables)


def test_rls_migration_installs_future_table_guard() -> None:
    migration = _load_migration()

    assert "CREATE EVENT TRIGGER ensure_public_tables_have_rls" in migration.AUTO_ENABLE_RLS_SQL
    assert "alter table if exists %s enable row level security" in migration.AUTO_ENABLE_RLS_SQL


def test_rls_migration_bootstrap_tolerates_future_tables() -> None:
    source = MIGRATION_PATH.read_text()

    assert 'op.execute(f"ALTER TABLE IF EXISTS {_qualified_table(table_name)} ENABLE ROW LEVEL SECURITY")' in source


def test_rls_migration_removes_direct_api_role_table_access() -> None:
    migration = _load_migration()

    assert migration.RESTRICTED_API_ROLES == ("anon", "authenticated")
