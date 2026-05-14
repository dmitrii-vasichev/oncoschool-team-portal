import assert from "node:assert/strict";
import test from "node:test";

import {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  canAccessContentFactory,
  filterContentFactoryPublications,
  groupPublicationsByDate,
  summarizeContentFactoryDashboard,
} from "./contentFactoryUtils.ts";

test("content factory labels expose production wording", () => {
  assert.equal(CF_BUNDLE_STATUS_LABELS.production, "В производстве");
  assert.equal(CF_PUBLICATION_STATUS_LABELS.doctor_review, "Проверка врача");
});

test("content factory access allows admins and flagged active members", () => {
  assert.equal(canAccessContentFactory({ role: "admin", is_active: true }), true);
  assert.equal(
    canAccessContentFactory({
      role: "member",
      is_active: true,
      has_content_factory_access: true,
    }),
    true,
  );
  assert.equal(
    canAccessContentFactory({
      role: "member",
      is_active: true,
      has_content_factory_access: false,
    }),
    false,
  );
});

test("groupPublicationsByDate keeps unscheduled items separate", () => {
  const groups = groupPublicationsByDate([
    { id: "1", scheduled_at: "2026-05-20T10:00:00Z" },
    { id: "2", scheduled_at: null },
  ]);

  assert.equal(groups[0].dateKey, "2026-05-20");
  assert.equal(groups[1].dateKey, "unscheduled");
});

test("dashboard summary counts scheduled upcoming and overdue production items", () => {
  const summary = summarizeContentFactoryDashboard({
    now: new Date("2026-05-14T12:00:00Z"),
    bundles: [
      { id: "b1", status: "planning" },
      { id: "b2", status: "production" },
    ],
    publications: [
      { id: "p1", status: "scheduled", scheduled_at: "2026-05-15T12:00:00Z" },
      { id: "p2", status: "needs_design", scheduled_at: "2026-05-13T12:00:00Z" },
      { id: "p3", status: "published", scheduled_at: "2026-05-12T12:00:00Z" },
    ],
  });

  assert.equal(summary.bundleStatusCounts.planning, 1);
  assert.equal(summary.upcomingPublications.length, 1);
  assert.equal(summary.overdueProductionItems.length, 1);
  assert.equal(summary.recentlyPublished.length, 1);
});

test("dashboard summary sorts upcoming and published publication lists", () => {
  const summary = summarizeContentFactoryDashboard({
    now: new Date("2026-05-14T12:00:00Z"),
    bundles: [],
    publications: [
      { id: "late", status: "scheduled", scheduled_at: "2026-05-18T12:00:00Z" },
      { id: "soon", status: "scheduled", scheduled_at: "2026-05-15T12:00:00Z" },
      {
        id: "old-published",
        status: "published",
        scheduled_at: "2026-05-10T12:00:00Z",
        actual_published_at: "2026-05-10T13:00:00Z",
      },
      {
        id: "new-published",
        status: "published",
        scheduled_at: "2026-05-11T12:00:00Z",
        actual_published_at: "2026-05-13T13:00:00Z",
      },
    ],
  });

  assert.deepEqual(
    summary.upcomingPublications.map((publication) => publication.id),
    ["soon", "late"],
  );
  assert.deepEqual(
    summary.recentlyPublished.map((publication) => publication.id),
    ["new-published", "old-published"],
  );
});

test("groupPublicationsByDate sorts date groups and keeps unscheduled last", () => {
  const groups = groupPublicationsByDate([
    { id: "unscheduled", scheduled_at: null },
    { id: "later", scheduled_at: "2026-05-22T10:00:00Z" },
    { id: "earlier", scheduled_at: "2026-05-19T10:00:00Z" },
  ]);

  assert.deepEqual(
    groups.map((group) => group.dateKey),
    ["2026-05-19", "2026-05-22", "unscheduled"],
  );
});

test("filterContentFactoryPublications applies calendar filters together", () => {
  const publications = [
    {
      id: "keep",
      bundle_id: "bundle-1",
      status: "scheduled",
      platform_id: "telegram",
      format_id: "post",
      responsible_id: "member-1",
    },
    {
      id: "drop",
      bundle_id: "bundle-2",
      status: "draft",
      platform_id: "vk",
      format_id: "short",
      responsible_id: "member-2",
    },
  ];

  const result = filterContentFactoryPublications(publications, {
    bundle_id: "bundle-1",
    status: "scheduled",
    platform_id: "telegram",
    format_id: "post",
    responsible_id: "member-1",
  });

  assert.deepEqual(
    result.map((publication) => publication.id),
    ["keep"],
  );
});
