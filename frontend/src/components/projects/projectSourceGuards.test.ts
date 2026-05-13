import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("projects route exposes register and create affordances", () => {
  const source = readSource("app/projects/page.tsx");

  assert.match(source, /CreateProjectDialog/);
  assert.match(source, /ProjectFilters/);
  assert.match(source, /ProjectRegisterRow/);
});

test("projects filters expose text search and forward it to the API query", () => {
  const filters = readSource("components/projects/ProjectFilters.tsx");
  const page = readSource("app/projects/page.tsx");

  assert.match(filters, /search/);
  assert.match(filters, /Поиск/);
  assert.match(page, /params\.search/);
});

test("sidebar exposes projects navigation", () => {
  const source = readSource("components/layout/Sidebar.tsx");

  assert.match(source, /href:\s*"\/projects"/);
  assert.match(source, /label:\s*"Проекты"/);
});

test("project detail route composes operational detail panels", () => {
  const source = readSource("app/projects/[id]/page.tsx");

  assert.match(source, /ProjectStatusPanel/);
  assert.match(source, /ProjectDepartmentPanel/);
  assert.match(source, /ProjectMilestones/);
  assert.match(source, /ProjectLinkedTasks/);
  assert.match(source, /ProjectComments/);
  assert.match(source, /ProjectEventHistory/);
});
