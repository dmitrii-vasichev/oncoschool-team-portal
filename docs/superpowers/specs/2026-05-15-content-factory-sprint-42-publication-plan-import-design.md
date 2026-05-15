# Content Factory Sprint 42 Publication Plan Import Design

## Goal

Add the first safe import flow for moving spreadsheet-like publication planning rows into Content Factory without rebuilding the old Excel workflow by hand.

Sprint 42 starts Wave B from the roadmap. It should not attempt full XLSX upload, automatic campaign matrix generation, or platform publishing. It should give editors a practical paste/import preview that accepts copied rows from Excel, validates them, maps them to existing reference data, and creates publication records through the existing API.

## Current Inputs

The preserved workbook at `~/Downloads/Контент.xlsx` contains multiple manual planning shapes:

- calendar-like rows with `дата`, `тема`, `Канал`, `Формат`, and status cells;
- channel/history sheets such as `Телега с января по сентябрь`;
- idea sheets with `суть`, `рубрика`, and `ссылка`;
- Instagram-style rows with `Формат`, `Дата`, `Тема`, `Тип`, `Ответственный исполнитель`, and `Примечания`;
- analytics sheets that belong to later metrics-import work rather than this sprint.

The first product import should support row-per-publication planning data, not every historical sheet layout.

## Scope

This sprint adds:

- A publication plan import dialog on `/content-factory/publications`.
- A paste area for copied table rows from Excel/Sheets.
- Default selectors for campaign, platform, format, and responsible user.
- Header-based column mapping for common Russian and English labels.
- Reference matching by code/display name plus practical aliases for Telegram, VK, Dzen, Instagram, common formats, statuses, rubrics, nosologies, and member name variants.
- Preview rows showing valid rows and validation errors before saving.
- Row creation through the existing `createCFPublicationForBundle` API.
- Durable source-guard and helper tests.

Out of scope:

- Direct `.xlsx` upload.
- Backend bulk import endpoint.
- Creating campaigns automatically from unknown campaign names.
- Importing metrics from historical analytics sheets.
- Importing audience segment links.
- Cross-channel campaign matrix generation.
- Automatic publishing.

## UX Direction

The import entry belongs on the `Публикации` page next to `Новая публикация`. The user should:

1. Open `Импорт плана`.
2. Choose default campaign, platform, format, and responsible user.
3. Paste rows with headers such as `Дата | Тема | Канал | Формат | Статус | Ответственный | Рубрика | Нозология | Текст | Примечания`.
4. See how many rows are ready and which rows have errors.
5. Fix the pasted text or defaults until all rows are valid.
6. Click `Импортировать план`.
7. Stay on the publication list after refresh, not be redirected into one created record.

The first safe version should block save when any row has validation errors. Partial imports are more dangerous than helpful for this workflow because users may assume every planned row was created.

## Mapping Rules

Required values:

- campaign: from the row if a campaign column is present, otherwise from the default selector;
- platform: from the row if present, otherwise default;
- format: from the row if present, otherwise default;
- responsible user: from the row if present, otherwise default;
- title/body: at least one of title-like or text-like columns must be present.

Optional values:

- scheduled date/time;
- status;
- rubric;
- nosology;
- notes.

The import should store notes in `utm.cf_import_note` and mark the row source with `utm.cf_import_source = "publication_plan_paste"`. This preserves planning notes without adding schema.

Date-only rows should use a stable default time of `09:00:00Z` so the calendar receives a valid datetime while making it obvious that the exact time still needs review.

## Testing

Focused helper tests:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Full frontend verification:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
