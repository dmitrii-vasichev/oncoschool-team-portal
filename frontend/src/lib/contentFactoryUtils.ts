import type {
  CFBundle,
  CFBundleStatus,
  CFExternalSegment,
  CFFormat,
  CFGuestAnonymityLevel,
  CFGuestConsentStatus,
  CFGuestGiftStatus,
  CFGuestStory,
  CFGuestStoryEvent,
  CFGuestStoryRole,
  CFGuestStorySource,
  CFGuestStoryStatus,
  CFConfidence,
  CFMetricSource,
  CFMetricSnapshot,
  CFMetricSnapshotCreateRequest,
  CFMetricWindow,
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

export const CF_METRIC_WINDOW_LABELS: Record<CFMetricWindow, string> = {
  "3h": "Через 3 часа",
  "24h": "Через 24 часа",
  "72h": "Через 72 часа",
  "7d": "Через 7 дней",
  final: "Финальный срез",
  custom: "Другое окно",
};

export const CF_METRIC_SOURCE_LABELS: Record<CFMetricSource, string> = {
  manual: "Вручную",
  api: "API",
  tgstat: "TGStat",
  telemetr: "Telemetr",
  vk_api: "VK API",
  email_provider: "Email-платформа",
  getcourse: "GetCourse",
  parser: "Парсер",
  import: "Импорт",
};

export const CF_CONFIDENCE_LABELS: Record<CFConfidence, string> = {
  high: "Высокое",
  medium: "Среднее",
  low: "Низкое",
};

export const CONTENT_FACTORY_METRIC_PRESETS = [
  "Просмотры",
  "Охват",
  "Клики",
  "Регистрации",
  "Заявки",
  "Переходы",
  "Реакции",
  "Комментарии",
  "Репосты",
];

export type ContentFactoryMetricImportPayload = Omit<
  CFMetricSnapshotCreateRequest,
  "publication_id" | "captured_by_id" | "raw_payload"
> & {
  window: CFMetricWindow;
  metric_name: string;
  metric_value: number | null;
  metric_value_text: string | null;
  source: CFMetricSource;
  source_method: string | null;
  confidence: CFConfidence;
  note: string | null;
};

export type ContentFactoryMetricImportRow = {
  lineNumber: number;
  raw: string;
  columns: string[];
  payload: ContentFactoryMetricImportPayload | null;
  error: string | null;
};

export type ContentFactoryMetricImportPreview = {
  rows: ContentFactoryMetricImportRow[];
  validRows: ContentFactoryMetricImportRow[];
  invalidRows: ContentFactoryMetricImportRow[];
};

type PublicationMetricInsightLike = Pick<
  CFMetricSnapshot,
  | "window"
  | "metric_name"
  | "metric_value"
  | "metric_value_text"
  | "source"
  | "confidence"
  | "captured_at"
> & {
  id?: string;
};

export type ContentFactoryPublicationMetricWindowCoverage<
  TMetric extends PublicationMetricInsightLike = PublicationMetricInsightLike,
> = {
  window: CFMetricWindow;
  label: string;
  covered: boolean;
  metricCount: number;
  latestMetric: TMetric | null;
};

export type ContentFactoryPublicationMetricInsightGroup<
  TMetric extends PublicationMetricInsightLike = PublicationMetricInsightLike,
> = {
  metricName: string;
  count: number;
  latestMetric: TMetric;
  latestValueLabel: string;
  latestCapturedAt: string | null;
  bestNumericMetric: TMetric | null;
  bestNumericValueLabel: string | null;
  coveredWindows: CFMetricWindow[];
};

export type ContentFactoryPublicationMetricInsights<
  TMetric extends PublicationMetricInsightLike = PublicationMetricInsightLike,
> = {
  totalMetrics: number;
  uniqueMetricNames: number;
  latestMetric: TMetric | null;
  latestMetricLabel: string;
  nextAction: string;
  groups: Array<ContentFactoryPublicationMetricInsightGroup<TMetric>>;
  windows: Array<ContentFactoryPublicationMetricWindowCoverage<TMetric>>;
  missingWindows: CFMetricWindow[];
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

type CalendarPublicationLike = PublicationStatusLike & {
  body_text?: string | null;
  utm?: Record<string, unknown> | null;
  platform_post_url?: string | null;
  platform_post_id?: string | null;
};

export type ContentFactoryCalendarPublicationStateKey =
  | "published_needs_fact"
  | "published"
  | "inactive"
  | "unscheduled"
  | "overdue"
  | "today"
  | "needs_text"
  | "needs_utm"
  | "ready"
  | "preparing";

export type ContentFactoryCalendarPublicationStateTone =
  | "critical"
  | "warning"
  | "success"
  | "info"
  | "muted";

export type ContentFactoryCalendarPublicationState = {
  key: ContentFactoryCalendarPublicationStateKey;
  label: string;
  description: string;
  actionLabel: string;
  tone: ContentFactoryCalendarPublicationStateTone;
  needsAction: boolean;
  readyToPublish: boolean;
};

export type ContentFactoryCalendarSummary = {
  total: number;
  today: number;
  overdue: number;
  readyToPublish: number;
  needsAction: number;
  unscheduled: number;
};

type PublicationIndexLike = ContentFactoryPublicationFilters & {
  id: string;
  title?: string | null;
  body_text?: string | null;
  status: CFPublicationStatus | string;
  scheduled_at?: string | null;
  actual_published_at?: string | null;
  platform_post_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ContentFactoryPublicationIndexLookup = {
  bundleNames?: Map<string, string>;
  platformNames?: Map<string, string>;
  formatNames?: Map<string, string>;
  responsibleNames?: Map<string, string>;
};

export type ContentFactoryPublicationIndexSummary = {
  total: number;
  inProduction: number;
  scheduled: number;
  published: number;
  publishedWithoutPostUrl: number;
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

export type ContentFactoryReviewQueueSignalTone =
  | "warning"
  | "info"
  | "success"
  | "critical"
  | "muted";

export type ContentFactoryReviewQueueSignalKey =
  | "needs_copy"
  | "needs_design"
  | "factcheck"
  | "doctor_review"
  | "needs_schedule"
  | "approved"
  | "scheduled_overdue"
  | "scheduled"
  | "failed"
  | "cancelled"
  | "open";

export type ContentFactoryReviewQueueItemSignal = {
  key: ContentFactoryReviewQueueSignalKey;
  label: string;
  actionLabel: string;
  description: string;
  tone: ContentFactoryReviewQueueSignalTone;
  urgent: boolean;
  needsAction: boolean;
};

export type ContentFactoryReviewQueueSummary = {
  total: number;
  production: number;
  medicalReview: number;
  scheduling: number;
  urgent: number;
  needsAction: number;
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
  attentionNeeded: number;
};

export type ContentFactoryGuestStoryFilters = {
  search?: string | null;
  status?: "all" | string | null;
  consentStatus?: "all" | string | null;
  ownerId?: "all" | string | null;
  bundleId?: "all" | string | null;
  attention?: "all" | "needs_attention" | string | null;
};

export type ContentFactoryGuestStageTimelineItem = {
  id: string;
  eventId: string | null;
  status: CFGuestStoryStatus;
  label: string;
  startedAt: string;
  endedAt: string | null;
  durationDays: number;
  durationLabel: string;
  isCurrent: boolean;
};

export type ContentFactoryGuestStageTimeline = {
  items: ContentFactoryGuestStageTimelineItem[];
  currentItem: ContentFactoryGuestStageTimelineItem;
  currentDurationLabel: string;
  nextStepAt: string | null;
  missingNextStep: boolean;
};

type GuestStoryStatusLike = {
  status: string;
  stage_due_at?: string | null;
  follow_up_due_at?: string | null;
  consent_status?: string | null;
  gift_status?: string | null;
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

export type ContentFactoryGuestAttentionReasonKey =
  | "stage_due"
  | "consent_missing"
  | "follow_up_due"
  | "gift_pending"
  | "stage_missing";

export type ContentFactoryGuestAttentionReason = {
  key: ContentFactoryGuestAttentionReasonKey;
  label: string;
  priority: number;
  dueAt: string | null;
};

export type ContentFactoryGuestAttention = {
  needsAttention: boolean;
  reasons: ContentFactoryGuestAttentionReason[];
  nextAction: string;
  priority: number;
  dueAt: string | null;
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

type PlatformCapabilitiesLike = {
  capabilities?: Record<string, unknown> | null;
} | null | undefined;

type PublicationOperationsPublicationLike = {
  status: CFPublicationStatus | string;
  scheduled_at: string | null;
  actual_published_at?: string | null;
  platform_post_url?: string | null;
  platform_post_id?: string | null;
};

type PublicationOperationsMetricLike = {
  id?: string;
  captured_at?: string | null;
};

export type ContentFactoryPlatformCapabilities = {
  canPublishManually: boolean;
  canPublishViaApi: boolean;
  canCollectMetricsManually: boolean;
  canCollectMetricsViaApi: boolean;
  canStorePostUrl: boolean;
  publicationModeLabel: string;
  metricsModeLabel: string;
};

export type ContentFactoryPublicationOperationsSummary = {
  capabilities: ContentFactoryPlatformCapabilities;
  publishFactLabel: string;
  canSavePublishFact: boolean;
  publishFactDisabledReason: string | null;
  missingPublishedAt: boolean;
  missingPostUrl: boolean;
  hasPostReference: boolean;
  needsMetricEvidence: boolean;
  metricEvidenceCount: number;
  metricEvidenceLabel: string;
};

export type ContentFactoryPublicationWorkflowActionTone =
  | "primary"
  | "default"
  | "warning"
  | "danger"
  | "muted";

export type ContentFactoryPublicationWorkflowAction = {
  key: string;
  targetStatus: CFPublicationStatus;
  label: string;
  description: string;
  tone: ContentFactoryPublicationWorkflowActionTone;
  disabled: boolean;
  disabledReason: string | null;
};

export type ContentFactoryPublicationReadinessStatus =
  | "ready"
  | "missing"
  | "after_publish";

export type ContentFactoryPublicationReadinessKey =
  | "body"
  | "schedule"
  | "utm"
  | "audience"
  | "publish_fact"
  | "metrics";

export type ContentFactoryPublicationReadinessItem = {
  key: ContentFactoryPublicationReadinessKey;
  label: string;
  status: ContentFactoryPublicationReadinessStatus;
  statusLabel: string;
  description: string;
};

type PublicationReadinessPublicationLike =
  PublicationOperationsPublicationLike & {
    body_text?: string | null;
    utm?: Record<string, unknown> | null;
  };

type PublicationWorkflowPublicationLike = {
  status: CFPublicationStatus | string;
  scheduled_at?: string | null;
};

type PublicationReadinessSegmentTargetLike = {
  external_segment_id?: string | null;
};

type PublishPackagePublicationLike = {
  id: string;
  title?: string | null;
  body_text?: string | null;
  media_refs?: unknown[] | null;
  scheduled_at?: string | null;
  utm?: Record<string, unknown> | null;
};

type PublishPackageReferenceLike = {
  id?: string;
  code?: string | null;
  display_name?: string | null;
  name?: string | null;
} | null | undefined;

type PublishPackageSegmentLike = {
  id: string;
  name?: string | null;
  display_name?: string | null;
  source_segment_id?: string | null;
};

type PublishPackageSegmentTargetLike = {
  external_segment_id?: string | null;
  role?: CFSegmentRole | string | null;
};

export type ContentFactoryPublishPackageRow = {
  label: string;
  value: string;
};

export type ContentFactoryPublishPackage = {
  title: string;
  rows: ContentFactoryPublishPackageRow[];
  bodyText: string;
  mediaRefs: string[];
  mediaText: string;
  utmText: string;
  audienceText: string;
  copyText: string;
};

export type ContentFactoryPublishPackageInput = {
  publication: PublishPackagePublicationLike;
  platform?: PublishPackageReferenceLike;
  format?: PublishPackageReferenceLike;
  bundle?: PublishPackageReferenceLike;
  segments?: PublishPackageSegmentLike[];
  segmentTargets?: PublishPackageSegmentTargetLike[];
};

export type ContentFactoryPublicationVariantKey =
  | "telegram"
  | "vk"
  | "email"
  | "push"
  | "max"
  | "dzen";

export const CONTENT_FACTORY_PUBLICATION_VARIANT_CHANNELS: Array<{
  key: ContentFactoryPublicationVariantKey;
  label: string;
}> = [
  { key: "telegram", label: "Telegram" },
  { key: "vk", label: "VK" },
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
  { key: "max", label: "Max" },
  { key: "dzen", label: "Дзен" },
];

type PublicationVariantPublicationLike = {
  id: string;
  title?: string | null;
  body_text?: string | null;
  utm?: Record<string, unknown> | null;
};

export type ContentFactoryPublicationVariant = {
  key: ContentFactoryPublicationVariantKey;
  channelLabel: string;
  useCase: string;
  title: string;
  body: string;
  lengthHint: string;
  warnings: string[];
  copyText: string;
};

export type ContentFactoryPublicationVariants = {
  sourceTitle: string;
  sourceBody: string;
  contextRows: ContentFactoryPublishPackageRow[];
  variants: ContentFactoryPublicationVariant[];
};

export type ContentFactoryPublicationVariantsInput = {
  publication: PublicationVariantPublicationLike;
  platform?: PublishPackageReferenceLike;
  format?: PublishPackageReferenceLike;
  bundle?: PublishPackageReferenceLike;
};

type PublicationVariantCoveragePublicationLike = {
  version_number?: number | null;
};

type PublicationVariantCoverageSavedVariantLike = {
  channel: ContentFactoryPublicationVariantKey | string;
  body_text?: string | null;
  source_version_number?: number | null;
};

export type ContentFactoryPublicationVariantCoverageChannel = {
  key: ContentFactoryPublicationVariantKey;
  label: string;
  saved: boolean;
  stale: boolean;
  sourceVersionNumber: number | null;
};

export type ContentFactoryPublicationVariantCoverage = {
  totalChannels: number;
  savedCount: number;
  readyCount: number;
  missingCount: number;
  staleCount: number;
  savedChannels: ContentFactoryPublicationVariantCoverageChannel[];
  readyChannels: ContentFactoryPublicationVariantCoverageChannel[];
  missingChannels: ContentFactoryPublicationVariantCoverageChannel[];
  staleChannels: ContentFactoryPublicationVariantCoverageChannel[];
  channels: ContentFactoryPublicationVariantCoverageChannel[];
  nextAction: string;
};

export type ContentFactoryPublicationVariantCoverageInput = {
  publication: PublicationVariantCoveragePublicationLike;
  savedVariants?: PublicationVariantCoverageSavedVariantLike[] | null;
};

type PublicationVariantHandoffPublicationLike =
  PublicationVariantCoveragePublicationLike & {
    title?: string | null;
    utm?: Record<string, unknown> | null;
  };

type PublicationVariantHandoffSavedVariantLike =
  PublicationVariantCoverageSavedVariantLike & {
    title?: string | null;
    notes?: string | null;
  };

export type ContentFactoryPublicationVariantHandoff = {
  canCopy: boolean;
  readyCount: number;
  totalChannels: number;
  readyChannelLabels: string[];
  skippedChannelLabels: string[];
  nextAction: string;
  copyText: string;
};

export type ContentFactoryPublicationVariantHandoffInput = {
  publication: PublicationVariantHandoffPublicationLike;
  savedVariants?: PublicationVariantHandoffSavedVariantLike[] | null;
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

const CONSENT_REQUIRED_GUEST_STATUSES = new Set([
  "consent_sent",
  "consent_signed",
  "scheduled",
  "prep_materials_sent",
  "live_or_recorded",
  "post_production",
  "published",
  "gift_sent",
]);

const FOLLOW_UP_READY_GUEST_STATUSES = new Set(["published", "gift_sent"]);

const GUEST_ATTENTION_REASON_DETAILS: Record<
  ContentFactoryGuestAttentionReasonKey,
  { label: string; nextAction: string; priority: number }
> = {
  stage_due: {
    label: "Просрочен следующий шаг",
    nextAction: "Связаться и закрыть просроченный следующий шаг",
    priority: 100,
  },
  consent_missing: {
    label: "Нужно закрыть согласие",
    nextAction: "Довести согласие до подписания",
    priority: 80,
  },
  follow_up_due: {
    label: "Нужен follow-up",
    nextAction: "Провести follow-up с гостем",
    priority: 90,
  },
  gift_pending: {
    label: "Нужно отправить подарок",
    nextAction: "Отправить или подтвердить подарок",
    priority: 70,
  },
  stage_missing: {
    label: "Не назначен следующий шаг",
    nextAction: "Назначить следующий шаг и срок",
    priority: 40,
  },
};

function guestAttentionReason(
  key: ContentFactoryGuestAttentionReasonKey,
  dueAt: string | null = null,
): ContentFactoryGuestAttentionReason {
  const details = GUEST_ATTENTION_REASON_DETAILS[key];
  return {
    key,
    label: details.label,
    priority: details.priority,
    dueAt,
  };
}

export function getContentFactoryGuestAttention(
  story: GuestStoryStatusLike,
  now: Date | string = new Date(),
): ContentFactoryGuestAttention {
  if (!isContentFactoryGuestStoryActive(story)) {
    return {
      needsAttention: false,
      reasons: [],
      nextAction: "Сейчас без срочных действий",
      priority: 0,
      dueAt: null,
    };
  }

  const nowTime = dateInputTime(now);
  const reasons: ContentFactoryGuestAttentionReason[] = [];
  const stageDueTime = dateTime(story.stage_due_at);
  const followUpDueTime = dateTime(story.follow_up_due_at);

  if (stageDueTime !== null && stageDueTime <= nowTime) {
    reasons.push(guestAttentionReason("stage_due", story.stage_due_at ?? null));
  }

  if (
    CONSENT_REQUIRED_GUEST_STATUSES.has(story.status) &&
    story.consent_status !== "signed"
  ) {
    reasons.push(guestAttentionReason("consent_missing"));
  }

  if (
    FOLLOW_UP_READY_GUEST_STATUSES.has(story.status) &&
    followUpDueTime !== null &&
    followUpDueTime <= nowTime
  ) {
    reasons.push(
      guestAttentionReason("follow_up_due", story.follow_up_due_at ?? null),
    );
  }

  if (story.gift_status === "pending") {
    reasons.push(guestAttentionReason("gift_pending"));
  }

  if (stageDueTime === null) {
    reasons.push(guestAttentionReason("stage_missing"));
  }

  const sortedReasons = [...reasons].sort(
    (left, right) =>
      right.priority - left.priority ||
      (dateTime(left.dueAt) ?? Number.MAX_SAFE_INTEGER) -
        (dateTime(right.dueAt) ?? Number.MAX_SAFE_INTEGER),
  );
  const primaryReason = sortedReasons[0] ?? null;

  return {
    needsAttention: sortedReasons.length > 0,
    reasons: sortedReasons,
    nextAction: primaryReason
      ? GUEST_ATTENTION_REASON_DETAILS[primaryReason.key].nextAction
      : "Сейчас без срочных действий",
    priority: primaryReason?.priority ?? 0,
    dueAt: primaryReason?.dueAt ?? null,
  };
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
    attentionNeeded: stories.filter(
      (story) => getContentFactoryGuestAttention(story, now).needsAttention,
    ).length,
  };
}

export function filterContentFactoryGuestStories<TStory extends GuestStoryLike>(
  stories: TStory[],
  filters: ContentFactoryGuestStoryFilters,
  now: Date | string = new Date(),
): TStory[] {
  const search = filters.search?.trim().toLowerCase();
  return stories.filter((story) => {
    if (
      filters.attention === "needs_attention" &&
      !getContentFactoryGuestAttention(story, now).needsAttention
    ) {
      return false;
    }
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

export function sortContentFactoryGuestStoriesByAttention<
  TStory extends GuestStoryLike,
>(stories: TStory[], now: Date | string = new Date()): TStory[] {
  return [...stories].sort((left, right) => {
    const leftAttention = getContentFactoryGuestAttention(left, now);
    const rightAttention = getContentFactoryGuestAttention(right, now);
    return (
      Number(rightAttention.needsAttention) - Number(leftAttention.needsAttention) ||
      rightAttention.priority - leftAttention.priority ||
      (dateTime(leftAttention.dueAt) ?? Number.MAX_SAFE_INTEGER) -
        (dateTime(rightAttention.dueAt) ?? Number.MAX_SAFE_INTEGER) ||
      (dateTime(left.stage_due_at) ?? Number.MAX_SAFE_INTEGER) -
        (dateTime(right.stage_due_at) ?? Number.MAX_SAFE_INTEGER) ||
      (left.display_name ?? left.id ?? "").localeCompare(
        right.display_name ?? right.id ?? "",
        "ru",
      )
    );
  });
}

type GuestStageTimelineStoryLike = Pick<
  CFGuestStory,
  "id" | "status" | "stage_due_at" | "created_at"
>;

type GuestStageTimelineEventLike = Pick<
  CFGuestStoryEvent,
  "id" | "event_type" | "old_value" | "new_value" | "created_at"
>;

function isContentFactoryGuestStatus(
  value: string | null | undefined,
): value is CFGuestStoryStatus {
  return Boolean(value && value in CF_GUEST_STATUS_LABELS);
}

function russianDayNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "день";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "дня";
  }
  return "дней";
}

function formatGuestStageDuration(startTime: number, endTime: number): {
  days: number;
  label: string;
} {
  const diffMs = Math.max(0, endTime - startTime);
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return { days, label: "меньше 1 дня" };
  return { days, label: `${days} ${russianDayNoun(days)}` };
}

function guestStageTimelineItem({
  status,
  startedAt,
  endedAt,
  nowTime,
  eventId,
  isCurrent,
}: {
  status: CFGuestStoryStatus;
  startedAt: string;
  endedAt: string | null;
  nowTime: number;
  eventId: string | null;
  isCurrent: boolean;
}): ContentFactoryGuestStageTimelineItem {
  const startTime = dateTime(startedAt) ?? nowTime;
  const endTime = dateTime(endedAt) ?? nowTime;
  const duration = formatGuestStageDuration(startTime, endTime);
  return {
    id: `${status}-${startedAt}-${eventId ?? "initial"}`,
    eventId,
    status,
    label: CF_GUEST_STATUS_LABELS[status],
    startedAt,
    endedAt,
    durationDays: duration.days,
    durationLabel: duration.label,
    isCurrent,
  };
}

export function buildContentFactoryGuestStageTimeline(
  story: GuestStageTimelineStoryLike,
  events: GuestStageTimelineEventLike[],
  now: Date | string = new Date(),
): ContentFactoryGuestStageTimeline {
  const nowTime = dateInputTime(now);
  const sortedEvents = [...events].sort(
    (left, right) =>
      (dateTime(left.created_at) ?? 0) - (dateTime(right.created_at) ?? 0) ||
      left.id.localeCompare(right.id),
  );
  const createdEvent = sortedEvents.find(
    (event) => event.event_type === "created" && dateTime(event.created_at) !== null,
  );
  const statusEvents = sortedEvents.filter(
    (event) =>
      event.event_type === "status_changed" &&
      isContentFactoryGuestStatus(event.new_value) &&
      dateTime(event.created_at) !== null,
  );
  const firstStatusEvent = statusEvents[0] ?? null;
  const initialStatus =
    (isContentFactoryGuestStatus(createdEvent?.new_value) && createdEvent?.new_value) ||
    (isContentFactoryGuestStatus(firstStatusEvent?.old_value) &&
      firstStatusEvent?.old_value) ||
    story.status;
  const initialStartedAt =
    createdEvent?.created_at ||
    (dateTime(story.created_at) !== null
      ? story.created_at
      : new Date(nowTime).toISOString());
  const draftItems: Array<{
    status: CFGuestStoryStatus;
    startedAt: string;
    endedAt: string | null;
    eventId: string | null;
  }> = [
    {
      status: initialStatus,
      startedAt: initialStartedAt,
      endedAt: null,
      eventId: createdEvent?.id ?? null,
    },
  ];

  statusEvents.forEach((event) => {
    const nextStatus = event.new_value;
    if (!isContentFactoryGuestStatus(nextStatus)) return;
    const previous = draftItems[draftItems.length - 1];
    if (!previous || previous.status === nextStatus) return;
    previous.endedAt = event.created_at;
    draftItems.push({
      status: nextStatus,
      startedAt: event.created_at,
      endedAt: null,
      eventId: event.id,
    });
  });

  const items = draftItems.map((item, index) =>
    guestStageTimelineItem({
      ...item,
      nowTime,
      isCurrent: index === draftItems.length - 1,
    }),
  );
  const currentItem = items[items.length - 1];

  return {
    items,
    currentItem,
    currentDurationLabel: currentItem.durationLabel,
    nextStepAt: story.stage_due_at ?? null,
    missingNextStep:
      isContentFactoryGuestStoryActive(story) && dateTime(story.stage_due_at) === null,
  };
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

function normalizeCapabilityKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asCapabilityRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function booleanCapabilityValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "enabled", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "disabled", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

function readCapabilityFlag(
  capabilities: Record<string, unknown>,
  keys: string[],
  fallback: boolean,
): boolean {
  const normalizedKeys = new Set(keys.map(normalizeCapabilityKey));
  for (const [key, value] of Object.entries(capabilities)) {
    if (!normalizedKeys.has(normalizeCapabilityKey(key))) continue;
    const booleanValue = booleanCapabilityValue(value);
    if (booleanValue !== null) return booleanValue;
  }
  return fallback;
}

function publicationModeLabel(manual: boolean, api: boolean): string {
  if (manual && api) return "Смешанная публикация";
  if (api) return "API-публикация";
  if (manual) return "Ручная публикация";
  return "Публикация не настроена";
}

function metricsModeLabel(manual: boolean, api: boolean): string {
  if (manual && api) return "Ручной и API-сбор метрик";
  if (api) return "API-метрики";
  if (manual) return "Ручной сбор метрик";
  return "Метрики не настроены";
}

export function getContentFactoryPlatformCapabilities(
  platform: PlatformCapabilitiesLike,
): ContentFactoryPlatformCapabilities {
  const capabilities = asCapabilityRecord(platform?.capabilities);
  const canPublishManually = readCapabilityFlag(
    capabilities,
    ["manual_publish", "manualPublish", "can_publish_manually"],
    true,
  );
  const canPublishViaApi = readCapabilityFlag(
    capabilities,
    [
      "api_publish",
      "apiPublish",
      "publish_api",
      "can_publish_api",
      "can_api_publish",
      "supports_api_publish",
      "auto_publish",
    ],
    false,
  );
  const canCollectMetricsManually = readCapabilityFlag(
    capabilities,
    ["manual_metrics", "manualMetrics", "can_collect_metrics_manually"],
    true,
  );
  const canCollectMetricsViaApi = readCapabilityFlag(
    capabilities,
    [
      "api_metrics",
      "apiMetrics",
      "metrics_api",
      "can_metrics_api",
      "can_api_metrics",
      "supports_metrics_api",
      "collect_metrics_api",
    ],
    false,
  );
  const canStorePostUrl = readCapabilityFlag(
    capabilities,
    ["supports_post_url", "post_url", "postUrl", "can_store_post_url"],
    true,
  );

  return {
    canPublishManually,
    canPublishViaApi,
    canCollectMetricsManually,
    canCollectMetricsViaApi,
    canStorePostUrl,
    publicationModeLabel: publicationModeLabel(
      canPublishManually,
      canPublishViaApi,
    ),
    metricsModeLabel: metricsModeLabel(
      canCollectMetricsManually,
      canCollectMetricsViaApi,
    ),
  };
}

function publicationMetricNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "метрика";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "метрики";
  }
  return "метрик";
}

function formatMetricEvidenceLabel(count: number): string {
  if (count === 0) return "Метрик пока нет";
  return `${count} ${publicationMetricNoun(count)}`;
}

function getPublicationFactLabel(
  publication: PublicationOperationsPublicationLike,
  nowTime: number,
): string {
  if (publication.status === "cancelled") return "Публикация отменена";
  if (publication.status === "failed") return "Нужна проверка ошибки";
  if (publication.status === "published") {
    return publication.actual_published_at
      ? "Факт публикации заполнен"
      : "Опубликовано, но факт не заполнен";
  }
  const scheduledTime = dateTime(publication.scheduled_at);
  if (scheduledTime !== null && scheduledTime < nowTime) return "План просрочен";
  if (publication.status === "scheduled") return "Ожидает публикации";
  return "В подготовке";
}

function canSavePublicationFact(status: CFPublicationStatus | string): boolean {
  return status === "approved" || status === "scheduled" || status === "published";
}

export function getContentFactoryPublicationOperations(
  publication: PublicationOperationsPublicationLike,
  platform: PlatformCapabilitiesLike,
  metrics: PublicationOperationsMetricLike[],
  now: Date | string = new Date(),
): ContentFactoryPublicationOperationsSummary {
  const capabilities = getContentFactoryPlatformCapabilities(platform);
  const isPublished = publication.status === "published";
  const canSavePublishFact = canSavePublicationFact(publication.status);
  const metricEvidenceCount = metrics.length;
  const hasPostReference = Boolean(
    publication.platform_post_url?.trim() || publication.platform_post_id?.trim(),
  );

  return {
    capabilities,
    publishFactLabel: getPublicationFactLabel(publication, dateInputTime(now)),
    canSavePublishFact,
    publishFactDisabledReason: canSavePublishFact
      ? null
      : "Сначала доведите публикацию до одобрения или календаря.",
    missingPublishedAt: isPublished && !publication.actual_published_at,
    missingPostUrl:
      isPublished &&
      capabilities.canStorePostUrl &&
      !publication.platform_post_url?.trim(),
    hasPostReference,
    needsMetricEvidence: isPublished && metricEvidenceCount === 0,
    metricEvidenceCount,
    metricEvidenceLabel: formatMetricEvidenceLabel(metricEvidenceCount),
  };
}

function workflowAction({
  key,
  targetStatus,
  label,
  description,
  tone = "default",
  disabled = false,
  disabledReason = null,
}: {
  key: string;
  targetStatus: CFPublicationStatus;
  label: string;
  description: string;
  tone?: ContentFactoryPublicationWorkflowActionTone;
  disabled?: boolean;
  disabledReason?: string | null;
}): ContentFactoryPublicationWorkflowAction {
  return {
    key,
    targetStatus,
    label,
    description,
    tone,
    disabled,
    disabledReason,
  };
}

export function getContentFactoryPublicationWorkflowActions(
  publication: PublicationWorkflowPublicationLike,
): ContentFactoryPublicationWorkflowAction[] {
  switch (publication.status) {
    case "draft":
      return [
        workflowAction({
          key: "send_to_production",
          targetStatus: "needs_copy",
          label: "Отправить в производство",
          description: "Передать публикацию команде на подготовку текста.",
          tone: "primary",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "needs_copy":
      return [
        workflowAction({
          key: "send_to_design",
          targetStatus: "needs_design",
          label: "Передать на дизайн",
          description: "Текст готов, нужны визуалы или материалы.",
        }),
        workflowAction({
          key: "send_to_factcheck",
          targetStatus: "factcheck",
          label: "На фактчек",
          description: "Отправить материал на проверку фактов.",
          tone: "primary",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "needs_design":
      return [
        workflowAction({
          key: "send_to_factcheck",
          targetStatus: "factcheck",
          label: "На фактчек",
          description: "Визуалы готовы, проверить факты и формулировки.",
          tone: "primary",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "factcheck":
      return [
        workflowAction({
          key: "send_to_doctor",
          targetStatus: "doctor_review",
          label: "На проверку врача",
          description: "Передать медицинскую часть на согласование.",
          tone: "primary",
        }),
        workflowAction({
          key: "return_to_copy",
          targetStatus: "needs_copy",
          label: "Вернуть в текст",
          description: "Нужны правки текста после проверки фактов.",
          tone: "warning",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "doctor_review":
      return [
        workflowAction({
          key: "approve",
          targetStatus: "approved",
          label: "Одобрить",
          description: "Медицинское согласование пройдено.",
          tone: "primary",
        }),
        workflowAction({
          key: "return_to_copy",
          targetStatus: "needs_copy",
          label: "Вернуть в текст",
          description: "Нужны правки текста после проверки врача.",
          tone: "warning",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "approved": {
      const missingSchedule = dateTime(publication.scheduled_at) === null;
      return [
        workflowAction({
          key: "schedule",
          targetStatus: "scheduled",
          label: "Поставить в календарь",
          description: "Перевести одобренную публикацию в план выхода.",
          tone: "primary",
          disabled: missingSchedule,
          disabledReason: missingSchedule
            ? "Сначала укажите плановую дату"
            : null,
        }),
        workflowAction({
          key: "return_to_doctor",
          targetStatus: "doctor_review",
          label: "Вернуть врачу",
          description: "Нужно дополнительное медицинское согласование.",
          tone: "warning",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    }
    case "scheduled":
      return [
        workflowAction({
          key: "return_to_approval",
          targetStatus: "approved",
          label: "Вернуть к одобрению",
          description: "Снять из календаря и вернуть на финальное согласование.",
          tone: "warning",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Снять публикацию с рабочего плана.",
          tone: "danger",
        }),
      ];
    case "failed":
      return [
        workflowAction({
          key: "return_to_production",
          targetStatus: "needs_copy",
          label: "Вернуть в производство",
          description: "Вернуть материал в работу после ошибки публикации.",
          tone: "primary",
        }),
        workflowAction({
          key: "cancel",
          targetStatus: "cancelled",
          label: "Отменить",
          description: "Зафиксировать, что публикация больше не нужна.",
          tone: "danger",
        }),
      ];
    case "cancelled":
      return [
        workflowAction({
          key: "restore_to_draft",
          targetStatus: "draft",
          label: "Вернуть в черновик",
          description: "Возобновить работу над отмененной публикацией.",
          tone: "primary",
        }),
      ];
    case "published":
    default:
      return [];
  }
}

const READINESS_STATUS_LABELS: Record<
  ContentFactoryPublicationReadinessStatus,
  string
> = {
  ready: "Готово",
  missing: "Нужно заполнить",
  after_publish: "После публикации",
};

function readinessItem(
  key: ContentFactoryPublicationReadinessKey,
  label: string,
  status: ContentFactoryPublicationReadinessStatus,
  description: string,
): ContentFactoryPublicationReadinessItem {
  return {
    key,
    label,
    status,
    statusLabel: READINESS_STATUS_LABELS[status],
    description,
  };
}

function hasTextValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasUtmValue(value: Record<string, unknown> | null | undefined): boolean {
  if (!value) return false;
  return Object.values(value).some((item) => {
    if (item === null || item === undefined) return false;
    return String(item).trim().length > 0;
  });
}

export function getContentFactoryPublicationReadiness(
  publication: PublicationReadinessPublicationLike,
  segmentTargets: PublicationReadinessSegmentTargetLike[],
  metrics: PublicationOperationsMetricLike[],
): ContentFactoryPublicationReadinessItem[] {
  const isPublished = publication.status === "published";
  const hasPostReference = Boolean(
    publication.platform_post_url?.trim() || publication.platform_post_id?.trim(),
  );
  const publishFactReady = Boolean(
    publication.actual_published_at && hasPostReference,
  );

  return [
    readinessItem(
      "body",
      "Текст публикации",
      hasTextValue(publication.body_text) ? "ready" : "missing",
      hasTextValue(publication.body_text)
        ? "Текст готов для ручной публикации."
        : "Заполните текст публикации.",
    ),
    readinessItem(
      "schedule",
      "Дата в плане",
      hasTextValue(publication.scheduled_at) ? "ready" : "missing",
      hasTextValue(publication.scheduled_at)
        ? "Плановая дата задана."
        : "Добавьте плановую дату выхода.",
    ),
    readinessItem(
      "utm",
      "UTM-метки",
      hasUtmValue(publication.utm) ? "ready" : "missing",
      hasUtmValue(publication.utm)
        ? "UTM-метки сохранены в публикации."
        : "Сгенерируйте и примените UTM-метки.",
    ),
    readinessItem(
      "audience",
      "Аудитория",
      segmentTargets.length > 0 ? "ready" : "missing",
      segmentTargets.length > 0
        ? "К публикации привязана аудитория."
        : "Добавьте целевую или исключающую аудиторию.",
    ),
    readinessItem(
      "publish_fact",
      "Факт выхода",
      !isPublished ? "after_publish" : publishFactReady ? "ready" : "missing",
      !isPublished
        ? "Заполняется после выхода публикации."
        : publishFactReady
          ? "Дата выхода и ссылка или ID поста заполнены."
          : "Добавьте дату выхода и ссылку или ID поста.",
    ),
    readinessItem(
      "metrics",
      "Первые метрики",
      !isPublished ? "after_publish" : metrics.length > 0 ? "ready" : "missing",
      !isPublished
        ? "Первые замеры нужны после публикации."
        : metrics.length > 0
          ? "Есть хотя бы один замер результата."
          : "Добавьте первый ручной замер результата.",
    ),
  ];
}

function publishPackageReferenceLabel(
  record: PublishPackageReferenceLike,
  fallback: string,
): string {
  const value =
    record?.display_name?.trim() ||
    record?.name?.trim() ||
    record?.code?.trim() ||
    record?.id?.trim();
  return value || fallback;
}

function formatPublishPackageDateTime(value: string | null | undefined): string {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function cleanUtmEntries(
  value: Record<string, unknown> | null | undefined,
): Array<[string, string]> {
  if (!value) return [];
  return Object.entries(value)
    .map<[string, string]>(([key, item]) => [
      key,
      item == null ? "" : String(item).trim(),
    ])
    .filter(([, item]) => item.length > 0);
}

function formatPublishPackageUtm(
  value: Record<string, unknown> | null | undefined,
): string {
  const entries = cleanUtmEntries(value);
  if (entries.length === 0) return "UTM не заполнены";
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

function formatPublishPackageMediaRef(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directValue = record.url ?? record.href ?? record.name ?? record.title;
    if (
      typeof directValue === "string" ||
      typeof directValue === "number"
    ) {
      return String(directValue).trim();
    }
    return "Материал";
  }
  return String(value).trim();
}

function materialNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "материал";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "материала";
  }
  return "материалов";
}

function utmTagNoun(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "метка";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "метки";
  }
  return "меток";
}

function formatPublishPackageAudience(
  segmentTargets: PublishPackageSegmentTargetLike[],
  segments: PublishPackageSegmentLike[],
): string {
  const segmentNames = new Map(
    segments.map((segment) => [
      segment.id,
      segment.name?.trim() ||
        segment.display_name?.trim() ||
        segment.source_segment_id?.trim() ||
        segment.id,
    ]),
  );
  const labels = segmentTargets
    .map((target) => {
      const segmentId = target.external_segment_id?.trim();
      if (!segmentId) return null;
      const role = target.role ?? "target";
      const roleLabel =
        CF_SEGMENT_ROLE_LABELS[role as CFSegmentRole] ?? String(role);
      return `${roleLabel}: ${segmentNames.get(segmentId) ?? segmentId}`;
    })
    .filter((item): item is string => Boolean(item));

  return labels.length > 0 ? labels.join("; ") : "Аудитории не указаны";
}

export function buildContentFactoryPublishPackage(
  input: ContentFactoryPublishPackageInput,
): ContentFactoryPublishPackage {
  const { publication } = input;
  const mediaRefs = (publication.media_refs ?? [])
    .map(formatPublishPackageMediaRef)
    .filter((item) => item.length > 0);
  const mediaText =
    mediaRefs.length > 0 ? mediaRefs.map((ref) => `- ${ref}`).join("\n") : "Медиа не указаны";
  const bodyText = publication.body_text?.trim() || "Текст не заполнен";
  const utmText = formatPublishPackageUtm(publication.utm);
  const utmEntryCount = cleanUtmEntries(publication.utm).length;
  const audienceText = formatPublishPackageAudience(
    input.segmentTargets ?? [],
    input.segments ?? [],
  );
  const title = publication.title?.trim() || "Без названия";
  const rows: ContentFactoryPublishPackageRow[] = [
    {
      label: "Канал",
      value: publishPackageReferenceLabel(input.platform, "Площадка не указана"),
    },
    {
      label: "Формат",
      value: publishPackageReferenceLabel(input.format, "Формат не указан"),
    },
    {
      label: "Кампания",
      value: publishPackageReferenceLabel(input.bundle, "Кампания не указана"),
    },
    {
      label: "План",
      value: formatPublishPackageDateTime(publication.scheduled_at),
    },
    {
      label: "Аудитории",
      value: audienceText,
    },
    {
      label: "UTM-метки",
      value:
        utmEntryCount > 0
          ? `${utmEntryCount} ${utmTagNoun(utmEntryCount)}`
          : "UTM не заполнены",
    },
    {
      label: "Текст",
      value: publication.body_text?.trim() ? "Заполнен" : "Текст не заполнен",
    },
    {
      label: "Медиа",
      value:
        mediaRefs.length > 0
          ? `${mediaRefs.length} ${materialNoun(mediaRefs.length)}`
          : "Медиа не указаны",
    },
  ];

  const summaryLines = rows.map((row) => `${row.label}: ${row.value}`);
  const copyText = [
    `Пакет для публикации: ${title}`,
    "",
    ...summaryLines,
    "",
    "Текст:",
    bodyText,
    "",
    "Медиа:",
    mediaText,
    "",
    "UTM:",
    utmText,
  ].join("\n");

  return {
    title,
    rows,
    bodyText,
    mediaRefs,
    mediaText,
    utmText,
    audienceText,
    copyText,
  };
}

function compactVariantText(value: string, maxLength: number): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, Math.max(maxLength - 1, 0)).trimEnd();
  return `${sliced}…`;
}

function buildPublicationVariantCopyText({
  channelLabel,
  useCase,
  title,
  body,
  warnings,
  utmText,
}: {
  channelLabel: string;
  useCase: string;
  title: string;
  body: string;
  warnings: string[];
  utmText: string | null;
}): string {
  const lines = [
    `Канал: ${channelLabel}`,
    `Назначение: ${useCase}`,
    "",
    "Заголовок:",
    title,
    "",
    "Текст:",
    body,
  ];

  if (warnings.length > 0) {
    lines.push("", "Проверить:", ...warnings.map((warning) => `- ${warning}`));
  }
  if (utmText) {
    lines.push("", "UTM:", utmText);
  }

  return lines.join("\n");
}

function publicationVariant({
  key,
  channelLabel,
  useCase,
  title,
  body,
  lengthHint,
  warnings,
  utmText,
}: Omit<ContentFactoryPublicationVariant, "copyText"> & {
  utmText: string | null;
}): ContentFactoryPublicationVariant {
  return {
    key,
    channelLabel,
    useCase,
    title,
    body,
    lengthHint,
    warnings,
    copyText: buildPublicationVariantCopyText({
      channelLabel,
      useCase,
      title,
      body,
      warnings,
      utmText,
    }),
  };
}

export function buildContentFactoryPublicationVariants(
  input: ContentFactoryPublicationVariantsInput,
): ContentFactoryPublicationVariants {
  const title = input.publication.title?.trim() || "Без названия";
  const hasBody = Boolean(input.publication.body_text?.trim());
  const body = input.publication.body_text?.trim() || "Текст публикации не заполнен";
  const warnings = hasBody ? [] : ["Текст публикации не заполнен"];
  const utmText =
    cleanUtmEntries(input.publication.utm).length > 0
      ? formatPublishPackageUtm(input.publication.utm)
      : null;
  const compactBody = compactVariantText(body, 280);
  const shortBody = compactVariantText(body, 140);
  const preheader = compactVariantText(body, 90);
  const contextRows: ContentFactoryPublishPackageRow[] = [
    {
      label: "Исходный канал",
      value: publishPackageReferenceLabel(input.platform, "Площадка не указана"),
    },
    {
      label: "Формат",
      value: publishPackageReferenceLabel(input.format, "Формат не указан"),
    },
    {
      label: "Кампания",
      value: publishPackageReferenceLabel(input.bundle, "Кампания не указана"),
    },
  ];

  const variantInputs: Array<
    Omit<ContentFactoryPublicationVariant, "copyText"> & { utmText: string | null }
  > = [
    {
      key: "telegram",
      channelLabel: "Telegram",
      useCase: "Основной пост или анонс в канале",
      title,
      body: `${title}\n\n${body}\n\nCTA: добавьте ссылку, кнопку или следующий шаг.`,
      lengthHint: "Короткий пост",
      warnings,
      utmText,
    },
    {
      key: "vk",
      channelLabel: "VK",
      useCase: "Пост с обсуждением и комментарием",
      title,
      body: `${title}\n\n${body}\n\nНапишите в комментариях, какой вопрос важно разобрать отдельно.\n\nCTA: добавьте ссылку или кнопку.`,
      lengthHint: "Пост средней длины",
      warnings,
      utmText,
    },
    {
      key: "email",
      channelLabel: "Email",
      useCase: "Письмо или рассылка",
      title,
      body: `Тема: ${title}\nПрехедер: ${preheader}\n\nЗдравствуйте!\n\n${body}\n\nCTA: добавьте ссылку на регистрацию или материал.`,
      lengthHint: "Subject + preheader + body",
      warnings,
      utmText,
    },
    {
      key: "push",
      channelLabel: "Push",
      useCase: "Короткое уведомление",
      title: compactVariantText(title, 55),
      body: shortBody,
      lengthHint: "До 200 знаков",
      warnings,
      utmText,
    },
    {
      key: "max",
      channelLabel: "Max",
      useCase: "Короткий социальный пост",
      title,
      body: `${title}\n\n${compactBody}\n\nCTA: добавьте короткую ссылку.`,
      lengthHint: "Короткая версия",
      warnings,
      utmText,
    },
    {
      key: "dzen",
      channelLabel: "Дзен",
      useCase: "План лонгрида или заметки",
      title,
      body: `${title}\n\nПлан материала:\n1. Почему это важно\n2. Что нужно знать\n3. Что сделать дальше\n\nОснова:\n${body}`,
      lengthHint: "Outline",
      warnings,
      utmText,
    },
  ];

  return {
    sourceTitle: title,
    sourceBody: body,
    contextRows,
    variants: variantInputs.map(publicationVariant),
  };
}

export function getContentFactoryPublicationVariantCoverage({
  publication,
  savedVariants = [],
}: ContentFactoryPublicationVariantCoverageInput): ContentFactoryPublicationVariantCoverage {
  const publicationVersion = publication.version_number ?? 0;
  const savedByChannel = new Map<
    ContentFactoryPublicationVariantKey,
    PublicationVariantCoverageSavedVariantLike
  >();

  for (const variant of savedVariants ?? []) {
    const channel = CONTENT_FACTORY_PUBLICATION_VARIANT_CHANNELS.find(
      (item) => item.key === variant.channel,
    );
    if (channel) {
      savedByChannel.set(channel.key, variant);
    }
  }

  const channels = CONTENT_FACTORY_PUBLICATION_VARIANT_CHANNELS.map((channel) => {
    const savedVariant = savedByChannel.get(channel.key);
    const saved = Boolean(savedVariant?.body_text?.trim());
    const sourceVersionNumber = savedVariant?.source_version_number ?? null;
    const stale =
      saved &&
      sourceVersionNumber !== null &&
      sourceVersionNumber < publicationVersion;

    return {
      key: channel.key,
      label: channel.label,
      saved,
      stale,
      sourceVersionNumber,
    };
  });

  const savedChannels = channels.filter((channel) => channel.saved);
  const readyChannels = channels.filter(
    (channel) => channel.saved && !channel.stale,
  );
  const missingChannels = channels.filter((channel) => !channel.saved);
  const staleChannels = channels.filter((channel) => channel.stale);
  const nextAction =
    savedChannels.length === 0
      ? "Сохраните первую адаптацию"
      : staleChannels.length > 0
        ? "Обновите адаптации после изменения публикации"
        : missingChannels.length > 0
          ? "Заполните недостающие каналы"
          : "Адаптации готовы";

  return {
    totalChannels: channels.length,
    savedCount: savedChannels.length,
    readyCount: readyChannels.length,
    missingCount: missingChannels.length,
    staleCount: staleChannels.length,
    savedChannels,
    readyChannels,
    missingChannels,
    staleChannels,
    channels,
    nextAction,
  };
}

export function buildContentFactoryPublicationVariantHandoff({
  publication,
  savedVariants = [],
}: ContentFactoryPublicationVariantHandoffInput): ContentFactoryPublicationVariantHandoff {
  const coverage = getContentFactoryPublicationVariantCoverage({
    publication,
    savedVariants,
  });
  const savedByChannel = new Map<
    ContentFactoryPublicationVariantKey,
    PublicationVariantHandoffSavedVariantLike
  >();

  for (const variant of savedVariants ?? []) {
    const channel = CONTENT_FACTORY_PUBLICATION_VARIANT_CHANNELS.find(
      (item) => item.key === variant.channel,
    );
    if (channel) {
      savedByChannel.set(channel.key, variant);
    }
  }

  const readyChannels = coverage.channels.filter(
    (channel) => channel.saved && !channel.stale,
  );
  const skippedChannels = coverage.channels.filter(
    (channel) => !channel.saved || channel.stale,
  );
  const readyChannelLabels = readyChannels.map((channel) => channel.label);
  const skippedChannelLabels = skippedChannels.map((channel) => channel.label);
  const canCopy = readyChannels.length > 0;

  if (!canCopy) {
    return {
      canCopy,
      readyCount: 0,
      totalChannels: coverage.totalChannels,
      readyChannelLabels,
      skippedChannelLabels,
      nextAction: "Сначала сохраните актуальную адаптацию",
      copyText: "",
    };
  }

  const publicationTitle = publication.title?.trim() || "Без названия";
  const sourceVersion = publication.version_number ?? 0;
  const lines = [
    "Пакет адаптаций",
    `Публикация: ${publicationTitle}`,
    `Версия источника: v${sourceVersion}`,
    `Готово: ${readyChannels.length} из ${coverage.totalChannels}`,
  ];

  if (skippedChannelLabels.length > 0) {
    lines.push(`Не включено: ${skippedChannelLabels.join(", ")}`);
  }

  for (const channel of readyChannels) {
    const variant = savedByChannel.get(channel.key);
    if (!variant) continue;
    lines.push("", "---", `Канал: ${channel.label}`);

    const title = variant.title?.trim();
    if (title) {
      lines.push("Заголовок:", title);
    }

    lines.push("Текст:", variant.body_text?.trim() || "Текст адаптации не заполнен");

    const notes = variant.notes?.trim();
    if (notes) {
      lines.push("Заметки:", notes);
    }
  }

  if (cleanUtmEntries(publication.utm).length > 0) {
    lines.push("", "UTM:", formatPublishPackageUtm(publication.utm));
  }

  return {
    canCopy,
    readyCount: readyChannels.length,
    totalChannels: coverage.totalChannels,
    readyChannelLabels,
    skippedChannelLabels,
    nextAction: "Скопируйте готовые адаптации",
    copyText: lines.join("\n"),
  };
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

function calendarState(
  key: ContentFactoryCalendarPublicationStateKey,
  label: string,
  description: string,
  actionLabel: string,
  tone: ContentFactoryCalendarPublicationStateTone,
  needsAction: boolean,
  readyToPublish = false,
): ContentFactoryCalendarPublicationState {
  return {
    key,
    label,
    description,
    actionLabel,
    tone,
    needsAction,
    readyToPublish,
  };
}

function isTerminalPublicationStatus(status: string): boolean {
  return status === "cancelled" || status === "failed";
}

function hasPublicationPostReference(publication: CalendarPublicationLike): boolean {
  return Boolean(
    publication.platform_post_url?.trim() || publication.platform_post_id?.trim(),
  );
}

export function getContentFactoryCalendarPublicationState(
  publication: CalendarPublicationLike,
  now: Date | string = new Date(),
): ContentFactoryCalendarPublicationState {
  const status = String(publication.status);
  const scheduledTime = dateTime(publication.scheduled_at);
  const nowTime = dateInputTime(now);
  const scheduledDateKey = dateKey(publication.scheduled_at);
  const nowDateKey = dateKey(new Date(nowTime).toISOString());
  const hasBody = hasTextValue(publication.body_text);
  const hasUtm = hasUtmValue(publication.utm);

  if (status === "published") {
    const factReady = Boolean(
      publication.actual_published_at && hasPublicationPostReference(publication),
    );
    return factReady
      ? calendarState(
          "published",
          "Опубликовано",
          "Публикация вышла, можно контролировать первые метрики.",
          "Проверить метрики",
          "success",
          false,
        )
      : calendarState(
          "published_needs_fact",
          "Заполнить факт",
          "Добавьте дату выхода и ссылку или ID опубликованного поста.",
          "Добавить факт",
          "warning",
          true,
        );
  }

  if (isTerminalPublicationStatus(status)) {
    return calendarState(
      "inactive",
      "Не выходит",
      status === "failed"
        ? "Публикация отмечена как ошибка, нужна ручная проверка."
        : "Публикация отменена и не участвует в ближайшем выпуске.",
      "Открыть карточку",
      "muted",
      false,
    );
  }

  if (scheduledTime === null) {
    return calendarState(
      "unscheduled",
      "Без даты",
      "Назначьте плановую дату выхода.",
      "Назначить дату",
      "warning",
      true,
    );
  }

  if (scheduledTime < nowTime) {
    return calendarState(
      "overdue",
      "Просрочен план",
      "Плановое время прошло, проверьте выпуск или перенесите дату.",
      "Проверить выпуск",
      "critical",
      true,
    );
  }

  if (!hasBody) {
    return calendarState(
      "needs_text",
      "Нужен текст",
      "Заполните текст публикации до передачи на площадку.",
      "Заполнить текст",
      "warning",
      true,
    );
  }

  if (!hasUtm) {
    return calendarState(
      "needs_utm",
      "Нужны UTM",
      "Добавьте UTM-метки для ручной публикации и дальнейшей аналитики.",
      "Добавить UTM",
      "warning",
      true,
    );
  }

  if (scheduledDateKey && scheduledDateKey === nowDateKey) {
    return calendarState(
      "today",
      "Сегодня",
      "Публикация готова к ручному выпуску сегодня.",
      "Открыть пакет",
      "info",
      false,
      true,
    );
  }

  if (status === "approved" || status === "scheduled") {
    return calendarState(
      "ready",
      "Готово к выходу",
      "Текст, дата и UTM заполнены для ручного выпуска.",
      "Открыть пакет",
      "success",
      false,
      true,
    );
  }

  return calendarState(
    "preparing",
    "В подготовке",
    "Публикация ещё проходит производственный процесс.",
    "Открыть карточку",
    "muted",
    false,
  );
}

export function summarizeContentFactoryCalendar<T extends CalendarPublicationLike>(
  publications: T[],
  now: Date | string = new Date(),
): ContentFactoryCalendarSummary {
  const states = publications.map((publication) =>
    getContentFactoryCalendarPublicationState(publication, now),
  );

  return {
    total: publications.length,
    today: states.filter((state) => state.key === "today").length,
    overdue: states.filter((state) => state.key === "overdue").length,
    readyToPublish: states.filter((state) => state.readyToPublish).length,
    needsAction: states.filter((state) => state.needsAction).length,
    unscheduled: states.filter((state) => state.key === "unscheduled").length,
  };
}

function publicationIndexSearchText(
  publication: PublicationIndexLike,
  lookup: ContentFactoryPublicationIndexLookup,
): string {
  const statusLabel =
    CF_PUBLICATION_STATUS_LABELS[publication.status as CFPublicationStatus] ??
    publication.status;
  return [
    publication.id,
    publication.title,
    publication.body_text,
    publication.status,
    statusLabel,
    publication.bundle_id,
    publication.platform_id,
    publication.format_id,
    publication.responsible_id,
    publication.bundle_id ? lookup.bundleNames?.get(publication.bundle_id) : null,
    publication.platform_id
      ? lookup.platformNames?.get(publication.platform_id)
      : null,
    publication.format_id ? lookup.formatNames?.get(publication.format_id) : null,
    publication.responsible_id
      ? lookup.responsibleNames?.get(publication.responsible_id)
      : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterContentFactoryPublicationIndex<
  T extends PublicationIndexLike,
>(
  publications: T[],
  filters: ContentFactoryPublicationFilters,
  search: string | null | undefined,
  lookup: ContentFactoryPublicationIndexLookup = {},
): T[] {
  const filtered = filterContentFactoryPublications(publications, filters);
  const query = search?.trim().toLowerCase();
  if (!query) return filtered;
  return filtered.filter((publication) =>
    publicationIndexSearchText(publication, lookup).includes(query),
  );
}

function publicationIndexTime(publication: PublicationIndexLike): number {
  return Math.max(
    dateTime(publication.scheduled_at) ?? 0,
    dateTime(publication.actual_published_at) ?? 0,
    dateTime(publication.updated_at) ?? 0,
    dateTime(publication.created_at) ?? 0,
  );
}

export function sortContentFactoryPublicationsForIndex<
  T extends PublicationIndexLike,
>(publications: T[]): T[] {
  return [...publications].sort(
    (left, right) =>
      publicationIndexTime(right) - publicationIndexTime(left) ||
      (left.title ?? left.id).localeCompare(right.title ?? right.id, "ru"),
  );
}

export function summarizeContentFactoryPublicationIndex<
  T extends PublicationIndexLike,
>(publications: T[]): ContentFactoryPublicationIndexSummary {
  return {
    total: publications.length,
    inProduction: publications.filter(
      (publication) =>
        publication.status !== "published" && publication.status !== "cancelled",
    ).length,
    scheduled: publications.filter((publication) => publication.status === "scheduled")
      .length,
    published: publications.filter((publication) => publication.status === "published")
      .length,
    publishedWithoutPostUrl: publications.filter(
      (publication) =>
        publication.status === "published" &&
        !publication.platform_post_url?.trim(),
    ).length,
  };
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

const CONTENT_FACTORY_METRIC_INSIGHT_WINDOWS: CFMetricWindow[] = [
  "3h",
  "24h",
  "72h",
  "7d",
  "final",
];

const CONTENT_FACTORY_METRIC_INSIGHT_WINDOW_LABELS: Record<CFMetricWindow, string> =
  {
    "3h": "3 часа",
    "24h": "24 часа",
    "72h": "72 часа",
    "7d": "7 дней",
    final: "Финал",
    custom: "Другое",
  };

function metricInsightName(value: string | null | undefined): string {
  return value?.trim() || "Метрика без названия";
}

function metricInsightNumericValue(metric: MetricValueLike): number | null {
  if (metric.metric_value === null || metric.metric_value === undefined) return null;
  if (typeof metric.metric_value === "number") {
    return Number.isFinite(metric.metric_value) ? metric.metric_value : null;
  }
  const normalized = metric.metric_value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortMetricInsightsByCapturedAt<TMetric extends PublicationMetricInsightLike>(
  metrics: TMetric[],
): TMetric[] {
  return [...metrics].sort(
    (left, right) =>
      (dateTime(right.captured_at) ?? 0) - (dateTime(left.captured_at) ?? 0),
  );
}

function formatMetricInsightLatestLabel(
  metric: PublicationMetricInsightLike | null,
): string {
  if (!metric) return "Метрик пока нет";
  return `${metricInsightName(metric.metric_name)} · ${formatContentFactoryMetricValue(
    metric,
  )} · ${CONTENT_FACTORY_METRIC_INSIGHT_WINDOW_LABELS[metric.window]}`;
}

function metricInsightNextAction(
  totalMetrics: number,
  missingWindows: CFMetricWindow[],
  metrics: PublicationMetricInsightLike[],
): string {
  if (totalMetrics === 0) {
    return "Добавьте первые метрики вручную или через импорт.";
  }
  if (missingWindows.includes("24h")) return "Добавьте срез 24 часа.";
  if (missingWindows.includes("7d")) return "Добавьте срез 7 дней.";
  if (missingWindows.includes("final")) return "Добавьте финальный срез.";
  if (metrics.some((metric) => metric.confidence === "low")) {
    return "Проверьте метрики с низким доверием.";
  }
  return "Метрики покрывают основные срезы.";
}

export function getContentFactoryPublicationMetricInsights<
  TMetric extends PublicationMetricInsightLike,
>(
  metrics: TMetric[],
): ContentFactoryPublicationMetricInsights<TMetric> {
  const sortedMetrics = sortMetricInsightsByCapturedAt(metrics);
  const latestMetric = sortedMetrics[0] ?? null;
  const groupsByName = new Map<string, TMetric[]>();

  for (const metric of sortedMetrics) {
    const name = metricInsightName(metric.metric_name);
    groupsByName.set(name, [...(groupsByName.get(name) ?? []), metric]);
  }

  const groups = Array.from(groupsByName.entries())
    .map(([metricName, groupMetrics]) => {
      const latestGroupMetric = groupMetrics[0];
      let bestNumericMetric: TMetric | null = null;
      let bestNumericValue: number | null = null;

      for (const metric of groupMetrics) {
        const numericValue = metricInsightNumericValue(metric);
        if (numericValue === null) continue;
        if (bestNumericValue === null || numericValue > bestNumericValue) {
          bestNumericValue = numericValue;
          bestNumericMetric = metric;
        }
      }

      const coveredWindows = CONTENT_FACTORY_METRIC_INSIGHT_WINDOWS.filter((window) =>
        groupMetrics.some((metric) => metric.window === window),
      );

      return {
        metricName,
        count: groupMetrics.length,
        latestMetric: latestGroupMetric,
        latestValueLabel: formatContentFactoryMetricValue(latestGroupMetric),
        latestCapturedAt: latestGroupMetric.captured_at ?? null,
        bestNumericMetric,
        bestNumericValueLabel: bestNumericMetric
          ? formatContentFactoryMetricValue(bestNumericMetric)
          : null,
        coveredWindows,
      };
    })
    .sort(
      (left, right) =>
        (dateTime(right.latestCapturedAt) ?? 0) -
        (dateTime(left.latestCapturedAt) ?? 0),
    );

  const windows = CONTENT_FACTORY_METRIC_INSIGHT_WINDOWS.map((window) => {
    const windowMetrics = sortedMetrics.filter((metric) => metric.window === window);
    return {
      window,
      label: CONTENT_FACTORY_METRIC_INSIGHT_WINDOW_LABELS[window],
      covered: windowMetrics.length > 0,
      metricCount: windowMetrics.length,
      latestMetric: windowMetrics[0] ?? null,
    };
  });
  const missingWindows = windows
    .filter((window) => !window.covered)
    .map((window) => window.window);

  return {
    totalMetrics: metrics.length,
    uniqueMetricNames: groups.length,
    latestMetric,
    latestMetricLabel: formatMetricInsightLatestLabel(latestMetric),
    nextAction: metricInsightNextAction(metrics.length, missingWindows, metrics),
    groups,
    windows,
    missingWindows,
  };
}

const METRIC_IMPORT_WINDOW_ALIASES: Record<string, CFMetricWindow> = {
  "3h": "3h",
  "3 h": "3h",
  "3ч": "3h",
  "3 ч": "3h",
  "3 часа": "3h",
  "через 3 часа": "3h",
  "24h": "24h",
  "24 h": "24h",
  "24ч": "24h",
  "24 ч": "24h",
  "24 часа": "24h",
  "через 24 часа": "24h",
  "72h": "72h",
  "72 h": "72h",
  "72ч": "72h",
  "72 ч": "72h",
  "72 часа": "72h",
  "через 72 часа": "72h",
  "7d": "7d",
  "7 d": "7d",
  "7д": "7d",
  "7 д": "7d",
  "7 дней": "7d",
  "через 7 дней": "7d",
  final: "final",
  "final cut": "final",
  финал: "final",
  финальный: "final",
  "финальный срез": "final",
  custom: "custom",
  другое: "custom",
  кастом: "custom",
};

const METRIC_IMPORT_SOURCE_ALIASES: Record<string, CFMetricSource> = {
  manual: "manual",
  вручную: "manual",
  ручной: "manual",
  api: "api",
  tgstat: "tgstat",
  "tg stat": "tgstat",
  telemetr: "telemetr",
  телеметр: "telemetr",
  vk: "vk_api",
  "vk api": "vk_api",
  vk_api: "vk_api",
  вк: "vk_api",
  email: "email_provider",
  "email provider": "email_provider",
  "email-платформа": "email_provider",
  getcourse: "getcourse",
  "get course": "getcourse",
  геткурс: "getcourse",
  parser: "parser",
  парсер: "parser",
  import: "import",
  импорт: "import",
};

const METRIC_IMPORT_CONFIDENCE_ALIASES: Record<string, CFConfidence> = {
  high: "high",
  высокий: "high",
  высокое: "high",
  medium: "medium",
  средний: "medium",
  среднее: "medium",
  normal: "medium",
  low: "low",
  низкий: "low",
  низкое: "low",
};

function normalizeMetricImportToken(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/ё/g, "е").toLowerCase();
}

function detectMetricImportDelimiter(line: string): string {
  const delimiters = ["\t", "|", ";", ","];
  return delimiters.reduce((best, delimiter) => {
    const count = line.split(delimiter).length - 1;
    const bestCount = line.split(best).length - 1;
    return count > bestCount ? delimiter : best;
  }, "\t");
}

function isMetricImportHeader(columns: string[]): boolean {
  const normalized = columns.map(normalizeMetricImportToken);
  return normalized.some((column) =>
    ["window", "окно", "метрика", "metric", "metric name", "значение"].includes(
      column,
    ),
  );
}

function parseMetricImportNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[\s\u00a0]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error("Значение метрики должно быть числом");
  }
  return parsed;
}

function normalizeMetricImportWindow(value: string): CFMetricWindow | null {
  return METRIC_IMPORT_WINDOW_ALIASES[normalizeMetricImportToken(value)] ?? null;
}

function normalizeMetricImportSource(value: string): CFMetricSource | null {
  const normalized = normalizeMetricImportToken(value);
  if (!normalized) return "import";
  return METRIC_IMPORT_SOURCE_ALIASES[normalized] ?? null;
}

function normalizeMetricImportConfidence(value: string): CFConfidence | null {
  const normalized = normalizeMetricImportToken(value);
  if (!normalized) return "medium";
  return METRIC_IMPORT_CONFIDENCE_ALIASES[normalized] ?? null;
}

export function parseContentFactoryMetricImportRows(
  input: string,
): ContentFactoryMetricImportPreview {
  const rows: ContentFactoryMetricImportRow[] = [];
  let headerChecked = false;

  input.split(/\r?\n/).forEach((rawLine, index) => {
    const raw = rawLine.trim();
    if (!raw) return;

    const delimiter = detectMetricImportDelimiter(raw);
    const columns = raw.split(delimiter).map((column) => column.trim());
    if (!headerChecked) {
      headerChecked = true;
      if (isMetricImportHeader(columns)) return;
    }

    const lineNumber = index + 1;
    const [windowColumn = "", metricNameColumn = "", valueColumn = ""] = columns;
    const sourceColumn = columns[3] ?? "";
    const confidenceColumn = columns[4] ?? "";
    const noteColumn = columns.slice(5).join(delimiter).trim();

    const window = normalizeMetricImportWindow(windowColumn);
    if (!window) {
      rows.push({
        lineNumber,
        raw,
        columns,
        payload: null,
        error: "Неизвестное окно измерения",
      });
      return;
    }

    const metricName = metricNameColumn.trim();
    if (!metricName) {
      rows.push({
        lineNumber,
        raw,
        columns,
        payload: null,
        error: "Укажите название метрики",
      });
      return;
    }

    let metricValue: number | null;
    try {
      metricValue = parseMetricImportNumber(valueColumn);
    } catch (err) {
      rows.push({
        lineNumber,
        raw,
        columns,
        payload: null,
        error:
          err instanceof Error
            ? err.message
            : "Значение метрики должно быть числом",
      });
      return;
    }

    const source = normalizeMetricImportSource(sourceColumn);
    if (!source) {
      rows.push({
        lineNumber,
        raw,
        columns,
        payload: null,
        error: "Неизвестный источник метрики",
      });
      return;
    }

    const confidence = normalizeMetricImportConfidence(confidenceColumn);
    if (!confidence) {
      rows.push({
        lineNumber,
        raw,
        columns,
        payload: null,
        error: "Неизвестный уровень доверия",
      });
      return;
    }

    rows.push({
      lineNumber,
      raw,
      columns,
      payload: {
        window,
        metric_name: metricName,
        metric_value: metricValue,
        metric_value_text: null,
        source,
        source_method: "импорт из буфера",
        confidence,
        note: noteColumn || null,
      },
      error: null,
    });
  });

  return {
    rows,
    validRows: rows.filter((row) => row.payload !== null),
    invalidRows: rows.filter((row) => row.error !== null),
  };
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
  { key: "factcheck", label: "Фактчек", statuses: ["factcheck"] },
  { key: "doctor_review", label: "Проверка врача", statuses: ["doctor_review"] },
  { key: "approval", label: "Готовы к расписанию", statuses: ["approved"] },
  { key: "scheduling", label: "В календаре", statuses: ["scheduled"] },
  { key: "failed", label: "Ошибки", statuses: ["failed"] },
  { key: "cancelled", label: "Отменены", statuses: ["cancelled"] },
];

function getContentFactoryReviewQueueKey(
  status: CFPublicationStatus | string,
): ContentFactoryReviewQueueKey | null {
  return (
    REVIEW_QUEUE_META.find((queue) =>
      queue.statuses.includes(status as CFPublicationStatus),
    )?.key ?? null
  );
}

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

export function getContentFactoryReviewQueueItemSignal<
  TPublication extends PublicationStatusLike,
>(
  publication: TPublication,
  now: Date = new Date(),
): ContentFactoryReviewQueueItemSignal {
  const nowTime = now.getTime();
  const scheduledTime = dateTime(publication.scheduled_at);

  switch (publication.status) {
    case "needs_copy":
      return {
        key: "needs_copy",
        label: "Нужен текст",
        actionLabel: "Дописать текст",
        description: "Заполните или доработайте текст публикации.",
        tone: "warning",
        urgent: false,
        needsAction: true,
      };
    case "needs_design":
      return {
        key: "needs_design",
        label: "Нужен дизайн",
        actionLabel: "Подготовить визуалы",
        description: "Подготовьте визуалы или материалы к публикации.",
        tone: "warning",
        urgent: false,
        needsAction: true,
      };
    case "factcheck":
      return {
        key: "factcheck",
        label: "Фактчек",
        actionLabel: "Проверить факты",
        description: "Проверьте цифры, источники и чувствительные формулировки.",
        tone: "info",
        urgent: false,
        needsAction: true,
      };
    case "doctor_review":
      return {
        key: "doctor_review",
        label: "Проверка врача",
        actionLabel: "Передать врачу",
        description: "Нужно медицинское согласование перед выходом.",
        tone: "info",
        urgent: false,
        needsAction: true,
      };
    case "approved":
      if (scheduledTime === null) {
        return {
          key: "needs_schedule",
          label: "Назначить дату",
          actionLabel: "Поставить в календарь",
          description: "Публикация одобрена, но дата выхода еще не задана.",
          tone: "warning",
          urgent: false,
          needsAction: true,
        };
      }
      return {
        key: "approved",
        label: "Одобрено",
        actionLabel: "Проверить пакет",
        description: "Проверьте текст, UTM и материалы перед расписанием.",
        tone: "success",
        urgent: false,
        needsAction: false,
      };
    case "scheduled":
      if (scheduledTime !== null && scheduledTime < nowTime) {
        return {
          key: "scheduled_overdue",
          label: "План просрочен",
          actionLabel: "Проверить выпуск",
          description: "Плановая дата уже прошла: подтвердите публикацию или перенесите.",
          tone: "critical",
          urgent: true,
          needsAction: true,
        };
      }
      return {
        key: "scheduled",
        label: "В календаре",
        actionLabel: "Проверить пакет",
        description: "Публикация запланирована, проверьте готовность пакета.",
        tone: "success",
        urgent: false,
        needsAction: false,
      };
    case "failed":
      return {
        key: "failed",
        label: "Ошибка публикации",
        actionLabel: "Разобрать ошибку",
        description: "Нужно понять причину сбоя и вернуть публикацию в работу.",
        tone: "critical",
        urgent: true,
        needsAction: true,
      };
    case "cancelled":
      return {
        key: "cancelled",
        label: "Отменено",
        actionLabel: "Открыть причину",
        description: "Проверьте контекст отмены, если публикацию нужно вернуть в план.",
        tone: "muted",
        urgent: false,
        needsAction: true,
      };
    default:
      return {
        key: "open",
        label: "Открыть карточку",
        actionLabel: "Открыть карточку",
        description: "Откройте публикацию и проверьте текущий статус.",
        tone: "muted",
        urgent: false,
        needsAction: true,
      };
  }
}

export function summarizeContentFactoryReviewQueue<
  TPublication extends PublicationStatusLike,
>(
  publications: TPublication[],
  now: Date = new Date(),
): ContentFactoryReviewQueueSummary {
  const summary: ContentFactoryReviewQueueSummary = {
    total: 0,
    production: 0,
    medicalReview: 0,
    scheduling: 0,
    urgent: 0,
    needsAction: 0,
  };

  for (const publication of publications) {
    const queueKey = getContentFactoryReviewQueueKey(publication.status);
    if (queueKey === null) continue;

    const signal = getContentFactoryReviewQueueItemSignal(publication, now);
    summary.total += 1;
    if (queueKey === "production") summary.production += 1;
    if (queueKey === "factcheck" || queueKey === "doctor_review") {
      summary.medicalReview += 1;
    }
    if (queueKey === "approval" || queueKey === "scheduling") {
      summary.scheduling += 1;
    }
    if (signal.urgent) summary.urgent += 1;
    if (signal.needsAction) summary.needsAction += 1;
  }

  return summary;
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
