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
  assert.match(source, /href:\s*"\/content-factory\/bundles"/);
  assert.match(source, /label:\s*"Content Factory"/);
});

test("header knows content factory workspace routes", () => {
  const source = readSource("components/layout/Header.tsx");

  assert.match(source, /\/content-factory\/dashboard/);
  assert.match(source, /\/content-factory\/calendar/);
  assert.match(source, /\/content-factory\/bundles/);
  assert.match(source, /\/content-factory\/publications/);
  assert.match(source, /\/content-factory\/review/);
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

test("bundle and publication workspace routes exist", () => {
  assert.match(
    readSource("app/content-factory/bundles/page.tsx"),
    /ContentFactoryBundlesPage/,
  );
  assert.match(
    readSource("app/content-factory/bundles/[id]/page.tsx"),
    /ContentFactoryBundleDetailPage/,
  );
  assert.match(
    readSource("app/content-factory/publications/[id]/page.tsx"),
    /ContentFactoryPublicationDetailPage/,
  );
  assert.match(
    readSource("app/content-factory/review/page.tsx"),
    /ContentFactoryReviewPage/,
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

test("workspace routes use bundle and publication APIs", () => {
  const bundlesSource = readSource("app/content-factory/bundles/page.tsx");
  const bundleDetailSource = readSource("app/content-factory/bundles/[id]/page.tsx");
  const publicationSource = readSource(
    "app/content-factory/publications/[id]/page.tsx",
  );

  assert.match(bundlesSource, /api\.getCFBundles/);
  assert.match(bundlesSource, /ContentFactoryBundleDialog/);
  assert.match(bundleDetailSource, /api\.getCFBundle/);
  assert.match(bundleDetailSource, /api\.getCFPublicationsForBundle/);
  assert.match(bundleDetailSource, /ContentFactoryPublicationDialog/);
  assert.match(publicationSource, /api\.getCFPublication/);
  assert.match(publicationSource, /api\.getCFPublicationVersions/);
  assert.match(publicationSource, /ContentFactoryPublicationVersionList/);
});

test("publication detail route exposes Sprint 5 outcomes panels", () => {
  const source = readSource("app/content-factory/publications/[id]/page.tsx");

  assert.match(source, /api\.getCFSegments/);
  assert.match(source, /api\.getCFPublicationSegmentTargets/);
  assert.match(source, /api\.getCFMetrics/);
  assert.match(source, /ContentFactorySegmentTargetsPanel/);
  assert.match(source, /ContentFactoryMetricHistory/);
  assert.match(source, /ContentFactoryUtmHelper/);
});

test("review queue route groups publications by workflow status", () => {
  const source = readSource("app/content-factory/review/page.tsx");

  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /getContentFactoryReviewQueueGroups/);
  assert.match(source, /\/content-factory\/publications\/\$\{publication\.id\}/);
});
