# Content Factory Sprint 23 Publish Package Design

## Goal

Add a copy-ready manual publishing package to the publication detail page so a team member can transfer a prepared publication to Telegram, VK, email, or another channel without hunting through separate panels.

## Context

Sprint 20 added first-class publication creation, Sprint 21 made manual metric capture readable, and Sprint 22 added a readiness checklist. The preserved market research recommends a manual or semi-automated publishing ledger before fragile platform API integrations. Sprint 23 keeps that direction: it does not publish to external platforms automatically and does not collect metrics automatically. It makes the existing publication data operationally usable at the moment of hand-off.

## User Experience

The publication detail page gains a `Пакет для публикации` panel in the main content column, near the publication text. The panel summarizes:

- channel/platform;
- format;
- campaign;
- planned publication time;
- target or excluded audiences;
- saved UTM tags;
- body text;
- media/material references.

The panel includes a primary `Скопировать пакет` action. The copied text is plain, structured, and safe for manual transfer into chat, task comments, or a publishing tool.

## Architecture

The feature is frontend-only.

- Add a pure helper in `frontend/src/lib/contentFactoryUtils.ts` that builds a deterministic publish package from a publication and existing reference records.
- Add helper coverage to `frontend/src/lib/contentFactoryUtils.test.ts`.
- Add a focused component in `frontend/src/components/content-factory/ContentFactoryPublicationPublishPackage.tsx`.
- Wire the component into `frontend/src/app/content-factory/publications/[id]/page.tsx`.
- Add source guards so the publication detail route cannot silently lose the panel or copy action.

## Data Rules

- Missing reference records fall back to readable placeholders such as `Площадка не указана`.
- Missing body text is represented as `Текст не заполнен`.
- Empty media references are represented as `Медиа не указаны`.
- Empty UTM tags are represented as `UTM не заполнены`.
- Segment target labels use linked segment names when available and include the segment role label.
- The helper returns both display rows for UI and a full `copyText` payload for clipboard use.

## Out Of Scope

- No backend schema changes.
- No new REST endpoints.
- No automatic publishing to Telegram, VK, email, or any social network.
- No automatic metric collection.
- No blocking validation that prevents status changes.
- No media upload/storage workflow.

## Validation

Automated validation should cover the pure package builder and route/component wiring:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Manual validation should open a real publication detail page, confirm the panel is visible, copy the package, and verify the copied text contains the publication body, platform, format, campaign, schedule, audiences, UTM tags, and media references.
