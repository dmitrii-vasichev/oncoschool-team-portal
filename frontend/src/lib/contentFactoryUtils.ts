import type {
  CFBundle,
  CFBundleStatus,
  CFExternalSegment,
  CFMetricSnapshot,
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
  weekly: "Weekly",
  monthly: "Monthly",
  bundle: "Bundle",
  adhoc: "Ad-hoc",
};

export const CF_REFERENCE_TABLE_LABELS: Record<
  ContentFactoryReferenceTableKey,
  string
> = {
  platforms: "Platforms",
  formats: "Formats",
  rubrics: "Rubrics",
  nosologies: "Nosologies",
  funnel_templates: "Funnel templates",
};

export const CF_SEGMENT_SOURCE_LABELS: Record<CFSegmentSource, string> = {
  getcourse: "GetCourse",
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
  target: "Target",
  exclusion: "Exclusion",
  control: "Control",
  retargeting: "Retargeting",
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
  return `${count} ${count === 1 ? "bundle" : "bundles"}`;
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
