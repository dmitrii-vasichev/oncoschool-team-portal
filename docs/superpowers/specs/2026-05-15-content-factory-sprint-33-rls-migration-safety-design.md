# Content Factory Sprint 33 RLS Migration Safety Design

## Context

Sprint 32 added `cf_publication_variant` and kept the Supabase RLS registry in `038_enable_rls_on_public_tables.py` synchronized with `Base.metadata`.

That registry intentionally includes Content Factory tables created by later migrations. The event trigger installed by migration 038 enables RLS for future public tables, but the bootstrap loop also tries to enable RLS for every registered table during migration 038 itself.

On a fresh database, migration 038 runs before migrations 039, 040, 042, 043, 044, and 045. Without `IF EXISTS`, the bootstrap loop can fail when it sees a registered future table that is not created yet.

## Goal

Make the RLS bootstrap migration safe for fresh database creation while keeping the complete RLS registry test.

## Scope

- Add a regression test that requires migration 038 to use `ALTER TABLE IF EXISTS` during bootstrap.
- Update migration 038 bootstrap RLS enablement to tolerate tables created by later migrations.
- Keep the existing future-table event trigger unchanged.
- Update durable plan/status/test docs.

## Non-Goals

- No schema changes.
- No new app features.
- No RLS policy redesign.
- No production data migration.

## Testing

Automated tests:

- `test_rls_migration_covers_every_application_table`
- `test_rls_migration_installs_future_table_guard`
- new `test_rls_migration_bootstrap_tolerates_future_tables`

Manual QA is not needed because this is a migration-safety fix covered by source-level migration tests.
