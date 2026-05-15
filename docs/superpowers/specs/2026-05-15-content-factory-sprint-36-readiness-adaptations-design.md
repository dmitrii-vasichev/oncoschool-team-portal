# Content Factory Sprint 36 Readiness Adaptations Design

## Goal

Include saved channel adaptations in the publication readiness checklist.

## Background

Sprint 34 added adaptation coverage in the `Адаптации` panel. Sprint 35 added one-click handoff for current saved adaptations. The main `Публикация и статистика` checklist still ignores those adaptation states, so the page can look operationally ready while channel copy is missing or stale.

## Scope

- Add an optional adaptation readiness item to `getContentFactoryPublicationReadiness`.
- Pass saved variants from the publication detail page into `ContentFactoryPublicationOperationsPanel`.
- Show the adaptation item in the existing `Чек-лист готовности` block.
- Keep the dedicated `Адаптации` panel as the place for editing, copying, and detailed channel coverage.

## Out of Scope

- Backend schema or API changes.
- New publication statuses.
- Per-campaign channel requirements.
- AI generation or publishing integrations.

## Rules

- If no adaptation coverage is provided to the helper, the checklist remains unchanged.
- If coverage is provided, add an `Адаптации` readiness item after `UTM-метки` and before `Аудитория`.
- The item is ready only when every expected channel is saved and current.
- Missing or stale adaptations make the item `Нужно заполнить`.
- The description must explain whether channels are missing, stale, or fully ready.

## UX

The operations panel keeps the same compact checklist. The new row should use the existing icon, badge, and description styles so it feels like part of the same operational checklist, not a separate card.

## Validation

- Helper tests cover the no-coverage default, all-ready coverage, and missing/stale coverage.
- Source guards confirm the publication detail route passes saved variants into the operations panel.
- Full frontend tests, typecheck, lint, build, and whitespace checks pass.
