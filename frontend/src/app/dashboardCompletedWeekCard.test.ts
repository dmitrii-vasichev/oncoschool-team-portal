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
