"""Add Content Factory metric integration foundation.

Revision ID: 047_cf_metric_integration_foundation
Revises: 046_cf_publishing_queue
Create Date: 2026-05-16 10:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "047_cf_metric_integration_foundation"
down_revision: Union[str, None] = "046_cf_publishing_queue"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cf_metric_source_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("freshness_window_hours", sa.Integer(), server_default="24", nullable=False),
        sa.Column("default_confidence", sa.String(length=10), server_default="medium", nullable=False),
        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("credentials_ref", sa.String(length=200), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["team_members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cf_metric_source_config_source_active",
        "cf_metric_source_config",
        ["source", "is_active"],
    )

    op.create_table(
        "cf_metric_import_run",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_config_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("triggered_by", sa.String(length=20), server_default="manual", nullable=False),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("found_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_duplicate_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("raw_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_config_id"],
            ["cf_metric_source_config.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["requested_by_id"], ["team_members.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cf_metric_import_run_source_created",
        "cf_metric_import_run",
        ["source_config_id", "created_at"],
    )
    op.create_index(
        "ix_cf_metric_import_run_status",
        "cf_metric_import_run",
        ["status"],
    )

    op.add_column(
        "cf_metric_snapshot",
        sa.Column("source_config_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "cf_metric_snapshot",
        sa.Column("import_run_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "cf_metric_snapshot",
        sa.Column("external_metric_id", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "cf_metric_snapshot",
        sa.Column("dedupe_key", sa.String(length=500), nullable=True),
    )
    op.create_foreign_key(
        "fk_cf_metric_snapshot_source_config",
        "cf_metric_snapshot",
        "cf_metric_source_config",
        ["source_config_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_cf_metric_snapshot_import_run",
        "cf_metric_snapshot",
        "cf_metric_import_run",
        ["import_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_cf_metric_snapshot_source_config",
        "cf_metric_snapshot",
        ["source_config_id"],
    )
    op.create_index(
        "ix_cf_metric_snapshot_import_run",
        "cf_metric_snapshot",
        ["import_run_id"],
    )
    op.create_index(
        "uq_cf_metric_snapshot_dedupe_key",
        "cf_metric_snapshot",
        ["dedupe_key"],
        unique=True,
        postgresql_where=sa.text("dedupe_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_cf_metric_snapshot_dedupe_key",
        table_name="cf_metric_snapshot",
    )
    op.drop_index(
        "ix_cf_metric_snapshot_import_run",
        table_name="cf_metric_snapshot",
    )
    op.drop_index(
        "ix_cf_metric_snapshot_source_config",
        table_name="cf_metric_snapshot",
    )
    op.drop_constraint(
        "fk_cf_metric_snapshot_import_run",
        "cf_metric_snapshot",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_cf_metric_snapshot_source_config",
        "cf_metric_snapshot",
        type_="foreignkey",
    )
    op.drop_column("cf_metric_snapshot", "dedupe_key")
    op.drop_column("cf_metric_snapshot", "external_metric_id")
    op.drop_column("cf_metric_snapshot", "import_run_id")
    op.drop_column("cf_metric_snapshot", "source_config_id")
    op.drop_index(
        "ix_cf_metric_import_run_status",
        table_name="cf_metric_import_run",
    )
    op.drop_index(
        "ix_cf_metric_import_run_source_created",
        table_name="cf_metric_import_run",
    )
    op.drop_table("cf_metric_import_run")
    op.drop_index(
        "ix_cf_metric_source_config_source_active",
        table_name="cf_metric_source_config",
    )
    op.drop_table("cf_metric_source_config")
