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

test("dashboard task empty states use one compact icon pattern", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /function DashboardEmptyState/);
  assert.match(source, /icon:\s*ElementType/);
  assert.match(source, /text-sm font-heading font-semibold text-foreground/);
  assert.match(source, /text-xs text-muted-foreground/);

  const taskBlock = source.match(
    /\{\/\* Scoped Tasks \*\/\}[\s\S]*?\{\/\* Activity \*\//,
  );
  assert.ok(taskBlock, "merged dashboard task block source should exist");
  assert.match(taskBlock[0], /icon=\{ClipboardList\}/);
  assert.match(taskBlock[0], /<DashboardEmptyState[\s\S]*icon=\{ClipboardList\}/);
  assert.doesNotMatch(taskBlock[0], /<EmptyState/);
  assert.doesNotMatch(taskBlock[0], /variant="tasks"/);
});

test("dashboard task row groups overdue tasks inside the main task block", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /splitDashboardOpenTasks/);
  assert.match(source, /scopedOpenTaskGroups/);
  assert.match(source, /Просрочено/);
  assert.match(source, /Активные/);
  assert.doesNotMatch(source, /\/\* Overdue Tasks \*\//);
  assert.doesNotMatch(source, /blockKey="overdue"/);
});

test("dashboard activity card replaces the completed-week task card", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /DashboardActivityCard/);
  assert.match(source, /getDashboardActivity/);
  assert.match(source, /Активность за 7 дней/);
  assert.match(source, /Выполнено/);
  assert.match(source, /Создано/);
  assert.match(source, /В работе > 7 дней/);
  assert.match(source, /К прошлой неделе/);
  assert.doesNotMatch(source, /title="Выполнено за 7 дней"/);
  assert.doesNotMatch(source, /blockKey="completed"/);
});

test("dashboard activity metric rows expose icons and expansion affordance", () => {
  const source = readSource("app/page.tsx");
  const card = source.match(
    /function DashboardActivityCard[\s\S]*?\/\/ ────────────────────────────────────────────\n\/\/ Upcoming meeting card/,
  );

  assert.ok(card, "dashboard activity card source should exist");
  assert.match(source, /ChevronDown/);
  assert.match(source, /PlusCircle/);
  assert.match(source, /TimerReset/);
  assert.match(card[0], /icon:\s*ElementType/);
  assert.match(card[0], /icon:\s*CheckCircle2/);
  assert.match(card[0], /icon:\s*PlusCircle/);
  assert.match(card[0], /icon:\s*TimerReset/);
  assert.match(card[0], /aria-expanded=\{selectedMetric === key\}/);
  assert.match(card[0], /<Icon aria-hidden="true"/);
  assert.match(card[0], /<ChevronDown[\s\S]*aria-hidden="true"/);
});

test("dashboard task block uses responsive grouped columns and universal ordering copy", () => {
  const source = readSource("app/page.tsx");
  const block = source.match(
    /function DashboardTaskBlock[\s\S]*?function DashboardActivityCard/,
  );

  assert.ok(block, "dashboard task block source should exist");
  assert.match(source, /type DashboardTaskGroupKey = "overdue" \| "active"/);
  assert.match(block[0], /groupExpansion/);
  assert.match(block[0], /xl:grid-cols-2/);
  assert.match(block[0], /md:grid-cols-2/);
  assert.match(block[0], /dashboard-\$\{blockKey\}-\$\{group.key\}-tasks/);
  assert.match(
    source,
    /Задачи сгруппированы по состоянию и отсортированы по срочности\./,
  );
  assert.doesNotMatch(source, /Сначала просроченные/);
});

test("dashboard task badges avoid a red zero-overdue state", () => {
  const source = readSource("app/page.tsx");
  const badgeBlock = source.match(
    /const taskBadges: BadgeInfo\[] = \[[\s\S]*?const scopedMeetingsTotal/,
  );

  assert.ok(badgeBlock, "task badge source should exist");
  assert.match(
    badgeBlock[0],
    /if \(scopedOpenTaskGroups\.overdue\.length > 0\)/,
  );
  assert.doesNotMatch(badgeBlock[0], /value:\s*0/);
});
