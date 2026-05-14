import type {
  CFBundleStatus,
  CFExternalSegment,
  CFProductStream,
  CFPublicationSegmentTarget,
  CFPublicationUpdateRequest,
  CFPublicationStatus,
  MemberRole,
} from "./types";

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
