import type {
  CFBundle,
  CFBundleStatus,
  CFExternalSegment,
  CFFormat,
  CFGuestAnonymityLevel,
  CFGuestConsentStatus,
  CFGuestGiftStatus,
  CFGuestStoryRole,
  CFGuestStorySource,
  CFGuestStoryStatus,
  CFMetricSnapshot,
  CFPlatform,
  CFProductStream,
  CFPublicationSegmentTarget,
  CFPublicationUpdateRequest,
  CFPublicationStatus,
  CFRetroType,
  CFSegmentRole,
  CFSegmentSnapshot,
  CFSegmentSource,
  MemberRole,
} from "./types";

export type ContentFactoryReferenceTableKey =
  | "platforms"
  | "formats"
  | "rubrics"
  | "nosologies"
  | "funnel_templates";

export const CF_PRODUCT_STREAM_LABELS: Record<CFProductStream, string> = {
  onco_school: "ОнкоШкола",
  nko: "НКО",
  medtourism: "Медтуризм",
  alternative: "Альтернативные направления",
  patient_live: "Прямой эфир для пациентов",
  expert_live: "Прямой эфир для экспертов",
  seasonal: "Сезонное",
};

export const CF_BUNDLE_STATUS_LABELS: Record<CFBundleStatus, string> = {
  planning: "Планирование",
  production: "В производстве",
  live: "В эфире",
  retrospective: "Ретроспектива",
  archived: "Архив",
};

export const CF_PUBLICATION_STATUS_LABELS: Record<CFPublicationStatus, string> = {
  draft: "Черновик",
  needs_copy: "Нужен текст",
  needs_design: "Нужен дизайн",
  factcheck: "Фактчек",
  doctor_review: "Проверка врача",
  approved: "Одобрено",
  scheduled: "Запланировано",
  published: "Опубликовано",
  failed: "Ошибка",
  cancelled: "Отменено",
};

export const CF_RETRO_TYPE_LABELS: Record<CFRetroType, string> = {
  weekly: "Еженедельная",
  monthly: "Ежемесячная",
  bundle: "По кампании",
  adhoc: "Разовая",
};

export const CF_REFERENCE_TABLE_LABELS: Record<
  ContentFactoryReferenceTableKey,
  string
> = {
  platforms: "Площадки",
  formats: "Форматы",
  rubrics: "Рубрики",
  nosologies: "Нозологии",
  funnel_templates: "Шаблоны кампаний",
};

export const CF_SEGMENT_SOURCE_LABELS: Record<CFSegmentSource, string> = {
  getcourse: "GetCourse",
};

export const CF_GUEST_ROLE_LABELS: Record<CFGuestStoryRole, string> = {
  patient: "Пациент",
  relative: "Родственник",
  doctor: "Врач",
  volunteer: "Волонтёр",
  partner: "Партнёр",
  other: "Другое",
};

export const CF_GUEST_SOURCE_LABELS: Record<CFGuestStorySource, string> = {
  manual: "Вручную",
  open_call: "Открытый набор",
  referral: "Рекомендация",
  screening_form: "Анкета отбора",
  partner: "Партнёр",
  other: "Другое",
};

export const CF_GUEST_STATUS_LABELS: Record<CFGuestStoryStatus, string> = {
  sourced: "Найден кандидат",
  applied: "Заполнил заявку",
  editorial_screening: "Редакционный отбор",
  shortlisted: "В коротком списке",
  producer_call_scheduled: "Созвон назначен",
  producer_call_done: "Созвон проведён",
  medical_factcheck_needed: "Нужен фактчек",
  doctor_approved: "Врач одобрил",
  consent_sent: "Согласие отправлено",
  consent_signed: "Согласие подписано",
  scheduled: "Запланировано",
  prep_materials_sent: "Материалы отправлены",
  live_or_recorded: "Эфир или запись",
  post_production: "Постпродакшн",
  published: "Опубликовано",
  gift_sent: "Подарок отправлен",
  follow_up_done: "Follow-up завершён",
  maybe_later: "Возможно позже",
  rejected: "Не подходит",
  archived: "Архив",
};

export const CF_GUEST_CONSENT_STATUS_LABELS: Record<
  CFGuestConsentStatus,
  string
> = {
  not_started: "Не начинали",
  sent: "Отправлено",
  signed: "Подписано",
  declined: "Отказ",
  revoked: "Отозвано",
  expired: "Истекло",
};

export const CF_GUEST_ANONYMITY_LABELS: Record<CFGuestAnonymityLevel, string> = {
  full_name: "Полное имя",
  first_name: "Только имя",
  anonymous: "Анонимно",
  pseudonym: "Псевдоним",
};

export const CF_GUEST_GIFT_STATUS_LABELS: Record<CFGuestGiftStatus, string> = {
  not_required: "Не нужен",
  pending: "Нужно отправить",
  sent: "Отправлен",
  received: "Получен",
};

export const CF_BUNDLE_STATUSES: CFBundleStatus[] = [
  "planning",
  "production",
  "live",
  "retrospective",
  "archived",
];

export const CF_PUBLICATION_STATUSES: CFPublicationStatus[] = [
  "draft",
  "needs_copy",
  "needs_design",
  "factcheck",
  "doctor_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "cancelled",
];

export const CF_SEGMENT_ROLES: CFSegmentRole[] = [
  "target",
  "exclusion",
  "control",
  "retargeting",
];

export const CF_SEGMENT_ROLE_LABELS: Record<CFSegmentRole, string> = {
  target: "Целевая",
  exclusion: "Исключение",
  control: "Контрольная",
  retargeting: "Ретаргетинг",
};

type ContentFactoryAccessMember = {
  role: MemberRole | string;
  is_active?: boolean;
  has_content_factory_access?: boolean | null;
};

type BundleStatusLike = {
  status: CFBundleStatus | string;
};

type PublicationScheduleLike = {
  scheduled_at: string | null;
};

type PublicationStatusLike = PublicationScheduleLike & {
  id?: string;
  status: CFPublicationStatus | string;
  actual_published_at?: string | null;
};

type RetroPeriodLike = {
  period_start: string | null;
  period_end: string | null;
};

type RetroTitleLike = RetroPeriodLike & {
  retro_type: CFRetroType | string;
};

type RetroSectionsLike = {
  best_by_objective?: Record<string, unknown> | null;
  broken?: unknown[] | null;
  learnings?: Record<string, unknown> | null;
  decisions?: Record<string, unknown> | null;
  actions?: unknown[] | null;
};

export type ContentFactoryPublicationGroup<T> = {
  dateKey: string;
  label: string;
  publications: T[];
};

export type ContentFactoryDashboardSummary<TPublication> = {
  bundleStatusCounts: Record<CFBundleStatus, number>;
  publicationStatusCounts: Record<CFPublicationStatus, number>;
  upcomingPublications: TPublication[];
  overdueProductionItems: TPublication[];
  recentlyPublished: TPublication[];
};

export type ContentFactoryPublicationFilters = {
  bundle_id?: string | null;
  status?: string | null;
  platform_id?: string | null;
  format_id?: string | null;
  responsible_id?: string | null;
};

export type ContentFactoryUtmInput = {
  bundleId: string;
  publicationId: string;
  platformCode: string;
  formatCode: string;
  segmentId?: string | null;
  cta?: string | null;
};

export type ContentFactoryReviewQueueKey =
  | "production"
  | "factcheck"
  | "doctor_review"
  | "approval"
  | "scheduling"
  | "failed"
  | "cancelled";

export type ContentFactoryReviewQueueGroup<TPublication> = {
  key: ContentFactoryReviewQueueKey;
  label: string;
  publications: TPublication[];
};

export type ContentFactoryRetroSectionSummary = {
  bestByObjective: number;
  broken: number;
  learnings: number;
  decisions: number;
  actions: number;
};

export type ContentFactoryBundleFilterValues = {
  status: "all" | CFBundleStatus;
  product_stream: "" | CFProductStream;
  owner_id: string;
};

type MetricValueLike = {
  metric_value?: string | number | null;
  metric_value_text?: string | null;
};

type DisplayNameRecord = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
};

type ReferenceLabelRecord = {
  code?: string | null;
  display_name?: string | null;
  name?: string | null;
};

type ReferenceActivityRecord = {
  is_active?: boolean | null;
};

export type ContentFactorySegmentFilters = {
  search?: string | null;
  active?: "all" | "active" | "inactive";
  source?: "all" | string | null;
};

export type ContentFactoryGuestStorySummary = {
  total: number;
  active: number;
  consentSigned: number;
  followUpsDue: number;
  giftPending: number;
};

export type ContentFactoryGuestStoryFilters = {
  search?: string | null;
  status?: "all" | string | null;
  consentStatus?: "all" | string | null;
  ownerId?: "all" | string | null;
  bundleId?: "all" | string | null;
};

type GuestStoryStatusLike = {
  status: string;
  follow_up_due_at?: string | null;
};

type GuestStoryLike = GuestStoryStatusLike & {
  id?: string;
  display_name?: string | null;
  contact_ref?: string | null;
  role?: string | null;
  source?: string | null;
  source_notes?: string | null;
  story_brief?: string | null;
  owner_id?: string | null;
  bundle_id?: string | null;
  publication_id?: string | null;
  screening_notes?: string | null;
  medical_factcheck_notes?: string | null;
  rejection_reason?: string | null;
  consent_status?: string | null;
  allowed_channels?: string[] | null;
  anonymity_level?: string | null;
  sensitive_topics?: string[] | null;
  legal_notes?: string | null;
  gift_status?: string | null;
};

type SegmentLike = {
  id?: string;
  name?: string;
  source_segment_id?: string;
  source?: string;
  is_active: boolean;
  population_count?: number;
};

type SegmentSnapshotLike = Pick<
  CFSegmentSnapshot,
  "fetched_at" | "population_count"
> & {
  id?: string;
};

type SegmentUsageSegmentLike = SegmentLike & {
  id: string;
  name: string;
};

type SegmentUsagePublicationLike = {
  id: string;
  bundle_id: string;
  title?: string | null;
  status: CFPublicationStatus | string;
  scheduled_at?: string | null;
  actual_published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SegmentUsageBundleLike = Pick<CFBundle, "id" | "name" | "status">;

type SegmentUsageTargetLike = Pick<
  CFPublicationSegmentTarget,
  | "publication_id"
  | "external_segment_id"
  | "role"
  | "expected_count"
  | "actual_count_at_send"
>;

type SegmentUsageMetricLike = Pick<
  CFMetricSnapshot,
  "publication_id" | "captured_at"
> & {
  id?: string;
};

export type ContentFactoryEffectivenessMetricHealth =
  | "fresh"
  | "stale"
  | "missing";

type EffectivenessPublicationLike = {
  id: string;
  bundle_id: string;
  platform_id: string;
  format_id: string;
  title?: string | null;
  status: CFPublicationStatus | string;
  scheduled_at?: string | null;
  actual_published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type EffectivenessBundleLike = Pick<CFBundle, "id" | "name" | "status">;

type EffectivenessPlatformLike = Pick<
  CFPlatform,
  "id" | "code" | "display_name"
>;

type EffectivenessFormatLike = Pick<
  CFFormat,
  "id" | "code" | "display_name" | "default_objective"
>;

type EffectivenessTargetLike = Pick<
  CFPublicationSegmentTarget,
  "publication_id" | "expected_count" | "actual_count_at_send"
>;

type EffectivenessMetricLike = Pick<
  CFMetricSnapshot,
  | "publication_id"
  | "window"
  | "metric_name"
  | "metric_value"
  | "metric_value_text"
  | "confidence"
  | "captured_at"
> & {
  id?: string;
};

export type ContentFactoryEffectivenessInput<
  TPublication extends EffectivenessPublicationLike,
  TBundle extends EffectivenessBundleLike,
  TPlatform extends EffectivenessPlatformLike,
  TFormat extends EffectivenessFormatLike,
  TTarget extends EffectivenessTargetLike,
  TMetric extends EffectivenessMetricLike,
> = {
  now?: Date | string;
  freshnessDays?: number;
  publications: TPublication[];
  bundles: TBundle[];
  platforms: TPlatform[];
  formats: TFormat[];
  segmentTargetsByPublicationId: Record<string, TTarget[] | undefined>;
  metricsByPublicationId: Record<string, TMetric[] | undefined>;
};

export type ContentFactoryEffectivenessRow<
  TPublication extends EffectivenessPublicationLike = EffectivenessPublicationLike,
  TBundle extends EffectivenessBundleLike = EffectivenessBundleLike,
  TPlatform extends EffectivenessPlatformLike = EffectivenessPlatformLike,
  TFormat extends EffectivenessFormatLike = EffectivenessFormatLike,
  TTarget extends EffectivenessTargetLike = EffectivenessTargetLike,
  TMetric extends EffectivenessMetricLike = EffectivenessMetricLike,
> = {
  publication: TPublication;
  bundle: TBundle | null;
  platform: TPlatform | null;
  format: TFormat | null;
  objective: string;
  targets: TTarget[];
  metrics: TMetric[];
  metricCount: number;
  latestMetric: TMetric | null;
  latestMetricAt: string | null;
  metricHealth: ContentFactoryEffectivenessMetricHealth;
  targetExpectedCount: number;
  targetActualCountAtSend: number;
  latestActivityAt: string | null;
};

export type ContentFactoryEffectivenessSummary = {
  totalPublications: number;
  publishedPublications: number;
  rowsWithEvidence: number;
  rowsWithoutEvidence: number;
  freshEvidenceRows: number;
  staleEvidenceRows: number;
};

export type ContentFactoryEffectivenessFilters = {
  search?: string | null;
  objective?: "all" | string | null;
  metricHealth?: "all" | ContentFactoryEffectivenessMetricHealth | null;
  platformId?: "all" | string | null;
};

export type ContentFactorySegmentSummary = {
  total: number;
  active: number;
  inactive: number;
  population: number;
};

export type ContentFactorySegmentSnapshotComparison<TSnapshot> = {
  latest: TSnapshot | null;
  previous: TSnapshot | null;
  delta: number | null;
  deltaPercent: number | null;
};

export type ContentFactorySegmentUsageInput<
  TSegment extends SegmentUsageSegmentLike,
  TPublication extends SegmentUsagePublicationLike,
  TBundle extends SegmentUsageBundleLike,
  TTarget extends SegmentUsageTargetLike,
  TMetric extends SegmentUsageMetricLike,
> = {
  segments: TSegment[];
  publications: TPublication[];
  bundles: TBundle[];
  segmentTargetsByPublicationId: Record<string, TTarget[] | undefined>;
  metricsByPublicationId: Record<string, TMetric[] | undefined>;
};

export type ContentFactorySegmentUsagePublication<
  TPublication extends SegmentUsagePublicationLike,
  TBundle extends SegmentUsageBundleLike,
  TTarget extends SegmentUsageTargetLike,
  TMetric extends SegmentUsageMetricLike,
> = {
  publication: TPublication;
  bundle: TBundle | null;
  target: TTarget;
  metrics: TMetric[];
  metricCount: number;
  latestMetricAt: string | null;
  latestActivityAt: string | null;
};

export type ContentFactorySegmentUsageRow<
  TSegment extends SegmentUsageSegmentLike = SegmentUsageSegmentLike,
  TPublication extends SegmentUsagePublicationLike = SegmentUsagePublicationLike,
  TBundle extends SegmentUsageBundleLike = SegmentUsageBundleLike,
  TTarget extends SegmentUsageTargetLike = SegmentUsageTargetLike,
  TMetric extends SegmentUsageMetricLike = SegmentUsageMetricLike,
> = {
  segment: TSegment;
  publications: Array<
    ContentFactorySegmentUsagePublication<TPublication, TBundle, TTarget, TMetric>
  >;
  totalTargetLinks: number;
  publicationCount: number;
  bundleCount: number;
  roleCounts: Record<CFSegmentRole, number>;
  bundleStatusCounts: Record<CFBundleStatus, number>;
  publishedPublicationCount: number;
  metricEvidenceCount: number;
  expectedCount: number;
  actualCountAtSend: number;
  latestActivityAt: string | null;
};

export type ContentFactorySegmentUsageSummary = {
  totalSegments: number;
  segmentsInUse: number;
  unusedActiveSegments: number;
  totalTargetLinks: number;
  publishedPublications: number;
  metricEvidenceCount: number;
};

export type ContentFactorySegmentUsageFilters = {
  search?: string | null;
  usage?: "all" | "used" | "unused";
  role?: "all" | CFSegmentRole;
};

export function canAccessContentFactory(
  member: ContentFactoryAccessMember | null | undefined,
): boolean {
  if (!member || member.is_active === false) return false;
  return member.role === "admin" || member.has_content_factory_access === true;
}

export function isContentFactoryGuestStoryActive(
  story: GuestStoryStatusLike,
): boolean {
  return !["follow_up_done", "maybe_later", "rejected", "archived"].includes(
    story.status,
  );
}

export function isContentFactoryGuestFollowUpDue(
  story: GuestStoryStatusLike,
  now: Date | string = new Date(),
): boolean {
  if (!isContentFactoryGuestStoryActive(story)) return false;
  const dueTime = dateTime(story.follow_up_due_at);
  if (dueTime === null) return false;
  return dueTime <= dateInputTime(now);
}

export function summarizeContentFactoryGuestStories<TStory extends GuestStoryLike>(
  stories: TStory[],
  now: Date | string = new Date(),
): ContentFactoryGuestStorySummary {
  return {
    total: stories.length,
    active: stories.filter(isContentFactoryGuestStoryActive).length,
    consentSigned: stories.filter((story) => story.consent_status === "signed")
      .length,
    followUpsDue: stories.filter((story) =>
      isContentFactoryGuestFollowUpDue(story, now),
    ).length,
    giftPending: stories.filter((story) => story.gift_status === "pending")
      .length,
  };
}

export function filterContentFactoryGuestStories<TStory extends GuestStoryLike>(
  stories: TStory[],
  filters: ContentFactoryGuestStoryFilters,
): TStory[] {
  const search = filters.search?.trim().toLowerCase();
  return stories.filter((story) => {
    if (filters.status && filters.status !== "all" && story.status !== filters.status) {
      return false;
    }
    if (
      filters.consentStatus &&
      filters.consentStatus !== "all" &&
      story.consent_status !== filters.consentStatus
    ) {
      return false;
    }
    if (
      filters.ownerId &&
      filters.ownerId !== "all" &&
      story.owner_id !== filters.ownerId
    ) {
      return false;
    }
    if (
      filters.bundleId &&
      filters.bundleId !== "all" &&
      story.bundle_id !== filters.bundleId
    ) {
      return false;
    }
    if (!search) return true;

    const haystack = [
      story.id,
      story.display_name,
      story.contact_ref,
      story.role,
      story.source,
      story.source_notes,
      story.story_brief,
      story.status,
      story.screening_notes,
      story.medical_factcheck_notes,
      story.rejection_reason,
      story.consent_status,
      story.anonymity_level,
      story.legal_notes,
      ...(story.allowed_channels ?? []),
      ...(story.sensitive_topics ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

function dateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function dateKey(value: string | null | undefined): string | null {
  const time = dateTime(value);
  if (time === null) return null;
  return new Date(time).toISOString().slice(0, 10);
}

function dateLabel(key: string): string {
  if (key === "unscheduled") return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  }).format(new Date(`${key}T00:00:00Z`));
}

function isoFromTime(time: number | null): string | null {
  if (time === null) return null;
  const iso = new Date(time).toISOString();
  return iso.endsWith(".000Z") ? iso.replace(".000Z", "Z") : iso;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const latest = values.reduce<number | null>((max, value) => {
    const time = dateTime(value);
    if (time === null) return max;
    return max === null ? time : Math.max(max, time);
  }, null);
  return isoFromTime(latest);
}

function emptyStatusCounts<TStatus extends string>(
  statuses: TStatus[],
): Record<TStatus, number> {
  return Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
    TStatus,
    number
  >;
}

function dateInputTime(value: Date | string | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  return dateTime(value) ?? Date.now();
}

function sortMetricsByCapturedAt<TMetric extends EffectivenessMetricLike>(
  metrics: TMetric[],
): TMetric[] {
  return [...metrics].sort(
    (left, right) =>
      (dateTime(right.captured_at) ?? 0) - (dateTime(left.captured_at) ?? 0),
  );
}

function getMetricHealth<TMetric extends EffectivenessMetricLike>(
  metrics: TMetric[],
  nowTime: number,
  freshnessMs: number,
): ContentFactoryEffectivenessMetricHealth {
  if (metrics.length === 0) return "missing";
  const latestMetricTime = dateTime(metrics[0]?.captured_at);
  if (latestMetricTime === null) return "stale";
  return nowTime - latestMetricTime <= freshnessMs ? "fresh" : "stale";
}

export function buildContentFactoryEffectivenessRows<
  TPublication extends EffectivenessPublicationLike,
  TBundle extends EffectivenessBundleLike,
  TPlatform extends EffectivenessPlatformLike,
  TFormat extends EffectivenessFormatLike,
  TTarget extends EffectivenessTargetLike,
  TMetric extends EffectivenessMetricLike,
>({
  now,
  freshnessDays = 8,
  publications,
  bundles,
  platforms,
  formats,
  segmentTargetsByPublicationId,
  metricsByPublicationId,
}: ContentFactoryEffectivenessInput<
  TPublication,
  TBundle,
  TPlatform,
  TFormat,
  TTarget,
  TMetric
>): Array<
  ContentFactoryEffectivenessRow<
    TPublication,
    TBundle,
    TPlatform,
    TFormat,
    TTarget,
    TMetric
  >
> {
  const bundlesById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const platformsById = new Map(
    platforms.map((platform) => [platform.id, platform]),
  );
  const formatsById = new Map(formats.map((format) => [format.id, format]));
  const nowTime = dateInputTime(now);
  const freshnessMs = Math.max(freshnessDays, 0) * 24 * 60 * 60 * 1000;

  return publications
    .map((publication) => {
      const bundle = bundlesById.get(publication.bundle_id) ?? null;
      const platform = platformsById.get(publication.platform_id) ?? null;
      const format = formatsById.get(publication.format_id) ?? null;
      const targets = segmentTargetsByPublicationId[publication.id] ?? [];
      const metrics = sortMetricsByCapturedAt(
        metricsByPublicationId[publication.id] ?? [],
      );
      const latestMetric = metrics[0] ?? null;
      const latestMetricAt = latestMetric?.captured_at ?? null;
      const objective = format?.default_objective?.trim() || "unknown";

      return {
        publication,
        bundle,
        platform,
        format,
        objective,
        targets,
        metrics,
        metricCount: metrics.length,
        latestMetric,
        latestMetricAt,
        metricHealth: getMetricHealth(metrics, nowTime, freshnessMs),
        targetExpectedCount: targets.reduce(
          (total, target) => total + (target.expected_count ?? 0),
          0,
        ),
        targetActualCountAtSend: targets.reduce(
          (total, target) => total + (target.actual_count_at_send ?? 0),
          0,
        ),
        latestActivityAt:
          latestIso([latestMetricAt]) ??
          latestIso([
            publication.actual_published_at,
            publication.scheduled_at,
            publication.updated_at,
            publication.created_at,
          ]),
      };
    })
    .sort(
      (left, right) =>
        (dateTime(right.latestActivityAt) ?? 0) -
          (dateTime(left.latestActivityAt) ?? 0) ||
        (left.publication.title ?? left.publication.id).localeCompare(
          right.publication.title ?? right.publication.id,
          "ru",
        ),
    );
}

export function summarizeContentFactoryEffectiveness(
  rows: ContentFactoryEffectivenessRow[],
): ContentFactoryEffectivenessSummary {
  return {
    totalPublications: rows.length,
    publishedPublications: rows.filter(
      (row) => row.publication.status === "published",
    ).length,
    rowsWithEvidence: rows.filter((row) => row.metricCount > 0).length,
    rowsWithoutEvidence: rows.filter((row) => row.metricCount === 0).length,
    freshEvidenceRows: rows.filter((row) => row.metricHealth === "fresh").length,
    staleEvidenceRows: rows.filter((row) => row.metricHealth === "stale").length,
  };
}

export function filterContentFactoryEffectivenessRows<
  TRow extends ContentFactoryEffectivenessRow,
>(
  rows: TRow[],
  filters: ContentFactoryEffectivenessFilters,
): TRow[] {
  const search = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (
      filters.objective &&
      filters.objective !== "all" &&
      row.objective !== filters.objective
    ) {
      return false;
    }
    if (
      filters.metricHealth &&
      filters.metricHealth !== "all" &&
      row.metricHealth !== filters.metricHealth
    ) {
      return false;
    }
    if (
      filters.platformId &&
      filters.platformId !== "all" &&
      row.publication.platform_id !== filters.platformId
    ) {
      return false;
    }
    if (!search) return true;

    const haystack = [
      row.publication.id,
      row.publication.title,
      row.bundle?.name,
      row.platform?.display_name,
      row.platform?.code,
      row.format?.display_name,
      row.format?.code,
      row.objective,
      ...row.metrics.map((metric) => metric.metric_name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function groupPublicationsByDate<T extends PublicationScheduleLike>(
  publications: T[],
): ContentFactoryPublicationGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const publication of publications) {
    const key = dateKey(publication.scheduled_at) ?? "unscheduled";
    groups.set(key, [...(groups.get(key) ?? []), publication]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === "unscheduled") return 1;
      if (right === "unscheduled") return -1;
      return left.localeCompare(right);
    })
    .map(([key, items]) => ({
      dateKey: key,
      label: dateLabel(key),
      publications: [...items].sort(
        (a, b) => (dateTime(a.scheduled_at) ?? 0) - (dateTime(b.scheduled_at) ?? 0),
      ),
    }));
}

export function filterContentFactoryPublications<
  T extends ContentFactoryPublicationFilters,
>(
  publications: T[],
  filters: ContentFactoryPublicationFilters,
): T[] {
  return publications.filter((publication) =>
    matchesContentFactoryPublicationFilters(publication, filters),
  );
}

export function matchesContentFactoryPublicationFilters<
  T extends ContentFactoryPublicationFilters,
>(
  publication: T,
  filters: ContentFactoryPublicationFilters,
): boolean {
  if (filters.bundle_id && publication.bundle_id !== filters.bundle_id) return false;
  if (filters.status && publication.status !== filters.status) return false;
  if (filters.platform_id && publication.platform_id !== filters.platform_id) return false;
  if (filters.format_id && publication.format_id !== filters.format_id) return false;
  if (filters.responsible_id && publication.responsible_id !== filters.responsible_id) {
    return false;
  }
  return true;
}

export function buildContentFactoryBundleParams(
  filters: ContentFactoryBundleFilterValues,
): Record<string, string> {
  const params: Record<string, string> = { limit: "500" };
  if (filters.status !== "all") params.status = filters.status;
  if (filters.product_stream) params.product_stream = filters.product_stream;
  if (filters.owner_id) params.owner_id = filters.owner_id;
  return params;
}

export function formatContentFactoryBundleCount(count: number): string {
  return `${count} ${russianBundleNoun(count)}`;
}

function russianBundleNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "кампания";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "кампании";
  }
  return "кампаний";
}

function russianPublicationNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "публикация";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "публикации";
  }
  return "публикаций";
}

export function formatContentFactoryPublicationCount(count: number): string {
  return `${count} ${russianPublicationNoun(count)}`;
}

function formatRetroDate(value: string | null | undefined): string {
  if (!value) return "Без даты";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Без даты";
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return [day, month, year].filter(Boolean).join(" ");
}

export function formatContentFactoryRetroPeriod(retro: RetroPeriodLike): string {
  return `${formatRetroDate(retro.period_start)} — ${formatRetroDate(retro.period_end)}`;
}

export function getContentFactoryRetroTitle(retro: RetroTitleLike): string {
  const label =
    CF_RETRO_TYPE_LABELS[retro.retro_type as CFRetroType] ?? retro.retro_type;
  return `${label} · ${formatContentFactoryRetroPeriod(retro)}`;
}

function objectKeyCount(value: Record<string, unknown> | null | undefined): number {
  return value ? Object.keys(value).length : 0;
}

export function summarizeContentFactoryRetroSections(
  retro: RetroSectionsLike,
): ContentFactoryRetroSectionSummary {
  return {
    bestByObjective: objectKeyCount(retro.best_by_objective),
    broken: retro.broken?.length ?? 0,
    learnings: objectKeyCount(retro.learnings),
    decisions: objectKeyCount(retro.decisions),
    actions: retro.actions?.length ?? 0,
  };
}

export function getContentFactoryDisplayName(
  id: string | null | undefined,
  records: DisplayNameRecord[],
): string {
  if (!id) return "Не указано";
  const record = records.find((item) => item.id === id);
  return (
    record?.display_name ||
    record?.full_name ||
    record?.name ||
    id.slice(0, 9)
  );
}

export function getContentFactoryReferenceLabel(
  record: ReferenceLabelRecord,
): string {
  return (
    record.display_name?.trim() ||
    record.name?.trim() ||
    record.code?.trim() ||
    "Untitled"
  );
}

export function summarizeContentFactoryReferenceRecords<
  T extends ReferenceActivityRecord,
>(records: T[]): { total: number; active: number; inactive: number } {
  const active = records.filter((record) => record.is_active !== false).length;
  return {
    total: records.length,
    active,
    inactive: records.length - active,
  };
}

function cleanNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function cleanContentFactoryPublicationUpdate(
  payload: CFPublicationUpdateRequest,
): CFPublicationUpdateRequest {
  const cleaned: CFPublicationUpdateRequest = {
    ...payload,
    title: cleanNullableText(payload.title),
    body_text: cleanNullableText(payload.body_text),
    platform_post_url: cleanNullableText(payload.platform_post_url),
    platform_post_id: cleanNullableText(payload.platform_post_id),
    cancelled_reason: cleanNullableText(payload.cancelled_reason),
  };
  return Object.fromEntries(
    Object.entries(cleaned).filter(([, value]) => value !== undefined),
  ) as CFPublicationUpdateRequest;
}

function compactUtmValue(value: string): string {
  return value.trim().replace(/\s+/g, "-").toLowerCase();
}

export function buildContentFactoryUtm(input: ContentFactoryUtmInput): Record<string, string> {
  const utm: Record<string, string> = {
    utm_source: compactUtmValue(input.platformCode),
    utm_medium: compactUtmValue(input.formatCode),
    utm_campaign: compactUtmValue(input.bundleId),
    utm_content: compactUtmValue(input.publicationId),
  };
  if (input.segmentId?.trim()) {
    utm.utm_term = compactUtmValue(input.segmentId);
  }
  if (input.cta?.trim()) {
    utm.cf_cta = compactUtmValue(input.cta);
  }
  return utm;
}

export function formatContentFactoryMetricValue(metric: MetricValueLike): string {
  if (metric.metric_value_text?.trim()) return metric.metric_value_text.trim();
  if (metric.metric_value === null || metric.metric_value === undefined) return "—";
  const numericValue =
    typeof metric.metric_value === "number"
      ? metric.metric_value
      : Number(metric.metric_value);
  if (Number.isNaN(numericValue)) return String(metric.metric_value);
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 4,
  })
    .format(numericValue)
    .replace(/\u00a0/g, " ");
}

export function getAvailableContentFactorySegments<
  TSegment extends Pick<CFExternalSegment, "id" | "is_active">,
  TTarget extends Pick<CFPublicationSegmentTarget, "external_segment_id">,
>(segments: TSegment[], targets: TTarget[]): TSegment[] {
  const selectedSegmentIds = new Set(
    targets.map((target) => target.external_segment_id),
  );
  return segments.filter(
    (segment) => segment.is_active && !selectedSegmentIds.has(segment.id),
  );
}

export function formatContentFactorySegmentCount(count: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  })
    .format(count)
    .replace(/\u00a0/g, " ");
}

export function filterContentFactorySegments<TSegment extends SegmentLike>(
  segments: TSegment[],
  filters: ContentFactorySegmentFilters,
): TSegment[] {
  const search = filters.search?.trim().toLowerCase();
  return segments.filter((segment) => {
    if (filters.active === "active" && !segment.is_active) return false;
    if (filters.active === "inactive" && segment.is_active) return false;
    if (filters.source && filters.source !== "all" && segment.source !== filters.source) {
      return false;
    }
    if (search) {
      const haystack = [
        segment.name ?? "",
        segment.source_segment_id ?? "",
        segment.source ?? "",
        segment.id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function summarizeContentFactorySegments<TSegment extends SegmentLike>(
  segments: TSegment[],
): ContentFactorySegmentSummary {
  const active = segments.filter((segment) => segment.is_active).length;
  return {
    total: segments.length,
    active,
    inactive: segments.length - active,
    population: segments.reduce(
      (total, segment) => total + (segment.population_count ?? 0),
      0,
    ),
  };
}

export function compareContentFactorySegmentSnapshots<
  TSnapshot extends SegmentSnapshotLike,
>(
  snapshots: TSnapshot[],
): ContentFactorySegmentSnapshotComparison<TSnapshot> {
  const sorted = [...snapshots].sort(
    (left, right) =>
      (dateTime(right.fetched_at) ?? 0) - (dateTime(left.fetched_at) ?? 0),
  );
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  if (!latest || !previous) {
    return {
      latest,
      previous,
      delta: null,
      deltaPercent: null,
    };
  }
  const delta = latest.population_count - previous.population_count;
  return {
    latest,
    previous,
    delta,
    deltaPercent:
      previous.population_count === 0
        ? null
        : (delta / previous.population_count) * 100,
  };
}

export function buildContentFactorySegmentUsageRows<
  TSegment extends SegmentUsageSegmentLike,
  TPublication extends SegmentUsagePublicationLike,
  TBundle extends SegmentUsageBundleLike,
  TTarget extends SegmentUsageTargetLike,
  TMetric extends SegmentUsageMetricLike,
>({
  segments,
  publications,
  bundles,
  segmentTargetsByPublicationId,
  metricsByPublicationId,
}: ContentFactorySegmentUsageInput<
  TSegment,
  TPublication,
  TBundle,
  TTarget,
  TMetric
>): Array<ContentFactorySegmentUsageRow<TSegment, TPublication, TBundle, TTarget, TMetric>> {
  const bundlesById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const rowsBySegmentId = new Map<
    string,
    ContentFactorySegmentUsageRow<TSegment, TPublication, TBundle, TTarget, TMetric>
  >(
    segments.map((segment) => [
      segment.id,
      {
        segment,
        publications: [],
        totalTargetLinks: 0,
        publicationCount: 0,
        bundleCount: 0,
        roleCounts: emptyStatusCounts(CF_SEGMENT_ROLES),
        bundleStatusCounts: emptyStatusCounts(CF_BUNDLE_STATUSES),
        publishedPublicationCount: 0,
        metricEvidenceCount: 0,
        expectedCount: 0,
        actualCountAtSend: 0,
        latestActivityAt: null,
      },
    ]),
  );

  for (const publication of publications) {
    const targets = segmentTargetsByPublicationId[publication.id] ?? [];
    const metrics = metricsByPublicationId[publication.id] ?? [];
    const latestMetricAt = latestIso(metrics.map((metric) => metric.captured_at));
    const bundle = bundlesById.get(publication.bundle_id) ?? null;

    for (const target of targets) {
      const row = rowsBySegmentId.get(target.external_segment_id);
      if (!row) continue;

      const latestActivityAt = latestIso([
        latestMetricAt,
        publication.actual_published_at,
        publication.scheduled_at,
        publication.updated_at,
        publication.created_at,
      ]);

      row.publications.push({
        publication,
        bundle,
        target,
        metrics,
        metricCount: metrics.length,
        latestMetricAt,
        latestActivityAt,
      });
      row.totalTargetLinks += 1;
      if (CF_SEGMENT_ROLES.includes(target.role)) {
        row.roleCounts[target.role] += 1;
      }
      if (bundle && CF_BUNDLE_STATUSES.includes(bundle.status as CFBundleStatus)) {
        row.bundleStatusCounts[bundle.status as CFBundleStatus] += 1;
      }
      row.expectedCount += target.expected_count ?? 0;
      row.actualCountAtSend += target.actual_count_at_send ?? 0;
      row.metricEvidenceCount += metrics.length;
    }
  }

  for (const row of Array.from(rowsBySegmentId.values())) {
    const publicationIds = new Set(
      row.publications.map((item) => item.publication.id),
    );
    const bundleIds = new Set(
      row.publications
        .map((item) => item.bundle?.id ?? item.publication.bundle_id)
        .filter(Boolean),
    );
    row.publicationCount = publicationIds.size;
    row.bundleCount = bundleIds.size;
    row.publishedPublicationCount = new Set(
      row.publications
        .filter((item) => item.publication.status === "published")
        .map((item) => item.publication.id),
    ).size;
    row.latestActivityAt =
      latestIso(row.publications.map((item) => item.latestMetricAt)) ??
      latestIso(
        row.publications.map((item) => item.publication.actual_published_at),
      ) ??
      latestIso(row.publications.map((item) => item.publication.scheduled_at)) ??
      latestIso(row.publications.map((item) => item.publication.updated_at)) ??
      latestIso(row.publications.map((item) => item.publication.created_at));
    row.publications.sort(
      (left, right) =>
        (dateTime(right.latestActivityAt) ?? 0) -
        (dateTime(left.latestActivityAt) ?? 0),
    );
  }

  return Array.from(rowsBySegmentId.values()).sort((left, right) => {
    if (right.totalTargetLinks !== left.totalTargetLinks) {
      return right.totalTargetLinks - left.totalTargetLinks;
    }
    return left.segment.name.localeCompare(right.segment.name, "ru");
  });
}

export function summarizeContentFactorySegmentUsage(
  rows: ContentFactorySegmentUsageRow[],
): ContentFactorySegmentUsageSummary {
  const publishedPublicationIds = new Set<string>();

  for (const row of rows) {
    for (const item of row.publications) {
      if (item.publication.status === "published") {
        publishedPublicationIds.add(item.publication.id);
      }
    }
  }

  return {
    totalSegments: rows.length,
    segmentsInUse: rows.filter((row) => row.totalTargetLinks > 0).length,
    unusedActiveSegments: rows.filter(
      (row) => row.segment.is_active && row.totalTargetLinks === 0,
    ).length,
    totalTargetLinks: rows.reduce((total, row) => total + row.totalTargetLinks, 0),
    publishedPublications: publishedPublicationIds.size,
    metricEvidenceCount: rows.reduce(
      (total, row) => total + row.metricEvidenceCount,
      0,
    ),
  };
}

export function filterContentFactorySegmentUsageRows<
  TRow extends ContentFactorySegmentUsageRow,
>(
  rows: TRow[],
  filters: ContentFactorySegmentUsageFilters,
): TRow[] {
  const search = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.usage === "used" && row.totalTargetLinks === 0) return false;
    if (filters.usage === "unused" && row.totalTargetLinks > 0) return false;
    if (
      filters.role &&
      filters.role !== "all" &&
      row.roleCounts[filters.role] === 0
    ) {
      return false;
    }
    if (!search) return true;

    const haystack = [
      row.segment.name,
      row.segment.source_segment_id,
      row.segment.source,
      row.segment.id,
      ...row.publications.flatMap((item) => [
        item.publication.title ?? "",
        item.publication.id,
        item.bundle?.name ?? "",
      ]),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

const REVIEW_QUEUE_META: Array<{
  key: ContentFactoryReviewQueueKey;
  label: string;
  statuses: CFPublicationStatus[];
}> = [
  { key: "production", label: "Производство", statuses: ["needs_copy", "needs_design"] },
  { key: "factcheck", label: "Factcheck", statuses: ["factcheck"] },
  { key: "doctor_review", label: "Проверка врача", statuses: ["doctor_review"] },
  { key: "approval", label: "Approval", statuses: ["approved"] },
  { key: "scheduling", label: "Scheduling", statuses: ["scheduled"] },
  { key: "failed", label: "Failed", statuses: ["failed"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

export function getContentFactoryReviewQueueGroups<
  TPublication extends PublicationStatusLike,
>(publications: TPublication[]): ContentFactoryReviewQueueGroup<TPublication>[] {
  return REVIEW_QUEUE_META.map((queue) => ({
    key: queue.key,
    label: queue.label,
    publications: publications
      .filter((publication) =>
        queue.statuses.includes(publication.status as CFPublicationStatus),
      )
      .sort(
        (a, b) =>
          (dateTime(a.scheduled_at) ?? Number.MAX_SAFE_INTEGER) -
          (dateTime(b.scheduled_at) ?? Number.MAX_SAFE_INTEGER),
      ),
  })).filter((queue) => queue.publications.length > 0);
}

export function summarizeContentFactoryDashboard<
  TBundle extends BundleStatusLike,
  TPublication extends PublicationStatusLike,
>({
  now = new Date(),
  bundles,
  publications,
}: {
  now?: Date;
  bundles: TBundle[];
  publications: TPublication[];
}): ContentFactoryDashboardSummary<TPublication> {
  const bundleStatusCounts = emptyStatusCounts(CF_BUNDLE_STATUSES);
  const publicationStatusCounts = emptyStatusCounts(CF_PUBLICATION_STATUSES);
  const nowTime = now.getTime();

  for (const bundle of bundles) {
    if (bundle.status in bundleStatusCounts) {
      bundleStatusCounts[bundle.status as CFBundleStatus] += 1;
    }
  }

  for (const publication of publications) {
    if (publication.status in publicationStatusCounts) {
      publicationStatusCounts[publication.status as CFPublicationStatus] += 1;
    }
  }

  const openProductionStatuses = new Set([
    "draft",
    "needs_copy",
    "needs_design",
    "factcheck",
    "doctor_review",
    "approved",
    "scheduled",
    "failed",
  ]);

  const upcomingPublications = publications
    .filter((publication) => {
      const scheduledTime = dateTime(publication.scheduled_at);
      return (
        scheduledTime !== null &&
        scheduledTime >= nowTime &&
        publication.status !== "published" &&
        publication.status !== "cancelled" &&
        publication.status !== "failed"
      );
    })
    .sort(
      (a, b) => (dateTime(a.scheduled_at) ?? 0) - (dateTime(b.scheduled_at) ?? 0),
    )
    .slice(0, 8);

  const overdueProductionItems = publications
    .filter((publication) => {
      const scheduledTime = dateTime(publication.scheduled_at);
      return (
        scheduledTime !== null &&
        scheduledTime < nowTime &&
        openProductionStatuses.has(publication.status)
      );
    })
    .sort(
      (a, b) => (dateTime(a.scheduled_at) ?? 0) - (dateTime(b.scheduled_at) ?? 0),
    )
    .slice(0, 8);

  const recentlyPublished = publications
    .filter((publication) => publication.status === "published")
    .sort((a, b) => {
      const left = dateTime(a.actual_published_at) ?? dateTime(a.scheduled_at) ?? 0;
      const right = dateTime(b.actual_published_at) ?? dateTime(b.scheduled_at) ?? 0;
      return right - left;
    })
    .slice(0, 8);

  return {
    bundleStatusCounts,
    publicationStatusCounts,
    upcomingPublications,
    overdueProductionItems,
    recentlyPublished,
  };
}
