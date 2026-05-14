import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("sidebar exposes content factory navigation", () => {
  const source = readSource("components/layout/Sidebar.tsx");

  assert.match(source, /href:\s*"\/content-factory\/dashboard"/);
  assert.match(source, /label:\s*"Content Factory"/);
});

test("header knows content factory dashboard and calendar routes", () => {
  const source = readSource("components/layout/Header.tsx");

  assert.match(source, /\/content-factory\/dashboard/);
  assert.match(source, /\/content-factory\/calendar/);
});

test("content factory layout uses dedicated access guard", () => {
  const source = readSource("app/content-factory/layout.tsx");

  assert.match(source, /ContentFactoryGuard/);
  assert.doesNotMatch(source, /useContentAccess/);
});

test("dashboard and calendar routes exist", () => {
  assert.match(
    readSource("app/content-factory/dashboard/page.tsx"),
    /ContentFactoryDashboardPage/,
  );
  assert.match(
    readSource("app/content-factory/calendar/page.tsx"),
    /ContentFactoryCalendarPage/,
  );
});

test("dashboard route uses content factory API data and summaries", () => {
  const source = readSource("app/content-factory/dashboard/page.tsx");

  assert.match(source, /api\.getCFBundles/);
  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /summarizeContentFactoryDashboard/);
  assert.match(source, /ContentFactoryStatusBadge/);
  assert.match(source, /href="\/content-factory\/calendar"/);
});

test("calendar route uses content factory filters and date grouping", () => {
  const source = readSource("app/content-factory/calendar/page.tsx");

  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /groupPublicationsByDate/);
  assert.match(source, /filterContentFactoryPublications/);
  assert.match(source, /ContentFactoryFilters/);
  assert.match(source, /ContentFactoryStatusBadge/);
  assert.match(source, /href="\/content-factory\/dashboard"/);
});
