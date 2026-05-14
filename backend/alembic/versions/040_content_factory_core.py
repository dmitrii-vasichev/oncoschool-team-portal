"""Add Content Factory core production tables.

Revision ID: 040_content_factory_core
Revises: 039_content_factory_reference
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "040_content_factory_core"
down_revision: Union[str, None] = "039_content_factory_reference"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_pk():
    return sa.Column(
        "id", postgresql.UUID(as_uuid=True), primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    # ── Segments (read-only mirror of GetCourse) ──
    op.create_table(
        "cf_external_segment",
        _uuid_pk(),
        sa.Column("source", sa.String(30), nullable=False, server_default="getcourse"),
        sa.Column("source_segment_id", sa.String(100), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("population_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("filter_hash", sa.String(64), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.UniqueConstraint("source", "source_segment_id", name="uq_cf_segment_source"),
    )

    op.create_table(
        "cf_segment_snapshot",
        _uuid_pk(),
        sa.Column("external_segment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_external_segment.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("population_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # ── Bundles ──
    op.create_table(
        "cf_bundle",
        _uuid_pk(),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("product_stream", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="planning"),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("brief", sa.Text(), nullable=True),
        sa.Column("funnel_template_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_funnel_template.id"), nullable=True),
        sa.Column("source_material_refs", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'[]'::jsonb")),
        *_timestamps(),
    )

    # ── Publications ──
    op.create_table(
        "cf_publication",
        _uuid_pk(),
        sa.Column("bundle_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_bundle.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_platform.id"), nullable=False),
        sa.Column("format_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_format.id"), nullable=False),
        sa.Column("rubric_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_rubric.id"), nullable=True),
        sa.Column("nosology_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_nosology.id"), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("media_refs", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responsible_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("platform_post_url", sa.Text(), nullable=True),
        sa.Column("platform_post_id", sa.String(200), nullable=True),
        sa.Column("utm", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        *_timestamps(),
    )

    op.create_index("ix_cf_publication_bundle", "cf_publication", ["bundle_id"])
    op.create_index("ix_cf_publication_scheduled", "cf_publication", ["scheduled_at"])
    op.create_index("ix_cf_publication_status", "cf_publication", ["status"])

    op.create_table(
        "cf_publication_version",
        _uuid_pk(),
        sa.Column("publication_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("edited_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approval_event", sa.String(30), nullable=False),
        sa.Column("source_materials_refs", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("publication_id", "version_number", name="uq_cf_pub_version"),
    )

    op.create_table(
        "cf_publication_relation",
        _uuid_pk(),
        sa.Column("from_publication_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_publication_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(30), nullable=False),
        sa.UniqueConstraint("from_publication_id", "to_publication_id", "relation_type",
                            name="uq_cf_pub_relation"),
    )

    op.create_table(
        "cf_publication_segment_target",
        sa.Column("publication_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_publication.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("external_segment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_external_segment.id"), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="target"),
        sa.Column("expected_count", sa.Integer(), nullable=True),
        sa.Column("actual_count_at_send", sa.Integer(), nullable=True),
    )

    # ── Metrics ──
    op.create_table(
        "cf_metric_snapshot",
        _uuid_pk(),
        sa.Column("publication_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_publication.id", ondelete="CASCADE"), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("window", sa.String(20), nullable=False),
        sa.Column("metric_name", sa.String(50), nullable=False),
        sa.Column("metric_value", sa.Numeric(20, 4), nullable=True),
        sa.Column("metric_value_text", sa.Text(), nullable=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("source_method", sa.String(50), nullable=True),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="high"),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("captured_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=True),
    )

    op.create_index("ix_cf_metric_pub_window", "cf_metric_snapshot",
                    ["publication_id", "window", "metric_name"])

    # ── Retros ──
    op.create_table(
        "cf_retro_note",
        _uuid_pk(),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("retro_type", sa.String(20), nullable=False, server_default="weekly"),
        sa.Column("bundle_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("cf_bundle.id", ondelete="SET NULL"), nullable=True),
        sa.Column("facilitator_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("best_by_objective", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("broken", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("learnings", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("decisions", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("actions", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("cf_retro_note")
    op.drop_index("ix_cf_metric_pub_window", table_name="cf_metric_snapshot")
    op.drop_table("cf_metric_snapshot")
    op.drop_table("cf_publication_segment_target")
    op.drop_table("cf_publication_relation")
    op.drop_table("cf_publication_version")
    op.drop_index("ix_cf_publication_status", table_name="cf_publication")
    op.drop_index("ix_cf_publication_scheduled", table_name="cf_publication")
    op.drop_index("ix_cf_publication_bundle", table_name="cf_publication")
    op.drop_table("cf_publication")
    op.drop_table("cf_bundle")
    op.drop_table("cf_segment_snapshot")
    op.drop_table("cf_external_segment")
