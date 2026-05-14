import assert from "node:assert/strict";
import test from "node:test";

import {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  buildContentFactoryBundleParams,
  buildContentFactoryUtm,
  canAccessContentFactory,
  cleanContentFactoryPublicationUpdate,
  filterContentFactoryPublications,
  formatContentFactoryBundleCount,
  formatContentFactoryMetricValue,
  formatContentFactoryPublicationCount,
  getAvailableContentFactorySegments,
  getContentFactoryDisplayName,
  getContentFactoryReviewQueueGroups,
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

test("buildContentFactoryBundleParams skips empty bundle filters", () => {
  assert.deepEqual(
    buildContentFactoryBundleParams({
      status: "all",
      product_stream: "",
      owner_id: "owner-1",
    }),
    { limit: "500", owner_id: "owner-1" },
  );
});

test("cleanContentFactoryPublicationUpdate trims strings and nulls blank optional fields", () => {
  assert.deepEqual(
    cleanContentFactoryPublicationUpdate({
      title: "  Reminder ",
      body_text: "",
      platform_post_url: "   ",
      platform_post_id: "vk-1",
      utm: { campaign: "may" },
    }),
    {
      title: "Reminder",
      body_text: null,
      platform_post_url: null,
      platform_post_id: "vk-1",
      utm: { campaign: "may" },
    },
  );
});

test("Content Factory count labels use expected plural forms", () => {
  assert.equal(formatContentFactoryBundleCount(1), "1 bundle");
  assert.equal(formatContentFactoryBundleCount(2), "2 bundles");
  assert.equal(formatContentFactoryPublicationCount(5), "5 публикаций");
  assert.equal(formatContentFactoryPublicationCount(21), "21 публикация");
});

test("getContentFactoryDisplayName falls back to an id fragment", () => {
  assert.equal(getContentFactoryDisplayName("format-123456", []), "format-12");
  assert.equal(
    getContentFactoryDisplayName("member-1", [
      { id: "member-1", full_name: "Мария Смирнова" },
    ]),
    "Мария Смирнова",
  );
});

test("buildContentFactoryUtm composes campaign context", () => {
  assert.deepEqual(
    buildContentFactoryUtm({
      bundleId: "bundle-rmj-may",
      publicationId: "pub-telegram-reminder",
      platformCode: "telegram",
      formatCode: "post",
      segmentId: "segment-survivors",
      cta: "register",
    }),
    {
      utm_source: "telegram",
      utm_medium: "post",
      utm_campaign: "bundle-rmj-may",
      utm_content: "pub-telegram-reminder",
      utm_term: "segment-survivors",
      cf_cta: "register",
    },
  );
});

test("formatContentFactoryMetricValue renders numeric and text metrics", () => {
  assert.equal(
    formatContentFactoryMetricValue({
      metric_value: "1234.5000",
      metric_value_text: null,
    }),
    "1 234,5",
  );
  assert.equal(
    formatContentFactoryMetricValue({
      metric_value: null,
      metric_value_text: "high engagement",
    }),
    "high engagement",
  );
});

test("getContentFactoryReviewQueueGroups groups review statuses", () => {
  const groups = getContentFactoryReviewQueueGroups([
    { id: "copy", status: "needs_copy", scheduled_at: null },
    { id: "fact", status: "factcheck", scheduled_at: null },
    { id: "doctor", status: "doctor_review", scheduled_at: null },
    { id: "approved", status: "approved", scheduled_at: null },
    { id: "scheduled", status: "scheduled", scheduled_at: null },
    { id: "failed", status: "failed", scheduled_at: null },
  ]);

  assert.deepEqual(
    groups.map((group) => [group.key, group.publications.map((item) => item.id)]),
    [
      ["production", ["copy"]],
      ["factcheck", ["fact"]],
      ["doctor_review", ["doctor"]],
      ["approval", ["approved"]],
      ["scheduling", ["scheduled"]],
      ["failed", ["failed"]],
    ],
  );
});

test("getAvailableContentFactorySegments excludes selected segment targets", () => {
  const segments = [
    { id: "keep", is_active: true },
    { id: "drop", is_active: true },
    { id: "inactive", is_active: false },
  ];

  assert.deepEqual(
    getAvailableContentFactorySegments(segments, [
      { external_segment_id: "drop" },
    ]).map((segment) => segment.id),
    ["keep"],
  );
});
