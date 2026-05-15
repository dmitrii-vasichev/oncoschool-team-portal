# Content Factory Sprint 35 Variant Handoff Design

## Goal

Let editors copy one manual handoff package containing every saved and current publication adaptation.

## Background

Sprint 34 shows whether publication adaptations are saved, missing, or stale. Editors still need to copy each ready channel one by one when they hand content to a manual publishing workflow.

## Scope

- Add a frontend-only handoff helper for saved publication variants.
- Add a `Скопировать готовые` action inside the existing `Адаптации` panel.
- Copy only variants that are saved and current for the publication version.
- Keep single-channel copy, save, reset, and coverage behavior unchanged.

## Out of Scope

- Backend schema or API changes.
- External publishing integrations.
- AI generation.
- Variant approval workflow.
- File export.

## UX

The `Готовность адаптаций` block should include a compact secondary button:

- enabled when at least one saved variant is current;
- disabled when no current saved variants exist;
- named `Скопировать готовые`;
- shows a success toast after copying;
- shows a readable error toast when clipboard access fails.

The copied package should include:

- package title;
- publication title;
- publication source version;
- ready count;
- skipped channel labels when channels are missing or stale;
- each ready channel in the fixed channel order;
- channel title, body text, and notes when present;
- publication UTM once at the end when UTM exists.

## Data Rules

- Expected channel order remains Telegram, VK, email, push, Max, and Dzen.
- A variant is ready only when it has nonblank `body_text` and `source_version_number >= publication.version_number`.
- Stale or blank variants are not copied.
- Missing and stale channels are listed in the skipped summary so editors know why the package is partial.

## Validation

- Helper tests cover ready package generation, channel order, skipped channels, UTM, notes, and no-ready state.
- Source guards confirm the UI action and helper wiring exist.
- Full frontend tests, typecheck, lint, build, and whitespace checks pass.
