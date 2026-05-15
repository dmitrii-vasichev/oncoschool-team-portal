# Content Factory Sprint 12 Guest Workspace Design

## Context

Sprint 11 added the backend foundation for patient and guest story CRM records: `cf_guest_story`, consent metadata, workflow stages, a service layer, and `/api/content-factory/guests` REST endpoints.

The next useful step is to expose that contract in the Content Factory UI. The preserved research says patient and guest sourcing is a mini-CRM, not just another publication. The interface should therefore help the team see where each story is stuck: sourcing, screening, consent, preparation, publication, gift delivery, or follow-up.

## Goal

Add a first frontend workspace named `Гости и истории` under `/content-factory/guests`.

The workspace should let Content Factory users:

- See all guest/patient story candidates.
- Search by name, contact, brief, source notes, screening notes, legal notes, and rejection reason.
- Filter by pipeline stage, consent state, owner, and linked campaign.
- Create a new guest story.
- Edit an existing guest story.
- See summary cards for total stories, active pipeline items, consent signed, follow-ups due, and gift pending.
- Navigate to linked campaigns and publications when they exist.

## Non-Goals

- Do not add a separate guest detail page in this sprint.
- Do not upload consent files or implement e-signature.
- Do not import intake forms.
- Do not send reminders.
- Do not add hard delete.
- Do not add AI drafting.

## User Experience

Add `Гости и истории` to the internal Content Factory navigation and header metadata.

The page should follow existing Content Factory density:

- Compact title row with icon, short subtitle, refresh, and create button.
- Summary cards with operational counters.
- Filter row with search, status, consent, owner, and campaign.
- A compact story list/table with:
  - display name and role;
  - status label;
  - consent label;
  - owner;
  - stage due date;
  - source;
  - anonymity level;
  - gift status;
  - linked campaign/publication;
  - brief and boundary notes.
- Edit action per row.

The create/edit dialog should use Russian labels and avoid raw system names. It should group fields into human sections:

- `Кто это`: name, role, contact, source, owner.
- `История и этап`: status, stage due date, story brief, screening notes, factcheck notes, rejection reason.
- `Согласие и границы`: consent state, version, signed date, allowed channels, anonymity, sensitive topics, legal notes.
- `Связи и follow-up`: campaign, publication, nosology, gift status, follow-up date.

Array fields can be entered as newline-separated plain text in the first UI. This matches the retrospective UX cleanup and avoids exposing JSON to users.

## Frontend Data Model

Add types:

- `CFGuestStoryRole`
- `CFGuestStorySource`
- `CFGuestStoryStatus`
- `CFGuestConsentStatus`
- `CFGuestAnonymityLevel`
- `CFGuestGiftStatus`
- `CFGuestStory`
- `CFGuestStoryCreateRequest`
- `CFGuestStoryUpdateRequest`
- `CFGuestStoryListParams`

Add API client methods:

- `api.getCFGuestStories(params?)`
- `api.createCFGuestStory(data)`
- `api.updateCFGuestStory(id, data)`

Add helper labels and pure functions:

- role, source, status, consent, anonymity, and gift labels;
- summary builder;
- filter function;
- `isContentFactoryGuestStoryActive`;
- `isContentFactoryGuestFollowUpDue`;
- line parsing/format helpers for allowed channels and sensitive topics where useful.

## Error Handling

- If the guest list fails to load, show a toast and keep an empty page state.
- If team/campaign/publication/nosology reference loads fail, keep the story list usable and show fallback labels.
- Dialog validation should catch missing display name and owner before sending.
- API errors should appear both as inline dialog error and toast.

## Testing

Use TDD before implementation:

- Helper tests for labels, active pipeline detection, follow-up due detection, summary, and filters.
- Source-guard tests that assert:
  - `/content-factory/guests/page.tsx` exists;
  - `ContentFactoryGuestStoryDialog` exists;
  - the route calls `api.getCFGuestStories`, team, bundles, publications, and nosologies;
  - the dialog calls create/update APIs and uses Russian labels;
  - navigation, header, and help expose `Гости и истории`.

Validation commands:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

## Future Work

Sprint 13 can add a dedicated guest detail page with richer chronology, stage history, comments, consent-document links, reminders, and intake/import history. That should wait until the list and dialog prove the core fields are understandable.
