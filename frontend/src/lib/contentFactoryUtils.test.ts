import assert from "node:assert/strict";
import test from "node:test";

import * as contentFactoryUtils from "./contentFactoryUtils.ts";

const {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  CF_REFERENCE_TABLE_LABELS,
  CF_RETRO_TYPE_LABELS,
  CF_SEGMENT_SOURCE_LABELS,
  buildContentFactoryBundleParams,
  buildContentFactorySegmentUsageRows,
  buildContentFactoryUtm,
  canAccessContentFactory,
  cleanContentFactoryPublicationUpdate,
  compareContentFactorySegmentSnapshots,
  filterContentFactorySegmentUsageRows,
  filterContentFactoryPublications,
  filterContentFactorySegments,
  formatContentFactoryBundleCount,
  formatContentFactoryMetricValue,
  formatContentFactoryPublicationCount,
  formatContentFactoryRetroPeriod,
  formatContentFactorySegmentCount,
  getAvailableContentFactorySegments,
  getContentFactoryDisplayName,
  getContentFactoryReferenceLabel,
  getContentFactoryRetroTitle,
  getContentFactoryReviewQueueGroups,
  groupPublicationsByDate,
  summarizeContentFactorySegments,
  summarizeContentFactorySegmentUsage,
  summarizeContentFactoryReferenceRecords,
  summarizeContentFactoryRetroSections,
  summarizeContentFactoryDashboard,
} = contentFactoryUtils;

test("content factory labels expose production wording", () => {
  assert.equal(CF_BUNDLE_STATUS_LABELS.production, "В производстве");
  assert.equal(CF_PUBLICATION_STATUS_LABELS.doctor_review, "Проверка врача");
});

test("reference table labels expose Sprint 7 dictionaries", () => {
  assert.equal(CF_REFERENCE_TABLE_LABELS?.platforms, "Platforms");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.formats, "Formats");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.rubrics, "Rubrics");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.nosologies, "Nosologies");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.funnel_templates, "Funnel templates");
});

test("segment source labels expose Sprint 8 segment sources", () => {
  assert.equal(CF_SEGMENT_SOURCE_LABELS?.getcourse, "GetCourse");
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

test("getContentFactoryReferenceLabel supports display names and template names", () => {
  assert.equal(typeof getContentFactoryReferenceLabel, "function");
  assert.equal(
    getContentFactoryReferenceLabel({
      code: "telegram",
      display_name: "Telegram",
    }),
    "Telegram",
  );
  assert.equal(
    getContentFactoryReferenceLabel({
      code: "launch",
      name: "Launch funnel",
    }),
    "Launch funnel",
  );
  assert.equal(getContentFactoryReferenceLabel({ code: "raw-code" }), "raw-code");
});

test("summarizeContentFactoryReferenceRecords counts active and inactive rows", () => {
  assert.equal(typeof summarizeContentFactoryReferenceRecords, "function");
  assert.deepEqual(
    summarizeContentFactoryReferenceRecords([
      { id: "1", is_active: true },
      { id: "2", is_active: false },
      { id: "3", is_active: true },
    ]),
    {
      total: 3,
      active: 2,
      inactive: 1,
    },
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

test("formatContentFactorySegmentCount renders grouped population counts", () => {
  assert.equal(typeof formatContentFactorySegmentCount, "function");
  assert.equal(formatContentFactorySegmentCount(0), "0");
  assert.equal(formatContentFactorySegmentCount(1234567), "1 234 567");
});

test("filterContentFactorySegments applies search, active, and source filters", () => {
  assert.equal(typeof filterContentFactorySegments, "function");
  const segments = [
    {
      id: "keep",
      name: "Breast cancer survivors",
      source_segment_id: "gc-001",
      source: "getcourse",
      is_active: true,
    },
    {
      id: "inactive",
      name: "Archived webinars",
      source_segment_id: "gc-002",
      source: "getcourse",
      is_active: false,
    },
    {
      id: "other-source",
      name: "Clinic leads",
      source_segment_id: "crm-001",
      source: "crm",
      is_active: true,
    },
  ];

  assert.deepEqual(
    filterContentFactorySegments(segments, {
      search: "survivors",
      active: "active",
      source: "getcourse",
    }).map((segment) => segment.id),
    ["keep"],
  );
  assert.deepEqual(
    filterContentFactorySegments(segments, {
      search: "gc-002",
      active: "inactive",
      source: "all",
    }).map((segment) => segment.id),
    ["inactive"],
  );
});

test("summarizeContentFactorySegments counts rows and total population", () => {
  assert.equal(typeof summarizeContentFactorySegments, "function");
  assert.deepEqual(
    summarizeContentFactorySegments([
      { id: "1", is_active: true, population_count: 10 },
      { id: "2", is_active: false, population_count: 5 },
      { id: "3", is_active: true, population_count: 7 },
    ]),
    {
      total: 3,
      active: 2,
      inactive: 1,
      population: 22,
    },
  );
});

test("compareContentFactorySegmentSnapshots returns latest previous and delta", () => {
  assert.equal(typeof compareContentFactorySegmentSnapshots, "function");
  assert.deepEqual(
    compareContentFactorySegmentSnapshots([
      {
        id: "latest",
        fetched_at: "2026-05-14T12:00:00Z",
        population_count: 150,
      },
      {
        id: "previous",
        fetched_at: "2026-05-13T12:00:00Z",
        population_count: 100,
      },
    ]),
    {
      latest: {
        id: "latest",
        fetched_at: "2026-05-14T12:00:00Z",
        population_count: 150,
      },
      previous: {
        id: "previous",
        fetched_at: "2026-05-13T12:00:00Z",
        population_count: 100,
      },
      delta: 50,
      deltaPercent: 50,
    },
  );
  assert.deepEqual(compareContentFactorySegmentSnapshots([]), {
    latest: null,
    previous: null,
    delta: null,
    deltaPercent: null,
  });
});

test("buildContentFactorySegmentUsageRows aggregates publication bundle role and metric evidence", () => {
  assert.equal(typeof buildContentFactorySegmentUsageRows, "function");

  const rows = buildContentFactorySegmentUsageRows({
    segments: [
      {
        id: "seg-used",
        name: "Breast cancer survivors",
        source_segment_id: "gc-001",
        source: "getcourse",
        is_active: true,
        population_count: 120,
      },
      {
        id: "seg-unused",
        name: "Dormant webinars",
        source_segment_id: "gc-002",
        source: "getcourse",
        is_active: true,
        population_count: 40,
      },
    ],
    publications: [
      {
        id: "pub-1",
        bundle_id: "bundle-live",
        title: "Breast webinar reminder",
        status: "published",
        scheduled_at: "2026-05-14T10:00:00Z",
        actual_published_at: "2026-05-14T11:00:00Z",
        updated_at: "2026-05-14T11:10:00Z",
      },
      {
        id: "pub-2",
        bundle_id: "bundle-production",
        title: "VK follow-up",
        status: "scheduled",
        scheduled_at: "2026-05-16T10:00:00Z",
        actual_published_at: null,
        updated_at: "2026-05-14T12:00:00Z",
      },
    ],
    bundles: [
      { id: "bundle-live", name: "May webinar", status: "live" },
      { id: "bundle-production", name: "Follow-up", status: "production" },
    ],
    segmentTargetsByPublicationId: {
      "pub-1": [
        {
          publication_id: "pub-1",
          external_segment_id: "seg-used",
          role: "target",
          expected_count: 100,
          actual_count_at_send: 90,
        },
      ],
      "pub-2": [
        {
          publication_id: "pub-2",
          external_segment_id: "seg-used",
          role: "exclusion",
          expected_count: 20,
          actual_count_at_send: null,
        },
      ],
    },
    metricsByPublicationId: {
      "pub-1": [
        {
          id: "metric-1",
          publication_id: "pub-1",
          captured_at: "2026-05-14T13:00:00Z",
        },
        {
          id: "metric-2",
          publication_id: "pub-1",
          captured_at: "2026-05-15T12:00:00Z",
        },
      ],
      "pub-2": [] as Array<{
        id: string;
        publication_id: string;
        captured_at: string;
      }>,
    },
  });

  const used = rows.find((row) => row.segment.id === "seg-used");
  assert.ok(used);
  assert.equal(used.totalTargetLinks, 2);
  assert.equal(used.publicationCount, 2);
  assert.equal(used.bundleCount, 2);
  assert.equal(used.roleCounts.target, 1);
  assert.equal(used.roleCounts.exclusion, 1);
  assert.equal(used.bundleStatusCounts.live, 1);
  assert.equal(used.bundleStatusCounts.production, 1);
  assert.equal(used.publishedPublicationCount, 1);
  assert.equal(used.metricEvidenceCount, 2);
  assert.equal(used.expectedCount, 120);
  assert.equal(used.actualCountAtSend, 90);
  assert.equal(used.latestActivityAt, "2026-05-15T12:00:00Z");
  assert.deepEqual(
    used.publications.map((item) => item.publication.id),
    ["pub-2", "pub-1"],
  );
});

test("summarizeContentFactorySegmentUsage counts unused active segments and unique published publications", () => {
  assert.equal(typeof summarizeContentFactorySegmentUsage, "function");

  const rows = buildContentFactorySegmentUsageRows({
    segments: [
      {
        id: "seg-used",
        name: "Survivors",
        source_segment_id: "gc-001",
        source: "getcourse",
        is_active: true,
      },
      {
        id: "seg-unused",
        name: "Unused active",
        source_segment_id: "gc-002",
        source: "getcourse",
        is_active: true,
      },
      {
        id: "seg-inactive",
        name: "Inactive unused",
        source_segment_id: "gc-003",
        source: "getcourse",
        is_active: false,
      },
    ],
    publications: [
      {
        id: "pub-1",
        bundle_id: "bundle-1",
        title: "Published post",
        status: "published",
        scheduled_at: null,
        actual_published_at: "2026-05-14T10:00:00Z",
      },
    ],
    bundles: [{ id: "bundle-1", name: "Bundle", status: "live" }],
    segmentTargetsByPublicationId: {
      "pub-1": [
        {
          publication_id: "pub-1",
          external_segment_id: "seg-used",
          role: "target",
          expected_count: null,
          actual_count_at_send: null,
        },
      ],
    },
    metricsByPublicationId: {
      "pub-1": [
        {
          id: "metric-1",
          publication_id: "pub-1",
          captured_at: "2026-05-14T12:00:00Z",
        },
      ],
    } as Record<string, Array<{
      id: string;
      publication_id: string;
      captured_at: string;
    }>>,
  });

  assert.deepEqual(summarizeContentFactorySegmentUsage(rows), {
    totalSegments: 3,
    segmentsInUse: 1,
    unusedActiveSegments: 1,
    totalTargetLinks: 1,
    publishedPublications: 1,
    metricEvidenceCount: 1,
  });
});

test("filterContentFactorySegmentUsageRows combines search usage and role filters", () => {
  assert.equal(typeof filterContentFactorySegmentUsageRows, "function");

  const rows = buildContentFactorySegmentUsageRows({
    segments: [
      {
        id: "seg-target",
        name: "Survivors",
        source_segment_id: "gc-001",
        source: "getcourse",
        is_active: true,
      },
      {
        id: "seg-exclusion",
        name: "Students",
        source_segment_id: "gc-002",
        source: "getcourse",
        is_active: true,
      },
      {
        id: "seg-unused",
        name: "Unused",
        source_segment_id: "gc-003",
        source: "getcourse",
        is_active: true,
      },
    ],
    publications: [
      {
        id: "pub-1",
        bundle_id: "bundle-1",
        title: "Survivor webinar",
        status: "scheduled",
        scheduled_at: "2026-05-14T10:00:00Z",
        actual_published_at: null,
      },
    ],
    bundles: [{ id: "bundle-1", name: "Bundle", status: "production" }],
    segmentTargetsByPublicationId: {
      "pub-1": [
        {
          publication_id: "pub-1",
          external_segment_id: "seg-target",
          role: "target",
          expected_count: null,
          actual_count_at_send: null,
        },
        {
          publication_id: "pub-1",
          external_segment_id: "seg-exclusion",
          role: "exclusion",
          expected_count: null,
          actual_count_at_send: null,
        },
      ],
    },
    metricsByPublicationId: {} as Record<string, Array<{
      id: string;
      publication_id: string;
      captured_at: string;
    }>>,
  });

  assert.deepEqual(
    filterContentFactorySegmentUsageRows(rows, {
      search: "survivor",
      usage: "used",
      role: "target",
    }).map((row) => row.segment.id),
    ["seg-target"],
  );
  assert.deepEqual(
    filterContentFactorySegmentUsageRows(rows, {
      search: "",
      usage: "unused",
      role: "all",
    }).map((row) => row.segment.id),
    ["seg-unused"],
  );
});

test("retro labels expose retrospective types", () => {
  assert.equal(CF_RETRO_TYPE_LABELS.weekly, "Weekly");
  assert.equal(CF_RETRO_TYPE_LABELS.monthly, "Monthly");
  assert.equal(CF_RETRO_TYPE_LABELS.bundle, "Bundle");
  assert.equal(CF_RETRO_TYPE_LABELS.adhoc, "Ad-hoc");
});

test("formatContentFactoryRetroPeriod renders period range", () => {
  assert.equal(
    formatContentFactoryRetroPeriod({
      period_start: "2026-05-01",
      period_end: "2026-05-07",
    }),
    "01 мая 2026 — 07 мая 2026",
  );
});

test("getContentFactoryRetroTitle combines type and period", () => {
  assert.equal(
    getContentFactoryRetroTitle({
      retro_type: "bundle",
      period_start: "2026-05-01",
      period_end: "2026-05-31",
    }),
    "Bundle · 01 мая 2026 — 31 мая 2026",
  );
});

test("summarizeContentFactoryRetroSections counts structured evidence", () => {
  assert.deepEqual(
    summarizeContentFactoryRetroSections({
      best_by_objective: { awareness: "vk", registration: "email" },
      broken: [{ id: "late" }, { id: "wrong-cta" }],
      learnings: { cadence: "weekly" },
      decisions: { keep: "segment-first" },
      actions: [{ owner: "copy" }, { owner: "doctor" }, { owner: "analytics" }],
    }),
    {
      bestByObjective: 2,
      broken: 2,
      learnings: 1,
      decisions: 1,
      actions: 3,
    },
  );
});
