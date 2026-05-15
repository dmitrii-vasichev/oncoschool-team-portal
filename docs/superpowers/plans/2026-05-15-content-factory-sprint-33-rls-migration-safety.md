# Content Factory Sprint 33 RLS Migration Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Supabase RLS bootstrap migration safe for fresh databases while keeping the complete application table registry.

**Architecture:** Keep migration 038 as the single RLS registry and future-table trigger installer. Change only the bootstrap `ALTER TABLE` statement so it tolerates tables created by later migrations.

**Tech Stack:** Alembic, pytest, SQLAlchemy metadata source guard.

---

## File Structure

- Modify `backend/tests/test_supabase_rls_migration.py` with a regression test for `ALTER TABLE IF EXISTS`.
- Modify `backend/alembic/versions/038_enable_rls_on_public_tables.py` to use `ALTER TABLE IF EXISTS`.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, and `docs/TEST_PLAN.md`.

## Task 1: Regression Test

- [x] Add `test_rls_migration_bootstrap_tolerates_future_tables`.
- [x] Run the test and confirm RED because migration 038 uses `ALTER TABLE` without `IF EXISTS`.

## Task 2: Migration Fix

- [x] Change migration 038 bootstrap loop to `ALTER TABLE IF EXISTS`.
- [x] Run focused RLS migration tests and confirm GREEN.

## Task 3: Verification And Docs

- [x] Run focused backend verification for the RLS migration tests.
- [x] Run `git diff --check`.
- [x] Update durable docs with verification results.
- [ ] Commit, merge to `main`, and push.
- [ ] Mark Sprint 33 as pushed in docs, commit, and push the final docs update.

## Self-Review

- Spec coverage: the plan covers the fresh-database migration safety bug and verification.
- Placeholder scan: no placeholder tasks remain.
- Scope check: this intentionally avoids product work and only fixes the migration safety issue found after Sprint 32.
