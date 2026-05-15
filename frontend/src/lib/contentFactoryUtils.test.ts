import assert from "node:assert/strict";
import test from "node:test";

import * as contentFactoryUtils from "./contentFactoryUtils.ts";

const {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  CF_REFERENCE_TABLE_LABELS,
  CF_RETRO_TYPE_LABELS,
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_GIFT_STATUS_LABELS,
  CF_GUEST_ROLE_LABELS,
  CF_GUEST_STATUS_LABELS,
  CF_CONFIDENCE_LABELS,
  CF_METRIC_SOURCE_LABELS,
  CF_METRIC_WINDOW_LABELS,
  CF_SEGMENT_SOURCE_LABELS,
  CONTENT_FACTORY_METRIC_PRESETS,
  buildContentFactoryBundleParams,
  buildContentFactoryEffectivenessRows,
  buildContentFactoryGuestStageTimeline,
  buildContentFactoryPublishPackage,
  buildContentFactoryPublicationVariantHandoff,
  buildContentFactoryPublicationVariants,
  buildContentFactorySegmentUsageRows,
  buildContentFactoryUtm,
  canAccessContentFactory,
  cleanContentFactoryPublicationUpdate,
  compareContentFactorySegmentSnapshots,
  filterContentFactoryEffectivenessRows,
  filterContentFactoryGuestStories,
  filterContentFactoryPublicationIndex,
  filterContentFactorySegmentUsageRows,
  filterContentFactoryPublications,
  filterContentFactorySegments,
  formatContentFactoryBundleCount,
  formatContentFactoryMetricValue,
  formatContentFactoryPublicationCount,
  formatContentFactoryRetroPeriod,
  formatContentFactorySegmentCount,
  getAvailableContentFactorySegments,
  getContentFactoryCalendarPublicationState,
  getContentFactoryGuestAttention,
  getContentFactoryDisplayName,
  getContentFactoryPlatformCapabilities,
  getContentFactoryPublicationVariantCoverage,
  getContentFactoryPublicationMetricInsights,
  getContentFactoryPublicationOperations,
  getContentFactoryPublicationReadiness,
  getContentFactoryPublicationWorkflowActions,
  getContentFactoryReferenceLabel,
  getContentFactoryRetroTitle,
  getContentFactoryReviewQueueGroups,
  getContentFactoryReviewQueueItemSignal,
  parseContentFactoryMetricImportRows,
  groupPublicationsByDate,
  isContentFactoryGuestFollowUpDue,
  isContentFactoryGuestStoryActive,
  summarizeContentFactoryEffectiveness,
  summarizeContentFactoryGuestStories,
  summarizeContentFactoryCalendar,
  summarizeContentFactoryPublicationIndex,
  summarizeContentFactoryReviewQueue,
  summarizeContentFactorySegments,
  summarizeContentFactorySegmentUsage,
  summarizeContentFactoryReferenceRecords,
  summarizeContentFactoryRetroSections,
  summarizeContentFactoryDashboard,
  sortContentFactoryPublicationsForIndex,
  sortContentFactoryGuestStoriesByAttention,
} = contentFactoryUtils;

test("content factory labels expose production wording", () => {
  assert.equal(CF_BUNDLE_STATUS_LABELS.production, "В производстве");
  assert.equal(CF_PUBLICATION_STATUS_LABELS.doctor_review, "Проверка врача");
});

test("reference table labels expose Sprint 7 dictionaries", () => {
  assert.equal(CF_REFERENCE_TABLE_LABELS?.platforms, "Площадки");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.formats, "Форматы");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.rubrics, "Рубрики");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.nosologies, "Нозологии");
  assert.equal(CF_REFERENCE_TABLE_LABELS?.funnel_templates, "Шаблоны кампаний");
});

test("segment source labels expose Sprint 8 segment sources", () => {
  assert.equal(CF_SEGMENT_SOURCE_LABELS?.getcourse, "GetCourse");
});

test("metric capture labels expose readable production wording", () => {
  assert.equal(CF_METRIC_WINDOW_LABELS?.["24h"], "Через 24 часа");
  assert.equal(CF_METRIC_WINDOW_LABELS?.final, "Финальный срез");
  assert.equal(CF_METRIC_SOURCE_LABELS?.tgstat, "TGStat");
  assert.equal(CF_METRIC_SOURCE_LABELS?.vk_api, "VK API");
  assert.equal(CF_CONFIDENCE_LABELS?.medium, "Среднее");
  assert.ok(CONTENT_FACTORY_METRIC_PRESETS.includes("Просмотры"));
  assert.ok(CONTENT_FACTORY_METRIC_PRESETS.includes("Регистрации"));
});

test("guest story labels expose Russian workflow wording", () => {
  assert.equal(CF_GUEST_ROLE_LABELS.patient, "Пациент");
  assert.equal(CF_GUEST_STATUS_LABELS.editorial_screening, "Редакционный отбор");
  assert.equal(CF_GUEST_CONSENT_STATUS_LABELS.signed, "Подписано");
  assert.equal(CF_GUEST_GIFT_STATUS_LABELS.pending, "Нужно отправить");
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

test("guest story helpers detect active pipeline and due follow-up", () => {
  assert.equal(isContentFactoryGuestStoryActive({ status: "sourced" }), true);
  assert.equal(isContentFactoryGuestStoryActive({ status: "published" }), true);
  assert.equal(isContentFactoryGuestStoryActive({ status: "follow_up_done" }), false);
  assert.equal(isContentFactoryGuestStoryActive({ status: "rejected" }), false);
  assert.equal(
    isContentFactoryGuestFollowUpDue(
      {
        status: "published",
        follow_up_due_at: "2026-05-13T12:00:00Z",
      },
      new Date("2026-05-14T12:00:00Z"),
    ),
    true,
  );
  assert.equal(
    isContentFactoryGuestFollowUpDue(
      {
        status: "follow_up_done",
        follow_up_due_at: "2026-05-13T12:00:00Z",
      },
      new Date("2026-05-14T12:00:00Z"),
    ),
    false,
  );
});

test("guest story stage timeline derives stages from activity events", () => {
  const timeline = buildContentFactoryGuestStageTimeline(
    {
      id: "guest-1",
      status: "published",
      stage_due_at: "2026-05-20T10:00:00Z",
      created_at: "2026-05-10T09:00:00Z",
    },
    [
      {
        id: "event-created",
        event_type: "created",
        old_value: null,
        new_value: "sourced",
        created_at: "2026-05-10T09:00:00Z",
      },
      {
        id: "event-consent",
        event_type: "status_changed",
        old_value: "sourced",
        new_value: "consent_sent",
        created_at: "2026-05-11T10:00:00Z",
      },
      {
        id: "event-published",
        event_type: "status_changed",
        old_value: "consent_sent",
        new_value: "published",
        created_at: "2026-05-13T10:00:00Z",
      },
      {
        id: "event-comment",
        event_type: "comment",
        old_value: null,
        new_value: null,
        created_at: "2026-05-13T12:00:00Z",
      },
    ],
    new Date("2026-05-15T10:00:00Z"),
  );

  assert.deepEqual(
    timeline.items.map((item) => item.status),
    ["sourced", "consent_sent", "published"],
  );
  assert.equal(timeline.items[0].label, "Найден кандидат");
  assert.equal(timeline.items[0].durationLabel, "1 день");
  assert.equal(timeline.items[1].durationLabel, "2 дня");
  assert.equal(timeline.currentItem.status, "published");
  assert.equal(timeline.currentItem.isCurrent, true);
  assert.equal(timeline.currentDurationLabel, "2 дня");
  assert.equal(timeline.missingNextStep, false);
});

test("guest story stage timeline falls back when activity is missing", () => {
  const timeline = buildContentFactoryGuestStageTimeline(
    {
      id: "guest-legacy",
      status: "editorial_screening",
      stage_due_at: null,
      created_at: "2026-05-14T12:00:00Z",
    },
    [],
    new Date("2026-05-15T12:00:00Z"),
  );

  assert.equal(timeline.items.length, 1);
  assert.equal(timeline.currentItem.status, "editorial_screening");
  assert.equal(timeline.currentItem.label, "Редакционный отбор");
  assert.equal(timeline.currentDurationLabel, "1 день");
  assert.equal(timeline.missingNextStep, true);
});

test("guest story summary counts operational states", () => {
  const summary = summarizeContentFactoryGuestStories(
    [
      {
        id: "g1",
        status: "sourced",
        consent_status: "not_started",
        gift_status: "not_required",
        follow_up_due_at: null,
      },
      {
        id: "g2",
        status: "published",
        consent_status: "signed",
        gift_status: "pending",
        follow_up_due_at: "2026-05-13T12:00:00Z",
      },
      {
        id: "g3",
        status: "follow_up_done",
        consent_status: "signed",
        gift_status: "received",
        follow_up_due_at: "2026-05-10T12:00:00Z",
      },
    ],
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(summary.total, 3);
  assert.equal(summary.active, 2);
  assert.equal(summary.consentSigned, 2);
  assert.equal(summary.followUpsDue, 1);
  assert.equal(summary.giftPending, 1);
});

test("guest story attention explains due actions in Russian", () => {
  const attention = getContentFactoryGuestAttention(
    {
      status: "scheduled",
      stage_due_at: "2026-05-13T12:00:00Z",
      consent_status: "sent",
      gift_status: "pending",
      follow_up_due_at: null,
    },
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(attention.needsAttention, true);
  assert.equal(attention.nextAction, "Связаться и закрыть просроченный следующий шаг");
  assert.deepEqual(
    attention.reasons.map((reason) => reason.label),
    [
      "Просрочен следующий шаг",
      "Нужно закрыть согласие",
      "Нужно отправить подарок",
    ],
  );
});

test("guest story attention ignores closed stories and flags missing next step", () => {
  assert.equal(
    getContentFactoryGuestAttention(
      {
        status: "follow_up_done",
        stage_due_at: "2026-05-13T12:00:00Z",
        consent_status: "sent",
        gift_status: "pending",
        follow_up_due_at: "2026-05-13T12:00:00Z",
      },
      new Date("2026-05-14T12:00:00Z"),
    ).needsAttention,
    false,
  );

  const activeWithoutStep = getContentFactoryGuestAttention(
    {
      status: "editorial_screening",
      stage_due_at: null,
      consent_status: "not_started",
      gift_status: "not_required",
      follow_up_due_at: null,
    },
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(activeWithoutStep.needsAttention, true);
  assert.equal(activeWithoutStep.nextAction, "Назначить следующий шаг и срок");
  assert.deepEqual(
    activeWithoutStep.reasons.map((reason) => reason.key),
    ["stage_missing"],
  );
});

test("guest story attention summary filter and sort prioritize urgent records", () => {
  const stories = [
    {
      id: "later",
      status: "sourced",
      stage_due_at: "2026-05-20T12:00:00Z",
      consent_status: "not_started",
      gift_status: "not_required",
      follow_up_due_at: null,
    },
    {
      id: "gift",
      status: "published",
      stage_due_at: "2026-05-20T12:00:00Z",
      consent_status: "signed",
      gift_status: "pending",
      follow_up_due_at: null,
    },
    {
      id: "overdue",
      status: "producer_call_scheduled",
      stage_due_at: "2026-05-13T12:00:00Z",
      consent_status: "not_started",
      gift_status: "not_required",
      follow_up_due_at: null,
    },
  ];

  const now = new Date("2026-05-14T12:00:00Z");

  assert.equal(summarizeContentFactoryGuestStories(stories, now).attentionNeeded, 2);
  assert.deepEqual(
    filterContentFactoryGuestStories(stories, { attention: "needs_attention" }, now).map(
      (story) => story.id,
    ),
    ["gift", "overdue"],
  );
  assert.deepEqual(
    sortContentFactoryGuestStoriesByAttention(stories, now).map((story) => story.id),
    ["overdue", "gift", "later"],
  );
});

test("guest story filters combine search status consent owner and campaign", () => {
  const stories = [
    {
      id: "g1",
      display_name: "Анна Иванова",
      contact_ref: "@anna",
      role: "patient",
      source: "open_call",
      source_notes: "Telegram form",
      story_brief: "История про реабилитацию",
      status: "consent_sent",
      owner_id: "member-1",
      bundle_id: "bundle-1",
      publication_id: null,
      screening_notes: "Спокойно говорит",
      medical_factcheck_notes: null,
      rejection_reason: null,
      consent_status: "sent",
      allowed_channels: ["telegram"],
      anonymity_level: "first_name",
      sensitive_topics: ["clinic"],
      legal_notes: "Не называем клинику",
      gift_status: "pending",
    },
    {
      id: "g2",
      display_name: "Пётр",
      contact_ref: null,
      role: "doctor",
      source: "referral",
      source_notes: null,
      story_brief: "Экспертный комментарий",
      status: "rejected",
      owner_id: "member-2",
      bundle_id: "bundle-2",
      publication_id: null,
      screening_notes: null,
      medical_factcheck_notes: null,
      rejection_reason: "Не подходит под тему",
      consent_status: "not_started",
      allowed_channels: [],
      anonymity_level: "full_name",
      sensitive_topics: [],
      legal_notes: null,
      gift_status: "not_required",
    },
  ];

  const result = filterContentFactoryGuestStories(stories, {
    search: "клинику",
    status: "consent_sent",
    consentStatus: "sent",
    ownerId: "member-1",
    bundleId: "bundle-1",
  });

  assert.deepEqual(
    result.map((story) => story.id),
    ["g1"],
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

test("calendar operations classify publication planning states", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  assert.deepEqual(
    [
      {
        id: "overdue",
        status: "scheduled",
        scheduled_at: "2026-05-14T10:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "today",
        status: "scheduled",
        scheduled_at: "2026-05-15T18:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "ready",
        status: "approved",
        scheduled_at: "2026-05-16T10:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "needs-text",
        status: "approved",
        scheduled_at: "2026-05-16T10:00:00Z",
        body_text: "",
        utm: { utm_source: "telegram" },
      },
      {
        id: "needs-utm",
        status: "scheduled",
        scheduled_at: "2026-05-16T10:00:00Z",
        body_text: "Готовый текст",
        utm: {},
      },
      {
        id: "published-missing-fact",
        status: "published",
        scheduled_at: "2026-05-15T10:00:00Z",
        actual_published_at: null,
        platform_post_url: null,
        platform_post_id: null,
      },
      {
        id: "published",
        status: "published",
        scheduled_at: "2026-05-15T10:00:00Z",
        actual_published_at: "2026-05-15T10:10:00Z",
        platform_post_url: "https://t.me/oncoschool/123",
        platform_post_id: null,
      },
      {
        id: "cancelled",
        status: "cancelled",
        scheduled_at: "2026-05-16T10:00:00Z",
      },
      {
        id: "unscheduled",
        status: "draft",
        scheduled_at: null,
        body_text: "Черновик",
        utm: {},
      },
    ].map((publication) => {
      const state = getContentFactoryCalendarPublicationState(publication, now);
      return [publication.id, state.key, state.label, state.actionLabel];
    }),
    [
      ["overdue", "overdue", "Просрочен план", "Проверить выпуск"],
      ["today", "today", "Сегодня", "Открыть пакет"],
      ["ready", "ready", "Готово к выходу", "Открыть пакет"],
      ["needs-text", "needs_text", "Нужен текст", "Заполнить текст"],
      ["needs-utm", "needs_utm", "Нужны UTM", "Добавить UTM"],
      ["published-missing-fact", "published_needs_fact", "Заполнить факт", "Добавить факт"],
      ["published", "published", "Опубликовано", "Проверить метрики"],
      ["cancelled", "inactive", "Не выходит", "Открыть карточку"],
      ["unscheduled", "unscheduled", "Без даты", "Назначить дату"],
    ],
  );
});

test("calendar summary counts filtered operational signals", () => {
  const summary = summarizeContentFactoryCalendar(
    [
      {
        id: "overdue",
        status: "scheduled",
        scheduled_at: "2026-05-14T10:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "today",
        status: "scheduled",
        scheduled_at: "2026-05-15T18:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "ready",
        status: "approved",
        scheduled_at: "2026-05-16T10:00:00Z",
        body_text: "Готовый текст",
        utm: { utm_source: "telegram" },
      },
      {
        id: "needs-text",
        status: "approved",
        scheduled_at: "2026-05-16T10:00:00Z",
        body_text: "",
        utm: { utm_source: "telegram" },
      },
      {
        id: "unscheduled",
        status: "draft",
        scheduled_at: null,
        body_text: "Черновик",
        utm: {},
      },
    ],
    new Date("2026-05-15T12:00:00Z"),
  );

  assert.deepEqual(summary, {
    total: 5,
    today: 1,
    overdue: 1,
    readyToPublish: 2,
    needsAction: 3,
    unscheduled: 1,
  });
});

test("publication index helpers summarize search and sort rows", () => {
  assert.equal(typeof summarizeContentFactoryPublicationIndex, "function");
  assert.equal(typeof filterContentFactoryPublicationIndex, "function");
  assert.equal(typeof sortContentFactoryPublicationsForIndex, "function");

  const publications = [
    {
      id: "published-without-url",
      bundle_id: "bundle-webinar",
      platform_id: "telegram",
      format_id: "post",
      responsible_id: "member-1",
      title: "Reminder",
      body_text: "Registration closes tomorrow",
      status: "published",
      scheduled_at: "2026-05-14T10:00:00Z",
      actual_published_at: "2026-05-14T11:00:00Z",
      platform_post_url: null,
      updated_at: "2026-05-14T11:05:00Z",
      created_at: "2026-05-13T10:00:00Z",
    },
    {
      id: "scheduled-vk",
      bundle_id: "bundle-story",
      platform_id: "vk",
      format_id: "story",
      responsible_id: "member-2",
      title: "Patient story",
      body_text: "Warm trust content",
      status: "scheduled",
      scheduled_at: "2026-05-20T10:00:00Z",
      actual_published_at: null,
      platform_post_url: null,
      updated_at: "2026-05-13T12:00:00Z",
      created_at: "2026-05-12T10:00:00Z",
    },
    {
      id: "draft-email",
      bundle_id: "bundle-webinar",
      platform_id: "email",
      format_id: "letter",
      responsible_id: "member-1",
      title: "Draft letter",
      body_text: null,
      status: "needs_copy",
      scheduled_at: null,
      actual_published_at: null,
      platform_post_url: null,
      updated_at: "2026-05-10T12:00:00Z",
      created_at: "2026-05-10T10:00:00Z",
    },
  ];

  assert.deepEqual(summarizeContentFactoryPublicationIndex(publications), {
    total: 3,
    inProduction: 2,
    scheduled: 1,
    published: 1,
    publishedWithoutPostUrl: 1,
  });

  assert.deepEqual(
    filterContentFactoryPublicationIndex(
      publications,
      { platform_id: "vk" },
      "trust",
      {
        bundleNames: new Map([
          ["bundle-story", "Patient stories"],
          ["bundle-webinar", "May webinar"],
        ]),
        platformNames: new Map([
          ["vk", "VK"],
          ["telegram", "Telegram"],
        ]),
        formatNames: new Map([
          ["story", "История"],
          ["post", "Пост"],
        ]),
        responsibleNames: new Map([
          ["member-1", "Мария"],
          ["member-2", "Олег"],
        ]),
      },
    ).map((publication) => publication.id),
    ["scheduled-vk"],
  );

  assert.deepEqual(
    sortContentFactoryPublicationsForIndex(publications).map(
      (publication) => publication.id,
    ),
    ["scheduled-vk", "published-without-url", "draft-email"],
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
  assert.equal(formatContentFactoryBundleCount(1), "1 кампания");
  assert.equal(formatContentFactoryBundleCount(2), "2 кампании");
  assert.equal(formatContentFactoryBundleCount(5), "5 кампаний");
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

test("publication operations normalize platform capability labels", () => {
  assert.equal(typeof getContentFactoryPlatformCapabilities, "function");

  const apiReady = getContentFactoryPlatformCapabilities({
    capabilities: {
      api_publish: true,
      api_metrics: true,
      manual_publish: false,
      manual_metrics: false,
      supports_post_url: true,
    },
  });

  assert.equal(apiReady.canPublishManually, false);
  assert.equal(apiReady.canPublishViaApi, true);
  assert.equal(apiReady.canCollectMetricsManually, false);
  assert.equal(apiReady.canCollectMetricsViaApi, true);
  assert.equal(apiReady.canStorePostUrl, true);
  assert.equal(apiReady.publicationModeLabel, "API-публикация");
  assert.equal(apiReady.metricsModeLabel, "API-метрики");

  const fallback = getContentFactoryPlatformCapabilities(null);

  assert.equal(fallback.canPublishManually, true);
  assert.equal(fallback.canPublishViaApi, false);
  assert.equal(fallback.canCollectMetricsManually, true);
  assert.equal(fallback.canCollectMetricsViaApi, false);
  assert.equal(fallback.canStorePostUrl, true);
  assert.equal(fallback.publicationModeLabel, "Ручная публикация");
  assert.equal(fallback.metricsModeLabel, "Ручной сбор метрик");
});

test("publication operations summarize publish fact and metric evidence", () => {
  assert.equal(typeof getContentFactoryPublicationOperations, "function");

  const incomplete = getContentFactoryPublicationOperations(
    {
      status: "published",
      scheduled_at: "2026-05-14T10:00:00Z",
      actual_published_at: null,
      platform_post_url: null,
      platform_post_id: null,
    },
    {
      capabilities: {
        manual_publish: true,
        manual_metrics: true,
        supports_post_url: true,
      },
    },
    [],
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(incomplete.publishFactLabel, "Опубликовано, но факт не заполнен");
  assert.equal(incomplete.missingPublishedAt, true);
  assert.equal(incomplete.missingPostUrl, true);
  assert.equal(incomplete.needsMetricEvidence, true);
  assert.equal(incomplete.metricEvidenceLabel, "Метрик пока нет");

  const complete = getContentFactoryPublicationOperations(
    {
      status: "published",
      scheduled_at: "2026-05-14T10:00:00Z",
      actual_published_at: "2026-05-14T11:00:00Z",
      platform_post_url: "https://t.me/oncoschool/123",
      platform_post_id: "123",
    },
    null,
    [
      {
        id: "metric-1",
        captured_at: "2026-05-14T12:00:00Z",
      },
    ],
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(complete.publishFactLabel, "Факт публикации заполнен");
  assert.equal(complete.missingPublishedAt, false);
  assert.equal(complete.missingPostUrl, false);
  assert.equal(complete.needsMetricEvidence, false);
  assert.equal(complete.metricEvidenceLabel, "1 метрика");
});

test("publication operations gate manual publish fact by workflow status", () => {
  const draft = getContentFactoryPublicationOperations(
    {
      status: "draft",
      scheduled_at: null,
      actual_published_at: null,
      platform_post_url: null,
      platform_post_id: null,
    },
    null,
    [],
    new Date("2026-05-14T12:00:00Z"),
  );

  assert.equal(draft.canSavePublishFact, false);
  assert.equal(
    draft.publishFactDisabledReason,
    "Сначала доведите публикацию до одобрения или календаря.",
  );

  for (const status of ["approved", "scheduled", "published"] as const) {
    const operations = getContentFactoryPublicationOperations(
      {
        status,
        scheduled_at: "2026-05-20T10:00:00Z",
        actual_published_at: status === "published" ? "2026-05-20T11:00:00Z" : null,
        platform_post_url: null,
        platform_post_id: null,
      },
      null,
      [],
      new Date("2026-05-14T12:00:00Z"),
    );

    assert.equal(operations.canSavePublishFact, true);
    assert.equal(operations.publishFactDisabledReason, null);
  }
});

test("metric paste import parses header and localized rows", () => {
  const preview = parseContentFactoryMetricImportRows(`
Окно | Метрика | Значение | Источник | Доверие | Заметка
24 часа | Просмотры | 1 200,5 | TGStat | Высокое | экспорт из TGStat
7d | Регистрации | 34 | GetCourse | Среднее | ручной отчёт
`);

  assert.equal(preview.validRows.length, 2);
  assert.equal(preview.invalidRows.length, 0);
  assert.deepEqual(
    preview.validRows.map((row) => row.payload),
    [
      {
        window: "24h",
        metric_name: "Просмотры",
        metric_value: 1200.5,
        metric_value_text: null,
        source: "tgstat",
        source_method: "импорт из буфера",
        confidence: "high",
        note: "экспорт из TGStat",
      },
      {
        window: "7d",
        metric_name: "Регистрации",
        metric_value: 34,
        metric_value_text: null,
        source: "getcourse",
        source_method: "импорт из буфера",
        confidence: "medium",
        note: "ручной отчёт",
      },
    ],
  );
});

test("metric paste import defaults source confidence and detects invalid rows", () => {
  const preview = parseContentFactoryMetricImportRows(`
72h;Клики;42
bad;Охват;100
24h;;10
24h;Просмотры;abc
`);

  assert.equal(preview.validRows.length, 1);
  assert.deepEqual(preview.validRows[0]?.payload, {
    window: "72h",
    metric_name: "Клики",
    metric_value: 42,
    metric_value_text: null,
    source: "import",
    source_method: "импорт из буфера",
    confidence: "medium",
    note: null,
  });
  assert.deepEqual(
    preview.invalidRows.map((row) => [row.lineNumber, row.error]),
    [
      [3, "Неизвестное окно измерения"],
      [4, "Укажите название метрики"],
      [5, "Значение метрики должно быть числом"],
    ],
  );
});

test("publication metric insights summarize latest best and windows", () => {
  const insights = getContentFactoryPublicationMetricInsights([
    {
      id: "views-24h",
      publication_id: "pub-1",
      window: "24h",
      metric_name: "Просмотры",
      metric_value: 1200,
      metric_value_text: null,
      source: "tgstat",
      source_method: "import",
      confidence: "high",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-15T12:00:00Z",
      raw_payload: null,
      created_at: "2026-05-15T12:00:00Z",
    },
    {
      id: "views-7d",
      publication_id: "pub-1",
      window: "7d",
      metric_name: "Просмотры",
      metric_value: 1800,
      metric_value_text: null,
      source: "tgstat",
      source_method: "import",
      confidence: "medium",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-16T12:00:00Z",
      raw_payload: null,
      created_at: "2026-05-16T12:00:00Z",
    },
    {
      id: "regs-24h",
      publication_id: "pub-1",
      window: "24h",
      metric_name: "Регистрации",
      metric_value: 24,
      metric_value_text: null,
      source: "getcourse",
      source_method: "manual",
      confidence: "low",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-15T13:00:00Z",
      raw_payload: null,
      created_at: "2026-05-15T13:00:00Z",
    },
  ]);

  assert.equal(insights.totalMetrics, 3);
  assert.equal(insights.uniqueMetricNames, 2);
  assert.equal(insights.latestMetric?.id, "views-7d");
  assert.equal(insights.latestMetricLabel, "Просмотры · 1 800 · 7 дней");
  assert.equal(insights.nextAction, "Добавьте финальный срез.");
  assert.deepEqual(
    insights.groups.map((group) => [
      group.metricName,
      group.count,
      group.latestMetric.id,
      group.latestValueLabel,
      group.bestNumericMetric?.id,
      group.bestNumericValueLabel,
      group.coveredWindows,
    ]),
    [
      [
        "Просмотры",
        2,
        "views-7d",
        "1 800",
        "views-7d",
        "1 800",
        ["24h", "7d"],
      ],
      [
        "Регистрации",
        1,
        "regs-24h",
        "24",
        "regs-24h",
        "24",
        ["24h"],
      ],
    ],
  );
  assert.deepEqual(
    insights.windows.map((window) => [window.window, window.covered]),
    [
      ["3h", false],
      ["24h", true],
      ["72h", false],
      ["7d", true],
      ["final", false],
    ],
  );
});

test("publication metric insights handles empty and low-confidence states", () => {
  const empty = getContentFactoryPublicationMetricInsights([]);

  assert.equal(empty.totalMetrics, 0);
  assert.equal(empty.uniqueMetricNames, 0);
  assert.equal(empty.latestMetric, null);
  assert.equal(empty.latestMetricLabel, "Метрик пока нет");
  assert.equal(empty.nextAction, "Добавьте первые метрики вручную или через импорт.");
  assert.equal(empty.groups.length, 0);

  const completeButLowConfidence = getContentFactoryPublicationMetricInsights([
    {
      id: "views-24h",
      publication_id: "pub-1",
      window: "24h",
      metric_name: "Просмотры",
      metric_value: 100,
      metric_value_text: null,
      source: "manual",
      source_method: "manual",
      confidence: "low",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-15T12:00:00Z",
      raw_payload: null,
      created_at: "2026-05-15T12:00:00Z",
    },
    {
      id: "views-7d",
      publication_id: "pub-1",
      window: "7d",
      metric_name: "Просмотры",
      metric_value: 400,
      metric_value_text: null,
      source: "manual",
      source_method: "manual",
      confidence: "medium",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-16T12:00:00Z",
      raw_payload: null,
      created_at: "2026-05-16T12:00:00Z",
    },
    {
      id: "views-final",
      publication_id: "pub-1",
      window: "final",
      metric_name: "Просмотры",
      metric_value: 550,
      metric_value_text: null,
      source: "manual",
      source_method: "manual",
      confidence: "medium",
      note: null,
      captured_by_id: null,
      captured_at: "2026-05-17T12:00:00Z",
      raw_payload: null,
      created_at: "2026-05-17T12:00:00Z",
    },
  ]);

  assert.equal(
    completeButLowConfidence.nextAction,
    "Проверьте метрики с низким доверием.",
  );
});

test("publication readiness checklist explains missing and after-publish steps", () => {
  const draftItems = getContentFactoryPublicationReadiness(
    {
      status: "scheduled",
      body_text: "Готовый текст",
      scheduled_at: "2026-05-20T10:00:00Z",
      actual_published_at: null,
      platform_post_url: null,
      platform_post_id: null,
      utm: { utm_source: "telegram" },
    },
    [{ external_segment_id: "segment-1" }],
    [],
  );

  assert.deepEqual(
    draftItems.map((item) => [item.key, item.statusLabel]),
    [
      ["body", "Готово"],
      ["schedule", "Готово"],
      ["utm", "Готово"],
      ["audience", "Готово"],
      ["publish_fact", "После публикации"],
      ["metrics", "После публикации"],
    ],
  );

  const publishedItems = getContentFactoryPublicationReadiness(
    {
      status: "published",
      body_text: "",
      scheduled_at: null,
      actual_published_at: "2026-05-20T12:00:00Z",
      platform_post_url: "",
      platform_post_id: "",
      utm: {},
    },
    [],
    [],
  );

  assert.deepEqual(
    publishedItems.map((item) => [item.key, item.statusLabel]),
    [
      ["body", "Нужно заполнить"],
      ["schedule", "Нужно заполнить"],
      ["utm", "Нужно заполнить"],
      ["audience", "Нужно заполнить"],
      ["publish_fact", "Нужно заполнить"],
      ["metrics", "Нужно заполнить"],
    ],
  );
});

test("publication readiness checklist includes adaptation coverage when provided", () => {
  const readyCoverage = getContentFactoryPublicationVariantCoverage({
    publication: { version_number: 2 },
    savedVariants: [
      { channel: "telegram", body_text: "Telegram", source_version_number: 2 },
      { channel: "vk", body_text: "VK", source_version_number: 2 },
      { channel: "email", body_text: "Email", source_version_number: 2 },
      { channel: "push", body_text: "Push", source_version_number: 2 },
      { channel: "max", body_text: "Max", source_version_number: 2 },
      { channel: "dzen", body_text: "Dzen", source_version_number: 2 },
    ],
  });
  const readyItems = getContentFactoryPublicationReadiness(
    {
      status: "scheduled",
      body_text: "Готовый текст",
      scheduled_at: "2026-05-20T10:00:00Z",
      actual_published_at: null,
      platform_post_url: null,
      platform_post_id: null,
      utm: { utm_source: "telegram" },
    },
    [{ external_segment_id: "segment-1" }],
    [],
    readyCoverage,
  );

  assert.deepEqual(
    readyItems.map((item) => [item.key, item.statusLabel]),
    [
      ["body", "Готово"],
      ["schedule", "Готово"],
      ["utm", "Готово"],
      ["adaptations", "Готово"],
      ["audience", "Готово"],
      ["publish_fact", "После публикации"],
      ["metrics", "После публикации"],
    ],
  );
  assert.match(
    readyItems.find((item) => item.key === "adaptations")?.description ?? "",
    /Все 6 каналов сохранены и актуальны/,
  );

  const partialCoverage = getContentFactoryPublicationVariantCoverage({
    publication: { version_number: 4 },
    savedVariants: [
      { channel: "telegram", body_text: "Telegram", source_version_number: 4 },
      { channel: "email", body_text: "Email", source_version_number: 3 },
    ],
  });
  const partialItems = getContentFactoryPublicationReadiness(
    {
      status: "scheduled",
      body_text: "Готовый текст",
      scheduled_at: "2026-05-20T10:00:00Z",
      actual_published_at: null,
      platform_post_url: null,
      platform_post_id: null,
      utm: { utm_source: "telegram" },
    },
    [{ external_segment_id: "segment-1" }],
    [],
    partialCoverage,
  );
  const adaptationItem = partialItems.find((item) => item.key === "adaptations");

  assert.equal(adaptationItem?.statusLabel, "Нужно заполнить");
  assert.match(adaptationItem?.description ?? "", /Не хватает: VK, Push, Max, Дзен/);
  assert.match(adaptationItem?.description ?? "", /Устарели: Email/);
});

test("publication workflow actions expose readable next status steps", () => {
  assert.deepEqual(
    getContentFactoryPublicationWorkflowActions({
      status: "needs_copy",
      scheduled_at: null,
    }).map((action) => [
      action.key,
      action.targetStatus,
      action.label,
      action.tone,
      action.disabled,
    ]),
    [
      ["send_to_design", "needs_design", "Передать на дизайн", "default", false],
      ["send_to_factcheck", "factcheck", "На фактчек", "primary", false],
      ["cancel", "cancelled", "Отменить", "danger", false],
    ],
  );
});

test("publication workflow actions guard scheduling and published state", () => {
  const approvedWithoutDate = getContentFactoryPublicationWorkflowActions({
    status: "approved",
    scheduled_at: null,
  });

  assert.deepEqual(
    approvedWithoutDate.map((action) => [
      action.key,
      action.targetStatus,
      action.disabled,
      action.disabledReason,
    ]),
    [
      ["schedule", "scheduled", true, "Сначала укажите плановую дату"],
      ["return_to_doctor", "doctor_review", false, null],
      ["cancel", "cancelled", false, null],
    ],
  );

  assert.equal(
    getContentFactoryPublicationWorkflowActions({
      status: "published",
      scheduled_at: "2026-05-20T10:00:00Z",
    }).length,
    0,
  );
});

test("publication publish package composes a copy-ready handoff", () => {
  const publishPackage = buildContentFactoryPublishPackage({
    publication: {
      id: "pub-telegram-reminder",
      title: "Напоминание о вебинаре",
      body_text: "Друзья, завтра встречаемся на вебинаре.",
      media_refs: ["https://assets.example.com/banner.png"],
      scheduled_at: "2026-05-20T10:30:00Z",
      utm: {
        utm_source: "telegram",
        utm_medium: "post",
        utm_campaign: "bundle-rmj-may",
      },
    },
    platform: {
      id: "platform-telegram",
      code: "telegram",
      display_name: "Telegram",
    },
    format: {
      id: "format-post",
      code: "post",
      display_name: "Пост",
    },
    bundle: {
      id: "bundle-rmj-may",
      name: "РМЖ май",
    },
    segments: [
      {
        id: "segment-survivors",
        name: "Пациенты после лечения",
      },
    ],
    segmentTargets: [
      {
        external_segment_id: "segment-survivors",
        role: "target",
      },
    ],
  });

  assert.equal(publishPackage.title, "Напоминание о вебинаре");
  assert.deepEqual(
    publishPackage.rows.map((row) => row.label),
    [
      "Канал",
      "Формат",
      "Кампания",
      "План",
      "Аудитории",
      "UTM-метки",
      "Текст",
      "Медиа",
    ],
  );
  assert.equal(publishPackage.bodyText, "Друзья, завтра встречаемся на вебинаре.");
  assert.deepEqual(publishPackage.mediaRefs, ["https://assets.example.com/banner.png"]);
  assert.match(publishPackage.copyText, /Канал: Telegram/);
  assert.match(publishPackage.copyText, /Формат: Пост/);
  assert.match(publishPackage.copyText, /Кампания: РМЖ май/);
  assert.match(publishPackage.copyText, /Аудитории: Целевая: Пациенты после лечения/);
  assert.match(publishPackage.copyText, /UTM:/);
  assert.match(publishPackage.copyText, /"utm_source": "telegram"/);
  assert.match(publishPackage.copyText, /Друзья, завтра встречаемся на вебинаре\./);
  assert.match(publishPackage.copyText, /https:\/\/assets\.example\.com\/banner\.png/);
});

test("publication variants build copy-ready channel adaptations", () => {
  const variants = buildContentFactoryPublicationVariants({
    publication: {
      id: "pub-1",
      title: "Вебинар по РМЖ",
      body_text: "Разберём подготовку к лечению и вопросы к врачу.",
      utm: {
        utm_source: "telegram",
        utm_medium: "post",
        utm_campaign: "rmj-webinar",
      },
    },
    platform: {
      id: "platform-telegram",
      code: "telegram",
      display_name: "Telegram",
    },
    format: {
      id: "format-post",
      code: "post",
      display_name: "Пост",
    },
    bundle: {
      id: "bundle-1",
      name: "РМЖ май",
    },
  });

  assert.equal(variants.sourceTitle, "Вебинар по РМЖ");
  assert.equal(variants.sourceBody, "Разберём подготовку к лечению и вопросы к врачу.");
  assert.deepEqual(
    variants.variants.map((variant) => [variant.key, variant.channelLabel]),
    [
      ["telegram", "Telegram"],
      ["vk", "VK"],
      ["email", "Email"],
      ["push", "Push"],
      ["max", "Max"],
      ["dzen", "Дзен"],
    ],
  );
  assert.match(variants.contextRows.map((row) => row.value).join(" "), /РМЖ май/);

  const email = variants.variants.find((variant) => variant.key === "email");
  assert.equal(email?.title, "Вебинар по РМЖ");
  assert.match(email?.body ?? "", /Тема:/);
  assert.match(email?.body ?? "", /Прехедер:/);
  assert.match(email?.copyText ?? "", /Канал: Email/);
  assert.match(email?.copyText ?? "", /UTM:/);
  assert.match(email?.copyText ?? "", /"utm_campaign": "rmj-webinar"/);

  const push = variants.variants.find((variant) => variant.key === "push");
  assert.equal(push?.lengthHint, "До 200 знаков");
  assert.match(push?.copyText ?? "", /Канал: Push/);
});

test("publication variants warn when source text is missing", () => {
  const variants = buildContentFactoryPublicationVariants({
    publication: {
      id: "pub-empty",
      title: "",
      body_text: "",
      utm: {},
    },
  });

  assert.equal(variants.sourceTitle, "Без названия");
  assert.equal(variants.sourceBody, "Текст публикации не заполнен");
  assert.ok(
    variants.variants.every((variant) =>
      variant.warnings.includes("Текст публикации не заполнен"),
    ),
  );
  assert.match(variants.variants[0]?.copyText ?? "", /Текст публикации не заполнен/);
  assert.doesNotMatch(variants.variants[0]?.copyText ?? "", /UTM:/);
});

test("publication variant coverage summarizes saved missing and stale channels", () => {
  const coverage = getContentFactoryPublicationVariantCoverage({
    publication: {
      version_number: 4,
    },
    savedVariants: [
      {
        channel: "telegram",
        body_text: "Telegram adaptation",
        source_version_number: 4,
      },
      {
        channel: "email",
        body_text: "Email adaptation",
        source_version_number: 2,
      },
      {
        channel: "vk",
        body_text: "   ",
        source_version_number: 4,
      },
    ],
  });

  assert.equal(coverage.totalChannels, 6);
  assert.equal(coverage.savedCount, 2);
  assert.equal(coverage.readyCount, 1);
  assert.equal(coverage.missingCount, 4);
  assert.equal(coverage.staleCount, 1);
  assert.deepEqual(
    coverage.savedChannels.map((channel) => channel.label),
    ["Telegram", "Email"],
  );
  assert.deepEqual(
    coverage.missingChannels.map((channel) => channel.label),
    ["VK", "Push", "Max", "Дзен"],
  );
  assert.deepEqual(
    coverage.staleChannels.map((channel) => channel.label),
    ["Email"],
  );
  assert.equal(
    coverage.nextAction,
    "Обновите адаптации после изменения публикации",
  );
});

test("publication variant coverage marks all current variants as ready", () => {
  const coverage = getContentFactoryPublicationVariantCoverage({
    publication: {
      version_number: 3,
    },
    savedVariants: [
      {
        channel: "telegram",
        body_text: "Telegram adaptation",
        source_version_number: 3,
      },
      {
        channel: "vk",
        body_text: "VK adaptation",
        source_version_number: 3,
      },
      {
        channel: "email",
        body_text: "Email adaptation",
        source_version_number: 3,
      },
      {
        channel: "push",
        body_text: "Push adaptation",
        source_version_number: 3,
      },
      {
        channel: "max",
        body_text: "Max adaptation",
        source_version_number: 3,
      },
      {
        channel: "dzen",
        body_text: "Dzen adaptation",
        source_version_number: 3,
      },
    ],
  });

  assert.equal(coverage.totalChannels, 6);
  assert.equal(coverage.savedCount, 6);
  assert.equal(coverage.readyCount, 6);
  assert.equal(coverage.missingCount, 0);
  assert.equal(coverage.staleCount, 0);
  assert.deepEqual(coverage.missingChannels, []);
  assert.deepEqual(coverage.staleChannels, []);
  assert.equal(coverage.nextAction, "Адаптации готовы");
});

test("publication variant coverage asks for the first adaptation when nothing is saved", () => {
  const coverage = getContentFactoryPublicationVariantCoverage({
    publication: {
      version_number: 1,
    },
    savedVariants: [],
  });

  assert.equal(coverage.savedCount, 0);
  assert.equal(coverage.readyCount, 0);
  assert.equal(coverage.missingCount, 6);
  assert.equal(coverage.staleCount, 0);
  assert.equal(coverage.nextAction, "Сохраните первую адаптацию");
});

test("publication variant handoff copies only ready saved adaptations", () => {
  const handoff = buildContentFactoryPublicationVariantHandoff({
    publication: {
      title: "Вебинар по РМЖ",
      version_number: 5,
      utm: {
        utm_source: "telegram",
        utm_medium: "post",
      },
    },
    savedVariants: [
      {
        channel: "email",
        title: "Email title",
        body_text: "Email body",
        notes: "Email note",
        source_version_number: 5,
      },
      {
        channel: "telegram",
        title: "Telegram title",
        body_text: "Telegram body",
        notes: null,
        source_version_number: 5,
      },
      {
        channel: "vk",
        title: "VK stale",
        body_text: "VK stale body",
        notes: null,
        source_version_number: 4,
      },
      {
        channel: "push",
        title: "Push blank",
        body_text: "   ",
        notes: null,
        source_version_number: 5,
      },
    ],
  });

  assert.equal(handoff.canCopy, true);
  assert.equal(handoff.readyCount, 2);
  assert.equal(handoff.totalChannels, 6);
  assert.deepEqual(handoff.readyChannelLabels, ["Telegram", "Email"]);
  assert.deepEqual(handoff.skippedChannelLabels, ["VK", "Push", "Max", "Дзен"]);
  assert.equal(handoff.nextAction, "Скопируйте готовые адаптации");
  assert.match(handoff.copyText, /Пакет адаптаций/);
  assert.match(handoff.copyText, /Публикация: Вебинар по РМЖ/);
  assert.match(handoff.copyText, /Версия источника: v5/);
  assert.match(handoff.copyText, /Готово: 2 из 6/);
  assert.match(handoff.copyText, /Не включено: VK, Push, Max, Дзен/);
  assert.ok(
    handoff.copyText.indexOf("Канал: Telegram") <
      handoff.copyText.indexOf("Канал: Email"),
  );
  assert.match(handoff.copyText, /Заголовок:\nTelegram title/);
  assert.match(handoff.copyText, /Текст:\nTelegram body/);
  assert.match(handoff.copyText, /Заметки:\nEmail note/);
  assert.match(handoff.copyText, /UTM:/);
  assert.match(handoff.copyText, /"utm_source": "telegram"/);
  assert.doesNotMatch(handoff.copyText, /VK stale body/);
  assert.doesNotMatch(handoff.copyText, /Push blank/);
});

test("publication variant handoff disables copy when no current variants are ready", () => {
  const handoff = buildContentFactoryPublicationVariantHandoff({
    publication: {
      title: "Без готовых адаптаций",
      version_number: 3,
      utm: {},
    },
    savedVariants: [
      {
        channel: "telegram",
        title: "Old Telegram",
        body_text: "Old body",
        notes: null,
        source_version_number: 2,
      },
      {
        channel: "email",
        title: "Blank email",
        body_text: "",
        notes: null,
        source_version_number: 3,
      },
    ],
  });

  assert.equal(handoff.canCopy, false);
  assert.equal(handoff.readyCount, 0);
  assert.deepEqual(handoff.readyChannelLabels, []);
  assert.deepEqual(
    handoff.skippedChannelLabels,
    ["Telegram", "VK", "Email", "Push", "Max", "Дзен"],
  );
  assert.equal(handoff.copyText, "");
  assert.equal(handoff.nextAction, "Сначала сохраните актуальную адаптацию");
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
  assert.deepEqual(
    groups.map((group) => [group.key, group.label]),
    [
      ["production", "Производство"],
      ["factcheck", "Фактчек"],
      ["doctor_review", "Проверка врача"],
      ["approval", "Готовы к расписанию"],
      ["scheduling", "В календаре"],
      ["failed", "Ошибки"],
    ],
  );
});

test("getContentFactoryReviewQueueItemSignal describes review next actions", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  const cases = [
    { id: "copy", status: "needs_copy", scheduled_at: null },
    { id: "design", status: "needs_design", scheduled_at: null },
    { id: "fact", status: "factcheck", scheduled_at: null },
    { id: "doctor", status: "doctor_review", scheduled_at: null },
    { id: "approved-missing-date", status: "approved", scheduled_at: null },
    {
      id: "scheduled-overdue",
      status: "scheduled",
      scheduled_at: "2026-05-14T10:00:00Z",
    },
    {
      id: "scheduled",
      status: "scheduled",
      scheduled_at: "2026-05-16T10:00:00Z",
    },
    { id: "failed", status: "failed", scheduled_at: null },
    { id: "cancelled", status: "cancelled", scheduled_at: null },
  ];

  assert.deepEqual(
    cases.map((publication) => {
      const signal = getContentFactoryReviewQueueItemSignal(publication, now);
      return [
        publication.id,
        signal.key,
        signal.label,
        signal.actionLabel,
        signal.urgent,
      ];
    }),
    [
      ["copy", "needs_copy", "Нужен текст", "Дописать текст", false],
      ["design", "needs_design", "Нужен дизайн", "Подготовить визуалы", false],
      ["fact", "factcheck", "Фактчек", "Проверить факты", false],
      ["doctor", "doctor_review", "Проверка врача", "Передать врачу", false],
      [
        "approved-missing-date",
        "needs_schedule",
        "Назначить дату",
        "Поставить в календарь",
        false,
      ],
      [
        "scheduled-overdue",
        "scheduled_overdue",
        "План просрочен",
        "Проверить выпуск",
        true,
      ],
      ["scheduled", "scheduled", "В календаре", "Проверить пакет", false],
      ["failed", "failed", "Ошибка публикации", "Разобрать ошибку", true],
      ["cancelled", "cancelled", "Отменено", "Открыть причину", false],
    ],
  );
});

test("summarizeContentFactoryReviewQueue counts triage buckets", () => {
  const summary = summarizeContentFactoryReviewQueue(
    [
      { status: "draft", scheduled_at: null },
      { status: "needs_copy", scheduled_at: null },
      { status: "factcheck", scheduled_at: null },
      { status: "doctor_review", scheduled_at: null },
      { status: "approved", scheduled_at: null },
      {
        status: "scheduled",
        scheduled_at: "2026-05-14T10:00:00Z",
      },
      { status: "failed", scheduled_at: null },
    ],
    new Date("2026-05-15T12:00:00Z"),
  );

  assert.deepEqual(summary, {
    total: 6,
    production: 1,
    medicalReview: 2,
    scheduling: 2,
    urgent: 2,
    needsAction: 6,
  });
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

test("buildContentFactoryEffectivenessRows joins publications to objectives metrics and target evidence", () => {
  assert.equal(typeof buildContentFactoryEffectivenessRows, "function");

  const rows = buildContentFactoryEffectivenessRows({
    now: new Date("2026-05-20T12:00:00Z"),
    freshnessDays: 8,
    publications: [
      {
        id: "pub-fresh",
        bundle_id: "bundle-1",
        platform_id: "platform-telegram",
        format_id: "format-registration",
        title: "Webinar registration reminder",
        status: "published",
        scheduled_at: "2026-05-14T10:00:00Z",
        actual_published_at: "2026-05-14T11:00:00Z",
        updated_at: "2026-05-14T11:15:00Z",
      },
      {
        id: "pub-stale",
        bundle_id: "bundle-2",
        platform_id: "platform-vk",
        format_id: "format-trust",
        title: "Patient story",
        status: "published",
        scheduled_at: "2026-05-01T10:00:00Z",
        actual_published_at: "2026-05-01T11:00:00Z",
        updated_at: "2026-05-01T11:15:00Z",
      },
    ],
    bundles: [
      { id: "bundle-1", name: "May webinar", status: "live" },
      { id: "bundle-2", name: "Trust series", status: "retrospective" },
    ],
    platforms: [
      {
        id: "platform-telegram",
        code: "telegram",
        display_name: "Telegram",
      },
      { id: "platform-vk", code: "vk", display_name: "VK" },
    ],
    formats: [
      {
        id: "format-registration",
        code: "button",
        display_name: "Кнопка",
        default_objective: "registration",
      },
      {
        id: "format-trust",
        code: "patient_story",
        display_name: "История пациента",
        default_objective: "trust",
      },
    ],
    segmentTargetsByPublicationId: {
      "pub-fresh": [
        {
          publication_id: "pub-fresh",
          external_segment_id: "segment-1",
          role: "target",
          expected_count: 100,
          actual_count_at_send: 88,
        },
      ],
    },
    metricsByPublicationId: {
      "pub-fresh": [
        {
          id: "metric-1",
          publication_id: "pub-fresh",
          window: "7d",
          metric_name: "registrations",
          metric_value: 42,
          metric_value_text: null,
          source: "manual",
          source_method: "GetCourse",
          confidence: "high",
          raw_payload: null,
          note: null,
          captured_by_id: null,
          captured_at: "2026-05-19T12:00:00Z",
        },
      ],
      "pub-stale": [
        {
          id: "metric-2",
          publication_id: "pub-stale",
          window: "24h",
          metric_name: "views",
          metric_value: 500,
          metric_value_text: null,
          source: "manual",
          source_method: "Telegram",
          confidence: "medium",
          raw_payload: null,
          note: null,
          captured_by_id: null,
          captured_at: "2026-05-02T12:00:00Z",
        },
      ],
    },
  });

  const fresh = rows.find((row) => row.publication.id === "pub-fresh");
  assert.ok(fresh);
  assert.equal(fresh.objective, "registration");
  assert.equal(fresh.bundle?.name, "May webinar");
  assert.equal(fresh.platform?.display_name, "Telegram");
  assert.equal(fresh.format?.display_name, "Кнопка");
  assert.equal(fresh.metricHealth, "fresh");
  assert.equal(fresh.metricCount, 1);
  assert.equal(fresh.latestMetric?.metric_name, "registrations");
  assert.equal(fresh.latestMetricAt, "2026-05-19T12:00:00Z");
  assert.equal(fresh.targetExpectedCount, 100);
  assert.equal(fresh.targetActualCountAtSend, 88);

  const stale = rows.find((row) => row.publication.id === "pub-stale");
  assert.ok(stale);
  assert.equal(stale.objective, "trust");
  assert.equal(stale.metricHealth, "stale");
});

test("summarizeContentFactoryEffectiveness counts evidence coverage and stale rows", () => {
  assert.equal(typeof summarizeContentFactoryEffectiveness, "function");

  const rows = buildContentFactoryEffectivenessRows({
    now: new Date("2026-05-20T12:00:00Z"),
    freshnessDays: 8,
    publications: [
      {
        id: "fresh",
        bundle_id: "bundle",
        platform_id: "telegram",
        format_id: "registration",
        title: "Fresh",
        status: "published",
        scheduled_at: null,
        actual_published_at: "2026-05-14T11:00:00Z",
      },
      {
        id: "missing",
        bundle_id: "bundle",
        platform_id: "telegram",
        format_id: "registration",
        title: "Missing",
        status: "scheduled",
        scheduled_at: "2026-05-21T11:00:00Z",
        actual_published_at: null,
      },
      {
        id: "stale",
        bundle_id: "bundle",
        platform_id: "vk",
        format_id: "trust",
        title: "Stale",
        status: "published",
        scheduled_at: null,
        actual_published_at: "2026-05-01T11:00:00Z",
      },
    ],
    bundles: [{ id: "bundle", name: "Bundle", status: "live" }],
    platforms: [
      { id: "telegram", code: "telegram", display_name: "Telegram" },
      { id: "vk", code: "vk", display_name: "VK" },
    ],
    formats: [
      {
        id: "registration",
        code: "button",
        display_name: "Кнопка",
        default_objective: "registration",
      },
      {
        id: "trust",
        code: "story",
        display_name: "История",
        default_objective: "trust",
      },
    ],
    segmentTargetsByPublicationId: {},
    metricsByPublicationId: {
      fresh: [
        {
          id: "metric-fresh",
          publication_id: "fresh",
          window: "7d",
          metric_name: "registrations",
          metric_value: 10,
          metric_value_text: null,
          source: "manual",
          source_method: null,
          confidence: "high",
          raw_payload: null,
          note: null,
          captured_by_id: null,
          captured_at: "2026-05-20T10:00:00Z",
        },
      ],
      stale: [
        {
          id: "metric-stale",
          publication_id: "stale",
          window: "24h",
          metric_name: "views",
          metric_value: 300,
          metric_value_text: null,
          source: "manual",
          source_method: null,
          confidence: "medium",
          raw_payload: null,
          note: null,
          captured_by_id: null,
          captured_at: "2026-05-02T10:00:00Z",
        },
      ],
    },
  });

  assert.deepEqual(summarizeContentFactoryEffectiveness(rows), {
    totalPublications: 3,
    publishedPublications: 2,
    rowsWithEvidence: 2,
    rowsWithoutEvidence: 1,
    freshEvidenceRows: 1,
    staleEvidenceRows: 1,
  });
});

test("filterContentFactoryEffectivenessRows combines search objective health and platform filters", () => {
  assert.equal(typeof filterContentFactoryEffectivenessRows, "function");

  const rows = buildContentFactoryEffectivenessRows({
    now: new Date("2026-05-20T12:00:00Z"),
    freshnessDays: 8,
    publications: [
      {
        id: "pub-registration",
        bundle_id: "bundle-webinar",
        platform_id: "telegram",
        format_id: "registration",
        title: "Webinar reminder",
        status: "published",
        scheduled_at: null,
        actual_published_at: "2026-05-14T11:00:00Z",
      },
      {
        id: "pub-trust",
        bundle_id: "bundle-story",
        platform_id: "vk",
        format_id: "trust",
        title: "Patient story",
        status: "published",
        scheduled_at: null,
        actual_published_at: "2026-05-14T11:00:00Z",
      },
    ],
    bundles: [
      { id: "bundle-webinar", name: "May webinar", status: "live" },
      { id: "bundle-story", name: "Story bundle", status: "production" },
    ],
    platforms: [
      { id: "telegram", code: "telegram", display_name: "Telegram" },
      { id: "vk", code: "vk", display_name: "VK" },
    ],
    formats: [
      {
        id: "registration",
        code: "button",
        display_name: "Кнопка",
        default_objective: "registration",
      },
      {
        id: "trust",
        code: "story",
        display_name: "История",
        default_objective: "trust",
      },
    ],
    segmentTargetsByPublicationId: {},
    metricsByPublicationId: {
      "pub-registration": [
        {
          id: "metric",
          publication_id: "pub-registration",
          window: "7d",
          metric_name: "registrations",
          metric_value: 20,
          metric_value_text: null,
          source: "manual",
          source_method: null,
          confidence: "high",
          raw_payload: null,
          note: null,
          captured_by_id: null,
          captured_at: "2026-05-20T10:00:00Z",
        },
      ],
    },
  });

  assert.deepEqual(
    filterContentFactoryEffectivenessRows(rows, {
      search: "webinar",
      objective: "registration",
      metricHealth: "fresh",
      platformId: "telegram",
    }).map((row) => row.publication.id),
    ["pub-registration"],
  );
  assert.deepEqual(
    filterContentFactoryEffectivenessRows(rows, {
      search: "",
      objective: "all",
      metricHealth: "missing",
      platformId: "all",
    }).map((row) => row.publication.id),
    ["pub-trust"],
  );
});

test("retro labels expose retrospective types", () => {
  assert.equal(CF_RETRO_TYPE_LABELS.weekly, "Еженедельная");
  assert.equal(CF_RETRO_TYPE_LABELS.monthly, "Ежемесячная");
  assert.equal(CF_RETRO_TYPE_LABELS.bundle, "По кампании");
  assert.equal(CF_RETRO_TYPE_LABELS.adhoc, "Разовая");
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
    "По кампании · 01 мая 2026 — 31 мая 2026",
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
