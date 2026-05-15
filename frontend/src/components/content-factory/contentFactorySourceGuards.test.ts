import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

function sourceExists(path: string): boolean {
  return existsSync(join(srcDir, path));
}

test("sidebar exposes content factory navigation", () => {
  const source = readSource("components/layout/Sidebar.tsx");

  assert.match(source, /href:\s*"\/content-factory\/dashboard"/);
  assert.match(source, /label:\s*"Контент-фабрика"/);
  assert.doesNotMatch(source, /label:\s*"CF Bundles"/);
  assert.doesNotMatch(source, /label:\s*"CF Segments"/);
  assert.doesNotMatch(source, /label:\s*"CF Segment Analytics"/);
  assert.doesNotMatch(source, /label:\s*"CF Review"/);
  assert.doesNotMatch(source, /label:\s*"CF Retros"/);
  assert.doesNotMatch(source, /label:\s*"CF References"/);
});

test("header knows content factory workspace routes", () => {
  const source = readSource("components/layout/Header.tsx");

  assert.match(source, /Контент-фабрика/);
  assert.match(source, /Календарь/);
  assert.match(source, /Публикации/);
  assert.match(source, /Кампании/);
  assert.match(source, /Публикация/);
  assert.match(source, /Очередь проверки/);
  assert.match(source, /Аудитории/);
  assert.match(source, /Аналитика аудиторий/);
  assert.match(source, /Ретроспективы/);
  assert.match(source, /Справочники/);
  assert.match(source, /Справка/);
  assert.doesNotMatch(source, /CF Bundles/);
  assert.doesNotMatch(source, /CF Segments/);
  assert.doesNotMatch(source, /CF Segment Analytics/);
});

test("content factory layout uses dedicated access guard", () => {
  const source = readSource("app/content-factory/layout.tsx");

  assert.match(source, /ContentFactoryGuard/);
  assert.match(source, /ContentFactoryWorkspaceNav/);
  assert.doesNotMatch(source, /useContentAccess/);
});

test("content factory internal navigation exposes Russian sections", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryWorkspaceNav.tsx"),
    true,
  );
  assert.equal(sourceExists("lib/contentFactoryUi.ts"), true);

  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );
  const uiSource = readSource("lib/contentFactoryUi.ts");

  assert.match(navSource, /CONTENT_FACTORY_SECTIONS/);
  assert.match(uiSource, /Контент-фабрика/);
  assert.match(uiSource, /Обзор/);
  assert.match(uiSource, /Календарь/);
  assert.match(uiSource, /Публикации/);
  assert.match(uiSource, /Кампании/);
  assert.match(uiSource, /Очередь проверки/);
  assert.match(uiSource, /Аудитории/);
  assert.match(uiSource, /Аналитика аудиторий/);
  assert.match(uiSource, /Ретроспективы/);
  assert.match(uiSource, /Справочники/);
  assert.match(uiSource, /Справка/);
});

test("content factory chrome avoids repeated module titles", () => {
  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );
  const dashboardSource = readSource("app/content-factory/dashboard/page.tsx");

  assert.doesNotMatch(navSource, /CONTENT_FACTORY_TITLE/);
  assert.doesNotMatch(navSource, /Единое рабочее пространство/);
  assert.match(dashboardSource, /Обзор/);
  assert.doesNotMatch(
    dashboardSource,
    /<h1[\s\S]*?Контент-фабрика[\s\S]*?<\/h1>/,
  );
});

test("content factory workspace navigation exposes visible scroll controls", () => {
  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );

  assert.match(navSource, /ChevronLeft/);
  assert.match(navSource, /ChevronRight/);
  assert.match(navSource, /scrollBy/);
  assert.match(navSource, /scrollIntoView/);
  assert.match(navSource, /overflow-x-auto/);
  assert.match(navSource, /from-card/);
  assert.match(navSource, /to-transparent/);
  assert.doesNotMatch(navSource, /flex-wrap/);
});

test("content factory help route explains the workspace", () => {
  assert.equal(sourceExists("app/content-factory/help/page.tsx"), true);

  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /ContentFactoryHelpPage/);
  assert.match(source, /Что такое Контент-фабрика/);
  assert.match(source, /Кампания/);
  assert.match(source, /Публикация/);
  assert.match(source, /Аудитория/);
  assert.match(source, /Ретроспектива/);
  assert.match(source, /ручн/);
  assert.match(source, /интеграц/);
});

test("content factory overview help explains operating model and automation boundaries", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Почему это сделано именно так/);
  assert.match(source, /Как работает операционная модель/);
  assert.match(source, /Что уже можно делать сейчас/);
  assert.match(source, /Что будет автоматизировано позже/);
  assert.match(source, /Как начать без страха/);
  assert.match(source, /Excel/);
  assert.match(source, /автопубликац/i);
  assert.match(
    source,
    /кампания -> публикации -> адаптации -> проверка -> публикация -> метрики -> выводы/,
  );
});

test("content factory help explains publication planning readiness and adaptations", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Планирование публикации: от календаря до готовности/);
  assert.match(source, /Календарь показывает рабочий план/);
  assert.match(source, /Карточка публикации собирает источник правды/);
  assert.match(source, /Адаптации показывают готовность каналов/);
  assert.match(source, /Чек-лист готовности помогает не пропустить шаг/);
  assert.match(source, /дата в календаре не означает автопубликацию/i);
  assert.match(source, /устаревш/i);
  assert.match(source, /скопировать готовые/i);
});

test("content factory help explains campaigns review queue and audiences", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Кампании, проверка и аудитории/);
  assert.match(source, /Кампания связывает смысл, сроки и публикации/);
  assert.match(source, /Очередь проверки показывает, где застрял материал/);
  assert.match(source, /Аудитории помогают не писать в пустоту/);
  assert.match(source, /Аналитика аудиторий показывает использование сегментов/);
  assert.match(source, /медицинск/i);
  assert.match(source, /GetCourse/);
  assert.match(source, /целевая, исключение, контрольная и ретаргетинг/);
});

test("content factory help explains metrics effectiveness retrospectives and references", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Метрики, эффективность, ретроспективы и справочники/);
  assert.match(source, /Метрики фиксируют evidence, а не просто числа/);
  assert.match(source, /Эффективность показывает, где есть уверенные выводы/);
  assert.match(source, /Ретроспектива превращает результат в следующее решение/);
  assert.match(source, /Справочники держат язык системы единым/);
  assert.match(source, /источник/i);
  assert.match(source, /довер/i);
  assert.match(source, /3 часа, 24 часа, 72 часа, 7 дней/);
  assert.match(source, /не меняйте справочник/i);
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
  assert.match(
    readSource("app/content-factory/publications/page.tsx"),
    /ContentFactoryPublicationsPage/,
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
  assert.match(
    readSource("app/content-factory/retros/page.tsx"),
    /ContentFactoryRetrosPage/,
  );
  assert.match(
    readSource("app/content-factory/retros/[id]/page.tsx"),
    /ContentFactoryRetroDetailPage/,
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
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /groupPublicationsByDate/);
  assert.match(source, /filterContentFactoryPublications/);
  assert.match(source, /summarizeContentFactoryCalendar/);
  assert.match(source, /getContentFactoryCalendarPublicationState/);
  assert.match(source, /ContentFactoryFilters/);
  assert.match(source, /ContentFactoryStatusBadge/);
  assert.match(source, /Нужно действие/);
  assert.match(source, /Готовы к выходу/);
  assert.match(source, /Открыть/);
  assert.match(source, /\/content-factory\/publications\/\$\{publication\.id\}/);
  assert.match(source, /href="\/content-factory\/dashboard"/);
  assert.match(utilsSource, /ContentFactoryCalendarPublicationState/);
  assert.match(utilsSource, /summarizeContentFactoryCalendar/);
});

test("publications route lists all publications with search filters and detail links", () => {
  const source = readSource("app/content-factory/publications/page.tsx");
  const uiSource = readSource("lib/contentFactoryUi.ts");
  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );

  assert.match(uiSource, /href:\s*"\/content-factory\/publications"/);
  assert.match(navSource, /"\/content-factory\/publications"/);
  assert.match(source, /ContentFactoryPublicationsPage/);
  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /ContentFactoryFilters/);
  assert.match(source, /filterContentFactoryPublicationIndex/);
  assert.match(source, /sortContentFactoryPublicationsForIndex/);
  assert.match(source, /summarizeContentFactoryPublicationIndex/);
  assert.match(source, /href=\{`\/content-factory\/publications\/\$\{publication\.id\}`\}/);
  assert.match(source, /Публикации/);
  assert.match(source, /Поиск/);
});

test("publications route can create a publication and redirect to detail", () => {
  const source = readSource("app/content-factory/publications/page.tsx");
  const dialogSource = readSource(
    "components/content-factory/ContentFactoryPublicationDialog.tsx",
  );

  assert.match(source, /useRouter/);
  assert.match(source, /ContentFactoryPublicationDialog/);
  assert.match(source, /setCreateOpen/);
  assert.match(source, /api\.getCFRubrics/);
  assert.match(source, /api\.getCFNosologies/);
  assert.match(source, /Новая публикация/);
  assert.match(
    source,
    /router\.push\(`\/content-factory\/publications\/\$\{saved\.id\}`\)/,
  );
  assert.match(source, /bundles=\{bundles\}/);
  assert.match(dialogSource, /bundles\?: CFBundle\[\]/);
  assert.match(dialogSource, /selectedBundleId/);
  assert.match(dialogSource, /Выберите кампанию/);
  assert.match(dialogSource, /Кампания/);
});

test("workspace routes use bundle and publication APIs", () => {
  const bundlesSource = readSource("app/content-factory/bundles/page.tsx");
  const bundleDetailSource = readSource("app/content-factory/bundles/[id]/page.tsx");
  const publicationSource = readSource(
    "app/content-factory/publications/[id]/page.tsx",
  );
  const versionListSource = readSource(
    "components/content-factory/ContentFactoryPublicationVersionList.tsx",
  );

  assert.match(bundlesSource, /api\.getCFBundles/);
  assert.match(bundlesSource, /ContentFactoryBundleDialog/);
  assert.match(bundleDetailSource, /api\.getCFBundle/);
  assert.match(bundleDetailSource, /api\.getCFPublicationsForBundle/);
  assert.match(bundleDetailSource, /ContentFactoryPublicationDialog/);
  assert.match(publicationSource, /api\.getCFPublication/);
  assert.match(publicationSource, /api\.getCFPublicationVersions/);
  assert.match(publicationSource, /ContentFactoryPublicationVersionList/);
  assert.match(versionListSource, /История публикации/);
  assert.match(versionListSource, /workflow/);
  assert.match(versionListSource, /version\.notes/);
});

test("publication detail route exposes Sprint 5 outcomes panels", () => {
  const source = readSource("app/content-factory/publications/[id]/page.tsx");

  assert.match(source, /api\.getCFSegments/);
  assert.match(source, /api\.getCFPublicationSegmentTargets/);
  assert.match(source, /api\.getCFMetrics/);
  assert.match(source, /ContentFactorySegmentTargetsPanel/);
  assert.match(source, /ContentFactoryMetricInsights/);
  assert.match(source, /ContentFactoryMetricHistory/);
  assert.match(source, /ContentFactoryUtmHelper/);
});

test("publication detail exposes metric insights above history", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryMetricInsights.tsx"),
    true,
  );

  const source = readSource("app/content-factory/publications/[id]/page.tsx");
  const insightsSource = readSource(
    "components/content-factory/ContentFactoryMetricInsights.tsx",
  );
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /ContentFactoryMetricInsights/);
  assert.match(source, /<ContentFactoryMetricInsights\s+metrics=\{metrics\}/);
  assert.ok(
    source.indexOf("<ContentFactoryMetricInsights") <
      source.indexOf("<ContentFactoryMetricHistory"),
  );
  assert.match(insightsSource, /Сводка метрик/);
  assert.match(insightsSource, /getContentFactoryPublicationMetricInsights/);
  assert.match(insightsSource, /insights\.groups/);
  assert.match(insightsSource, /insights\.windows/);
  assert.match(utilsSource, /getContentFactoryPublicationMetricInsights/);
});

test("publication detail route exposes publication operations panel", () => {
  const source = readSource("app/content-factory/publications/[id]/page.tsx");
  const panelSource = readSource(
    "components/content-factory/ContentFactoryPublicationOperationsPanel.tsx",
  );
  const workflowPanelSource = readSource(
    "components/content-factory/ContentFactoryPublicationWorkflowActionsPanel.tsx",
  );
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /ContentFactoryPublicationOperationsPanel/);
  assert.match(source, /ContentFactoryPublicationWorkflowActionsPanel/);
  assert.match(source, /platform={platform}/);
  assert.match(source, /segmentTargets={segmentTargets}/);
  assert.match(source, /savedVariants={variants}/);
  assert.match(workflowPanelSource, /Быстрые действия/);
  assert.match(workflowPanelSource, /getContentFactoryPublicationWorkflowActions/);
  assert.match(workflowPanelSource, /api\.updateCFPublication/);
  assert.match(workflowPanelSource, /targetStatus/);
  assert.match(workflowPanelSource, /Сначала укажите плановую дату/);
  assert.match(panelSource, /Публикация и статистика/);
  assert.match(panelSource, /Чек-лист готовности/);
  assert.match(panelSource, /getContentFactoryPublicationReadiness/);
  assert.match(panelSource, /getContentFactoryPublicationVariantCoverage/);
  assert.match(panelSource, /savedVariants/);
  assert.match(utilsSource, /Текст публикации/);
  assert.match(utilsSource, /Дата в плане/);
  assert.match(utilsSource, /UTM-метки/);
  assert.match(utilsSource, /Адаптации/);
  assert.match(utilsSource, /Аудитория/);
  assert.match(utilsSource, /Факт выхода/);
  assert.match(utilsSource, /Первые метрики/);
  assert.match(panelSource, /Отметить как опубликовано/);
  assert.match(panelSource, /canSavePublishFact/);
  assert.match(panelSource, /publishFactDisabledReason/);
  assert.match(panelSource, /api\.updateCFPublication/);
  assert.match(panelSource, /platform_post_url/);
  assert.match(utilsSource, /ContentFactoryPublicationWorkflowAction/);
  assert.match(utilsSource, /getContentFactoryPublicationWorkflowActions/);
  assert.match(utilsSource, /getContentFactoryPlatformCapabilities/);
  assert.match(utilsSource, /getContentFactoryPublicationOperations/);
  assert.match(utilsSource, /getContentFactoryPublicationReadiness/);
});

test("publication detail route exposes manual publish package", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryPublicationPublishPackage.tsx"),
    true,
  );

  const source = readSource("app/content-factory/publications/[id]/page.tsx");
  const packageSource = readSource(
    "components/content-factory/ContentFactoryPublicationPublishPackage.tsx",
  );
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /ContentFactoryPublicationPublishPackage/);
  assert.match(source, /platform={platform}/);
  assert.match(source, /format={format}/);
  assert.match(source, /segmentTargets={segmentTargets}/);
  assert.match(packageSource, /Пакет для публикации/);
  assert.match(packageSource, /Скопировать пакет/);
  assert.match(packageSource, /navigator\.clipboard\.writeText/);
  assert.match(packageSource, /buildContentFactoryPublishPackage/);
  assert.match(utilsSource, /buildContentFactoryPublishPackage/);
  assert.match(utilsSource, /ContentFactoryPublishPackage/);
});

test("publication detail route exposes manual channel adaptations", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryPublicationVariants.tsx"),
    true,
  );

  const source = readSource("app/content-factory/publications/[id]/page.tsx");
  const variantsSource = readSource(
    "components/content-factory/ContentFactoryPublicationVariants.tsx",
  );
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /ContentFactoryPublicationVariants/);
  assert.match(source, /publication={publication}/);
  assert.match(source, /platform={platform}/);
  assert.match(source, /format={format}/);
  assert.match(source, /bundle={bundle}/);
  assert.match(source, /api\.getCFPublicationVariants\(id\)/);
  assert.match(source, /setVariants\(variantRes\)/);
  assert.match(source, /savedVariants={variants}/);
  assert.match(source, /onSaved={handleSaved}/);
  assert.ok(
    source.indexOf("<ContentFactoryPublicationPublishPackage") <
      source.indexOf("<ContentFactoryPublicationVariants"),
  );
  assert.match(variantsSource, /Адаптации/);
  assert.match(variantsSource, /Скопировать адаптацию/);
  assert.match(variantsSource, /Сохранить адаптацию/);
  assert.match(variantsSource, /Заметки/);
  assert.match(variantsSource, /savedVariants/);
  assert.match(variantsSource, /api\.upsertCFPublicationVariant/);
  assert.match(variantsSource, /navigator\.clipboard\.writeText/);
  assert.match(variantsSource, /buildContentFactoryPublicationVariants/);
  assert.match(variantsSource, /getContentFactoryPublicationVariantCoverage/);
  assert.match(variantsSource, /buildContentFactoryPublicationVariantHandoff/);
  assert.match(variantsSource, /Скопировать готовые/);
  assert.match(variantsSource, /Готовность адаптаций/);
  assert.match(variantsSource, /source_version_number/);
  assert.match(utilsSource, /buildContentFactoryPublicationVariants/);
  assert.match(utilsSource, /getContentFactoryPublicationVariantCoverage/);
  assert.match(utilsSource, /buildContentFactoryPublicationVariantHandoff/);
  assert.match(utilsSource, /ContentFactoryPublicationVariant/);
});

test("metric capture surfaces use readable labels and presets", () => {
  const dialogSource = readSource(
    "components/content-factory/ContentFactoryMetricDialog.tsx",
  );
  const historySource = readSource(
    "components/content-factory/ContentFactoryMetricHistory.tsx",
  );
  const importDialogSource = sourceExists(
    "components/content-factory/ContentFactoryMetricImportDialog.tsx",
  )
    ? readSource("components/content-factory/ContentFactoryMetricImportDialog.tsx")
    : "";
  const effectivenessSource = readSource(
    "components/content-factory/ContentFactoryEffectivenessTable.tsx",
  );
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(utilsSource, /CF_METRIC_WINDOW_LABELS/);
  assert.match(utilsSource, /CF_METRIC_SOURCE_LABELS/);
  assert.match(utilsSource, /CF_CONFIDENCE_LABELS/);
  assert.match(utilsSource, /CONTENT_FACTORY_METRIC_PRESETS/);
  assert.match(dialogSource, /CONTENT_FACTORY_METRIC_PRESETS/);
  assert.match(dialogSource, /Быстрый выбор/);
  assert.match(dialogSource, /CF_METRIC_WINDOW_LABELS/);
  assert.match(dialogSource, /CF_METRIC_SOURCE_LABELS/);
  assert.match(dialogSource, /CF_CONFIDENCE_LABELS/);
  assert.match(historySource, /CF_METRIC_WINDOW_LABELS/);
  assert.match(historySource, /CF_METRIC_SOURCE_LABELS/);
  assert.match(historySource, /CF_CONFIDENCE_LABELS/);
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryMetricImportDialog.tsx"),
    true,
  );
  assert.match(historySource, /ContentFactoryMetricImportDialog/);
  assert.match(historySource, /Импорт/);
  assert.match(importDialogSource, /parseContentFactoryMetricImportRows/);
  assert.match(importDialogSource, /api\.recordCFMetric/);
  assert.doesNotMatch(historySource, /доверие \{metric\.confidence\}/);
  assert.match(effectivenessSource, /CF_METRIC_WINDOW_LABELS/);
  assert.match(effectivenessSource, /CF_METRIC_SOURCE_LABELS/);
  assert.match(effectivenessSource, /CF_CONFIDENCE_LABELS/);
  assert.doesNotMatch(effectivenessSource, /\{latestMetric\.window\}/);
  assert.doesNotMatch(effectivenessSource, /\{latestMetric\.confidence\}/);
});

test("review queue route groups publications by workflow status", () => {
  const source = readSource("app/content-factory/review/page.tsx");
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /api\.getCFPublications/);
  assert.match(source, /getContentFactoryReviewQueueGroups/);
  assert.match(source, /getContentFactoryReviewQueueItemSignal/);
  assert.match(source, /summarizeContentFactoryReviewQueue/);
  assert.match(source, /Сейчас нужно/);
  assert.match(source, /Срочно/);
  assert.match(source, /Открыть/);
  assert.match(source, /\/content-factory\/publications\/\$\{publication\.id\}/);
  assert.match(utilsSource, /ContentFactoryReviewQueueItemSignal/);
  assert.match(utilsSource, /summarizeContentFactoryReviewQueue/);
  assert.doesNotMatch(utilsSource, /label:\s*"Approval"/);
  assert.doesNotMatch(utilsSource, /label:\s*"Scheduling"/);
  assert.doesNotMatch(utilsSource, /label:\s*"Failed"/);
});

test("retro dialog exposes create and update fields", () => {
  const source = readSource(
    "components/content-factory/ContentFactoryRetroDialog.tsx",
  );

  assert.match(source, /api\.createCFRetro/);
  assert.match(source, /api\.updateCFRetro/);
  assert.match(source, /Что сработало/);
  assert.match(source, /Что сломалось/);
  assert.match(source, /Выводы/);
  assert.match(source, /Решения/);
  assert.match(source, /Следующие действия/);
  assert.doesNotMatch(source, />best_by_objective</);
  assert.doesNotMatch(source, />broken</);
  assert.doesNotMatch(source, />learnings</);
  assert.doesNotMatch(source, />decisions</);
  assert.doesNotMatch(source, />actions</);
  assert.doesNotMatch(source, /JSON object/);
  assert.doesNotMatch(source, /JSON array/);
});

test("retros route lists retro cards and opens create dialog", () => {
  const source = readSource("app/content-factory/retros/page.tsx");

  assert.match(source, /api\.getCFRetros/);
  assert.match(source, /ContentFactoryRetroDialog/);
  assert.match(source, /getContentFactoryRetroTitle/);
  assert.match(source, /\/content-factory\/retros\/\$\{retro\.id\}/);
});

test("retro detail route loads and edits retrospective notes", () => {
  const source = readSource("app/content-factory/retros/[id]/page.tsx");

  assert.match(source, /api\.getCFRetro/);
  assert.match(source, /ContentFactoryRetroDialog/);
  assert.match(source, /summarizeContentFactoryRetroSections/);
  assert.match(source, /Что сработало/);
  assert.match(source, /Что сломалось/);
  assert.match(source, /Выводы/);
  assert.match(source, /Решения/);
  assert.match(source, /Следующие действия/);
  assert.doesNotMatch(source, /title="Broken"/);
  assert.doesNotMatch(source, /title="Actions"/);
});

test("reference admin components expose table and dialog behavior", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryReferenceDialog.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryReferenceTable.tsx"),
    true,
  );

  const dialogSource = readSource(
    "components/content-factory/ContentFactoryReferenceDialog.tsx",
  );
  const tableSource = readSource(
    "components/content-factory/ContentFactoryReferenceTable.tsx",
  );

  assert.match(dialogSource, /api\.createCFPlatform/);
  assert.match(dialogSource, /api\.updateCFPlatform/);
  assert.match(dialogSource, /api\.createCFFunnelTemplate/);
  assert.match(dialogSource, /api\.updateCFFunnelTemplate/);
  assert.match(dialogSource, /capabilities/);
  assert.match(dialogSource, /template_publications/);
  assert.match(dialogSource, /requires_medical_review/);
  assert.match(dialogSource, /is_active/);
  assert.match(tableSource, /onEdit/);
  assert.match(tableSource, /onDelete/);
  assert.match(tableSource, /isAdmin/);
});

test("reference admin route loads inactive dictionaries and gates mutations", () => {
  assert.equal(sourceExists("app/content-factory/references/page.tsx"), true);

  const source = readSource("app/content-factory/references/page.tsx");

  assert.match(source, /ContentFactoryReferencesPage/);
  assert.match(source, /api\.getCFPlatforms\(\{ only_active: false \}\)/);
  assert.match(source, /api\.getCFFormats\(\{ only_active: false \}\)/);
  assert.match(source, /api\.getCFRubrics\(\{ only_active: false \}\)/);
  assert.match(source, /api\.getCFNosologies\(\{ only_active: false \}\)/);
  assert.match(source, /api\.getCFFunnelTemplates\(\{ only_active: false \}\)/);
  assert.match(source, /PermissionService\.isAdmin/);
  assert.match(source, /ContentFactoryReferenceDialog/);
  assert.match(source, /ContentFactoryReferenceTable/);
});

test("segment workspace components expose create refresh and snapshots", () => {
  assert.equal(
    sourceExists("components/content-factory/ContentFactorySegmentDialog.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactorySegmentRefreshDialog.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactorySegmentSnapshotList.tsx"),
    true,
  );

  const createDialogSource = readSource(
    "components/content-factory/ContentFactorySegmentDialog.tsx",
  );
  const refreshDialogSource = readSource(
    "components/content-factory/ContentFactorySegmentRefreshDialog.tsx",
  );
  const snapshotSource = readSource(
    "components/content-factory/ContentFactorySegmentSnapshotList.tsx",
  );

  assert.match(createDialogSource, /api\.createCFSegment/);
  assert.match(createDialogSource, /source_segment_id/);
  assert.match(createDialogSource, /population_count/);
  assert.match(refreshDialogSource, /api\.refreshCFSegment/);
  assert.match(refreshDialogSource, /population_count/);
  assert.match(snapshotSource, /compareContentFactorySegmentSnapshots/);
  assert.match(snapshotSource, /formatContentFactorySegmentCount/);
});

test("segment workspace routes load registry detail and snapshot history", () => {
  assert.equal(sourceExists("app/content-factory/segments/page.tsx"), true);
  assert.equal(sourceExists("app/content-factory/segments/[id]/page.tsx"), true);

  const listSource = readSource("app/content-factory/segments/page.tsx");
  const detailSource = readSource("app/content-factory/segments/[id]/page.tsx");

  assert.match(listSource, /ContentFactorySegmentsPage/);
  assert.match(listSource, /api\.getCFSegments\(\{ only_active: false \}\)/);
  assert.match(listSource, /ContentFactorySegmentDialog/);
  assert.match(listSource, /ContentFactorySegmentRefreshDialog/);
  assert.match(listSource, /filterContentFactorySegments/);
  assert.match(listSource, /\/content-factory\/segments\/\$\{segment\.id\}/);
  assert.match(detailSource, /ContentFactorySegmentDetailPage/);
  assert.match(detailSource, /api\.getCFSegment/);
  assert.match(detailSource, /api\.getCFSegmentSnapshots/);
  assert.match(detailSource, /ContentFactorySegmentRefreshDialog/);
  assert.match(detailSource, /ContentFactorySegmentSnapshotList/);
});

test("segment analytics route loads usage evidence and is linked from registry", () => {
  assert.equal(
    sourceExists("app/content-factory/segments/analytics/page.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactorySegmentUsageTable.tsx"),
    true,
  );

  const registrySource = readSource("app/content-factory/segments/page.tsx");
  const analyticsSource = readSource(
    "app/content-factory/segments/analytics/page.tsx",
  );
  const tableSource = readSource(
    "components/content-factory/ContentFactorySegmentUsageTable.tsx",
  );

  assert.match(registrySource, /\/content-factory\/segments\/analytics/);
  assert.match(analyticsSource, /ContentFactorySegmentAnalyticsPage/);
  assert.match(analyticsSource, /api\.getCFSegments\(\{ only_active: false \}\)/);
  assert.match(analyticsSource, /api\.getCFPublications\(\{ limit: 500 \}\)/);
  assert.match(analyticsSource, /api\.getCFBundles\(\{ limit: 500 \}\)/);
  assert.match(analyticsSource, /api\.getCFPublicationSegmentTargets/);
  assert.match(analyticsSource, /api\.getCFMetrics/);
  assert.match(analyticsSource, /buildContentFactorySegmentUsageRows/);
  assert.match(analyticsSource, /summarizeContentFactorySegmentUsage/);
  assert.match(analyticsSource, /filterContentFactorySegmentUsageRows/);
  assert.match(tableSource, /ContentFactorySegmentUsageTable/);
  assert.match(tableSource, /\/content-factory\/segments\/\$\{row\.segment\.id\}/);
  assert.match(
    tableSource,
    /\/content-factory\/publications\/\$\{item\.publication\.id\}/,
  );
});

test("effectiveness route loads outcome evidence and is linked from workspace navigation", () => {
  assert.equal(sourceExists("app/content-factory/effectiveness/page.tsx"), true);
  assert.equal(
    sourceExists(
      "components/content-factory/ContentFactoryEffectivenessTable.tsx",
    ),
    true,
  );

  const routeSource = readSource("app/content-factory/effectiveness/page.tsx");
  const tableSource = readSource(
    "components/content-factory/ContentFactoryEffectivenessTable.tsx",
  );
  const uiSource = readSource("lib/contentFactoryUi.ts");
  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );
  const headerSource = readSource("components/layout/Header.tsx");
  const helpSource = readSource("app/content-factory/help/page.tsx");

  assert.match(uiSource, /\/content-factory\/effectiveness/);
  assert.match(uiSource, /Эффективность/);
  assert.match(navSource, /\/content-factory\/effectiveness/);
  assert.match(headerSource, /\/content-factory\/effectiveness/);
  assert.match(headerSource, /Эффективность/);
  assert.match(helpSource, /CONTENT_FACTORY_SECTIONS/);
  assert.match(routeSource, /ContentFactoryEffectivenessPage/);
  assert.match(routeSource, /api\.getCFPublications\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFBundles\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFPlatforms\(\)/);
  assert.match(routeSource, /api\.getCFFormats\(\)/);
  assert.match(routeSource, /api\.getCFPublicationSegmentTargets/);
  assert.match(routeSource, /api\.getCFMetrics/);
  assert.match(routeSource, /buildContentFactoryEffectivenessRows/);
  assert.match(routeSource, /summarizeContentFactoryEffectiveness/);
  assert.match(routeSource, /filterContentFactoryEffectivenessRows/);
  assert.match(tableSource, /ContentFactoryEffectivenessTable/);
  assert.match(
    tableSource,
    /\/content-factory\/publications\/\$\{row\.publication\.id\}/,
  );
  assert.match(tableSource, /\/content-factory\/bundles\/\$\{row\.bundle\.id\}/);
});

test("guest story workspace exposes list create edit and navigation", () => {
  assert.equal(sourceExists("app/content-factory/guests/page.tsx"), true);
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryGuestStoryDialog.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryGuestStoryTable.tsx"),
    true,
  );

  const routeSource = readSource("app/content-factory/guests/page.tsx");
  const dialogSource = readSource(
    "components/content-factory/ContentFactoryGuestStoryDialog.tsx",
  );
  const tableSource = readSource(
    "components/content-factory/ContentFactoryGuestStoryTable.tsx",
  );
  const uiSource = readSource("lib/contentFactoryUi.ts");
  const navSource = readSource(
    "components/content-factory/ContentFactoryWorkspaceNav.tsx",
  );
  const headerSource = readSource("components/layout/Header.tsx");
  const helpSource = readSource("app/content-factory/help/page.tsx");

  assert.match(uiSource, /\/content-factory\/guests/);
  assert.match(uiSource, /Гости и истории/);
  assert.match(navSource, /\/content-factory\/guests/);
  assert.match(headerSource, /\/content-factory\/guests/);
  assert.match(headerSource, /Гости и истории/);
  assert.match(helpSource, /гост/i);
  assert.match(routeSource, /ContentFactoryGuestsPage/);
  assert.match(routeSource, /api\.getCFGuestStories\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getTeam/);
  assert.match(routeSource, /api\.getCFBundles\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFPublications\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFNosologies\(\{ only_active: false \}\)/);
  assert.match(routeSource, /summarizeContentFactoryGuestStories/);
  assert.match(routeSource, /filterContentFactoryGuestStories/);
  assert.match(routeSource, /sortContentFactoryGuestStoriesByAttention/);
  assert.match(routeSource, /attentionFilter/);
  assert.match(routeSource, /Требуют внимания/);
  assert.doesNotMatch(routeSource, /xl:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(routeSource, /sm:text-right/);
  assert.match(routeSource, /ContentFactoryGuestStoryDialog/);
  assert.match(routeSource, /ContentFactoryGuestStoryTable/);
  assert.match(dialogSource, /api\.createCFGuestStory/);
  assert.match(dialogSource, /api\.updateCFGuestStory/);
  assert.match(dialogSource, /Кто это/);
  assert.match(dialogSource, /Согласие и границы/);
  assert.match(tableSource, /ContentFactoryGuestStoryTable/);
  assert.match(tableSource, /getContentFactoryGuestAttention/);
  assert.match(tableSource, /Следующее действие/);
  assert.match(tableSource, /\/content-factory\/bundles\/\$\{bundle\.id\}/);
  assert.match(
    tableSource,
    /\/content-factory\/publications\/\$\{publication\.id\}/,
  );
});

test("guest story detail route exposes readable story context", () => {
  assert.equal(sourceExists("app/content-factory/guests/[id]/page.tsx"), true);
  assert.equal(
    sourceExists(
      "components/content-factory/ContentFactoryGuestStoryDetailPanels.tsx",
    ),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryGuestActivityPanel.tsx"),
    true,
  );
  assert.equal(
    sourceExists("components/content-factory/ContentFactoryGuestAttentionPanel.tsx"),
    true,
  );
  assert.equal(
    sourceExists(
      "components/content-factory/ContentFactoryGuestStageTimelinePanel.tsx",
    ),
    true,
  );

  const routeSource = readSource("app/content-factory/guests/[id]/page.tsx");
  const panelSource = readSource(
    "components/content-factory/ContentFactoryGuestStoryDetailPanels.tsx",
  );
  const activitySource = readSource(
    "components/content-factory/ContentFactoryGuestActivityPanel.tsx",
  );
  const attentionSource = readSource(
    "components/content-factory/ContentFactoryGuestAttentionPanel.tsx",
  );
  const timelineSource = readSource(
    "components/content-factory/ContentFactoryGuestStageTimelinePanel.tsx",
  );
  const tableSource = readSource(
    "components/content-factory/ContentFactoryGuestStoryTable.tsx",
  );

  assert.match(tableSource, /\/content-factory\/guests\/\$\{story\.id\}/);
  assert.match(routeSource, /ContentFactoryGuestDetailPage/);
  assert.match(routeSource, /api\.getCFGuestStory\(id\)/);
  assert.match(routeSource, /api\.getCFGuestStoryEvents\(id\)/);
  assert.match(routeSource, /api\.getTeam/);
  assert.match(routeSource, /api\.getCFBundles\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFPublications\(\{ limit: 500 \}\)/);
  assert.match(routeSource, /api\.getCFNosologies\(\{ only_active: false \}\)/);
  assert.match(routeSource, /ContentFactoryGuestStoryDetailPanels/);
  assert.match(routeSource, /ContentFactoryGuestAttentionPanel/);
  assert.match(routeSource, /ContentFactoryGuestStageTimelinePanel/);
  assert.match(routeSource, /events=\{events\}/);
  assert.match(routeSource, /ContentFactoryGuestActivityPanel/);
  assert.match(routeSource, /ContentFactoryGuestStoryDialog/);
  assert.match(routeSource, /setPageTitle/);
  assert.match(panelSource, /История/);
  assert.match(panelSource, /Согласие и границы/);
  assert.match(panelSource, /Связи/);
  assert.match(panelSource, /\/content-factory\/bundles\/\$\{bundle\.id\}/);
  assert.match(
    panelSource,
    /\/content-factory\/publications\/\$\{publication\.id\}/,
  );
  assert.match(activitySource, /Журнал истории/);
  assert.match(activitySource, /api\.createCFGuestStoryEvent/);
  assert.match(activitySource, /parent_event_id/);
  assert.match(activitySource, /replyingToEvent/);
  assert.match(activitySource, /Ответить/);
  assert.match(activitySource, /Отменить ответ/);
  assert.match(activitySource, /renderEventThread/);
  assert.match(activitySource, /Комментарий/);
  assert.match(activitySource, /Статус изменён/);
  assert.match(attentionSource, /getContentFactoryGuestAttention/);
  assert.match(attentionSource, /Следующее действие/);
  assert.match(attentionSource, /Сейчас без срочных действий/);
  assert.match(timelineSource, /Путь истории/);
  assert.match(timelineSource, /buildContentFactoryGuestStageTimeline/);
  assert.match(timelineSource, /Назначьте следующий шаг/);
  assert.match(timelineSource, /Текущий этап/);
});
