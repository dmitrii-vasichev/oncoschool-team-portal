import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("rejected decision action is not rendered as a filled destructive button", () => {
  const source = readSource("components/ideas/IdeaDecisionPanel.tsx");

  assert.doesNotMatch(source, /variant=\{status === "rejected" \? "destructive" : "outline"\}/);
  assert.match(source, /variant="outline"/);
  assert.match(source, /border-destructive\/35 text-destructive/);
  assert.match(source, /hover:bg-destructive\/10/);
});
