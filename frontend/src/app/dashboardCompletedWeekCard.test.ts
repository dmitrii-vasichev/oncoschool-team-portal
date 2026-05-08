import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readSource(relativePath: string) {
  return readFileSync(path.join(sourceRoot, relativePath), "utf8");
}

test("dashboard third task card shows completed tasks for the last 7 days", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /completedInScopeThisWeek/);
  assert.match(source, /completedWeekTasks/);
  assert.match(source, /done_week/);
  assert.match(source, /completed_since/);
  assert.match(source, /filterTasksCompletedSince/);
  assert.match(source, /sort: "completed_at_desc"/);
  assert.match(source, /Выполнено за 7 дней/);
  assert.match(source, /За последнюю неделю задач не завершали/);
  assert.match(source, /DashboardTaskBlock/);
  assert.match(source, /blockKey="completed"/);
  assert.match(source, /expandedTaskBlocks\.completed/);
  assert.match(source, /getDashboardTaskPreview/);
  assert.match(source, /Показать ещё/);
  assert.match(source, /Свернуть/);
  assert.match(source, /Сначала недавно выполненные/);
  assert.match(source, /itemVariant="completed"/);

  const completedBlock = source.match(
    /\{\/\* Completed Tasks \*\/\}[\s\S]*?\{\/\* ═══════════ Upcoming Meetings/,
  );
  assert.ok(completedBlock, "completed dashboard block source should exist");
  assert.doesNotMatch(completedBlock[0], /linkHref="\/tasks"/);

  assert.doesNotMatch(source, /completedWeekTasks\.slice\(0, 5\)\.map/);
  assert.doesNotMatch(source, /Не обновлялись/);
  assert.doesNotMatch(source, /scopedStaleTasks/);
});

test("dashboard overdue empty state is honest when active task data is truncated", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /scopedTasksTruncated/);
  assert.match(source, /scopedOverdueTasks\.length === 0/);
  assert.match(source, /В загруженных задачах просрочек нет/);
  assert.match(source, /Полный список может содержать ещё просроченные задачи\./);
  assert.match(source, /Всё в срок/);
  assert.match(source, /Нет просроченных задач/);
});
