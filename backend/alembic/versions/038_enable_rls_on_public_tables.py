"""Enable RLS on public application tables.

Revision ID: 038
Revises: 037_projects_module
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op

revision: str = "038"
down_revision: Union[str, None] = "037_projects_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PUBLIC_TABLES: tuple[str, ...] = (
    "activity_events",
    "activity_reactions",
    "ai_feature_config",
    "analysis_prompts",
    "analysis_runs",
    "app_settings",
    # Content Factory module (cf_*) — tables added in migrations 039/040.
    # RLS is auto-enabled by the event trigger below at CREATE TABLE time,
    # so listing them here keeps this registry in sync with Base.metadata.
    "cf_bundle",
    "cf_external_segment",
    "cf_format",
    "cf_funnel_template",
    "cf_guest_story",
    "cf_guest_story_event",
    "cf_metric_import_run",
    "cf_metric_source_config",
    "cf_metric_snapshot",
    "cf_nosology",
    "cf_platform",
    "cf_publishing_queue_event",
    "cf_publishing_queue_item",
    "cf_publication",
    "cf_publication_relation",
    "cf_publication_segment_target",
    "cf_publication_variant",
    "cf_publication_version",
    "cf_retro_note",
    "cf_rubric",
    "cf_segment_snapshot",
    "content_access",
    "daily_metrics",
    "departments",
    "getcourse_credentials",
    "idea_comments",
    "idea_departments",
    "idea_events",
    "idea_tasks",
    "ideas",
    "in_app_notifications",
    "meeting_ai_processing",
    "meeting_board_settings",
    "meeting_participants",
    "meeting_schedules",
    "meetings",
    "notification_subscriptions",
    "project_comments",
    "project_departments",
    "project_events",
    "project_milestones",
    "project_tasks",
    "projects",
    "reminder_settings",
    "task_label_links",
    "task_labels",
    "task_updates",
    "tasks",
    "team_member_department_access",
    "team_members",
    "telegram_broadcast_image_presets",
    "telegram_broadcasts",
    "telegram_channels",
    "telegram_content",
    "telegram_notification_targets",
    "telegram_session",
)

RESTRICTED_API_ROLES: tuple[str, ...] = ("anon", "authenticated")

AUTO_ENABLE_RLS_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION public.enable_rls_for_new_public_tables()
RETURNS EVENT_TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    cmd record;
BEGIN
    FOR cmd IN
        SELECT *
        FROM pg_event_trigger_ddl_commands()
        WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
          AND object_type IN ('table', 'partitioned table')
    LOOP
        IF cmd.schema_name = 'public' THEN
            EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);

            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                EXECUTE format('revoke all privileges on table %s from anon', cmd.object_identity);
            END IF;

            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                EXECUTE format('revoke all privileges on table %s from authenticated', cmd.object_identity);
            END IF;
        END IF;
    END LOOP;
END;
$$;
"""

DROP_AUTO_ENABLE_RLS_TRIGGER_SQL = """
DROP EVENT TRIGGER IF EXISTS ensure_public_tables_have_rls;
"""

CREATE_AUTO_ENABLE_RLS_TRIGGER_SQL = """
CREATE EVENT TRIGGER ensure_public_tables_have_rls
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.enable_rls_for_new_public_tables();
"""

AUTO_ENABLE_RLS_STATEMENTS: tuple[str, ...] = (
    AUTO_ENABLE_RLS_FUNCTION_SQL,
    DROP_AUTO_ENABLE_RLS_TRIGGER_SQL,
    CREATE_AUTO_ENABLE_RLS_TRIGGER_SQL,
)

AUTO_ENABLE_RLS_SQL = "\n".join(AUTO_ENABLE_RLS_STATEMENTS)


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _qualified_table(table_name: str) -> str:
    return f"public.{_quote_identifier(table_name)}"


def _revoke_api_role_access_sql(table_name: str, role_name: str) -> str:
    table_ref = _qualified_table(table_name)
    role_ref = _quote_identifier(role_name)
    role_literal = role_name.replace("'", "''")
    return f"""
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role_literal}') THEN
        REVOKE ALL PRIVILEGES ON TABLE {table_ref} FROM {role_ref};
    END IF;
END;
$$;
"""


def _revoke_default_api_role_access_sql(role_name: str) -> str:
    role_ref = _quote_identifier(role_name)
    role_literal = role_name.replace("'", "''")
    return f"""
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role_literal}') THEN
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE ALL PRIVILEGES ON TABLES FROM {role_ref};
    END IF;
END;
$$;
"""


def upgrade() -> None:
    for table_name in PUBLIC_TABLES:
        op.execute(f"ALTER TABLE IF EXISTS {_qualified_table(table_name)} ENABLE ROW LEVEL SECURITY")
        for role_name in RESTRICTED_API_ROLES:
            op.execute(_revoke_api_role_access_sql(table_name, role_name))

    for role_name in RESTRICTED_API_ROLES:
        op.execute(_revoke_default_api_role_access_sql(role_name))

    for statement in AUTO_ENABLE_RLS_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP EVENT TRIGGER IF EXISTS ensure_public_tables_have_rls")
    op.execute("DROP FUNCTION IF EXISTS public.enable_rls_for_new_public_tables()")
    # Keep RLS and revoked API-role table access in place; downgrading must not reopen data.
