import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

const ideaDropdownFiles = [
  "components/ideas/CreateIdeaDialog.tsx",
  "components/ideas/CreateIdeaTaskDialog.tsx",
  "components/ideas/IdeaDepartmentPanel.tsx",
  "components/ideas/IdeaFilters.tsx",
];

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("ideas dropdown controls use the portal styled select component", () => {
  for (const file of ideaDropdownFiles) {
    const source = readSource(file);

    assert.doesNotMatch(source, /<select\b/);
    assert.doesNotMatch(source, /<option\b/);
    assert.match(source, /from "@\/components\/ui\/select"/);
    assert.match(source, /<Select\b/);
    assert.match(source, /<SelectContent\b/);
  }
});

test("ideas selection controls avoid native browser pickers", () => {
  const createIdeaDialog = readSource("components/ideas/CreateIdeaDialog.tsx");
  const createIdeaTaskDialog = readSource("components/ideas/CreateIdeaTaskDialog.tsx");

  assert.doesNotMatch(createIdeaDialog, /type="checkbox"/);
  assert.match(createIdeaDialog, /role="checkbox"/);
  assert.match(createIdeaDialog, /<Check\b/);

  assert.doesNotMatch(createIdeaTaskDialog, /type="date"/);
  assert.match(createIdeaTaskDialog, /DatePicker/);
});
