import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("content factory types expose access flag and core models", () => {
  const source = readSource("lib/types.ts");

  assert.match(source, /has_content_factory_access:\s*boolean/);
  assert.match(source, /export interface CFBundle/);
  assert.match(source, /export interface CFPublication/);
});

test("content factory API client exposes Sprint 3 endpoints", () => {
  const source = readSource("lib/api.ts");

  assert.match(source, /async getCFPlatforms/);
  assert.match(source, /async getCFBundles/);
  assert.match(source, /async getCFPublications/);
  assert.match(source, /\/api\/content-factory\/platforms/);
  assert.match(source, /\/api\/content-factory\/bundles/);
  assert.match(source, /\/api\/content-factory\/publications/);
});

test("permission service exposes content factory access helper", () => {
  const source = readSource("lib/permissions.ts");

  assert.match(source, /canAccessContentFactory/);
  assert.match(source, /has_content_factory_access/);
});
