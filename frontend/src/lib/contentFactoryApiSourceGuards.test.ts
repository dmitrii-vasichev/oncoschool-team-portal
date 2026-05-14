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
  assert.match(source, /async getCFBundle/);
  assert.match(source, /async getCFPublications/);
  assert.match(source, /async createCFPublicationForBundle/);
  assert.match(source, /async getCFPublicationVersions/);
  assert.match(source, /\/api\/content-factory\/platforms/);
  assert.match(source, /\/api\/content-factory\/bundles/);
  assert.match(source, /\/api\/content-factory\/bundles\/\$\{id\}/);
  assert.match(source, /\/api\/content-factory\/bundles\/\$\{bundleId\}\/publications/);
  assert.match(source, /\/api\/content-factory\/publications/);
  assert.match(source, /\/api\/content-factory\/publications\/\$\{id\}\/versions/);
});

test("content factory API client exposes Sprint 5 outcomes endpoints", () => {
  const source = readSource("lib/api.ts");

  assert.match(source, /async createCFSegment/);
  assert.match(source, /async refreshCFSegment/);
  assert.match(source, /async getCFSegmentSnapshots/);
  assert.match(source, /async getCFPublicationSegmentTargets/);
  assert.match(source, /async addCFPublicationSegmentTarget/);
  assert.match(source, /async removeCFPublicationSegmentTarget/);
  assert.match(source, /async recordCFMetric/);
  assert.match(source, /\/api\/content-factory\/segments\/\$\{segmentId\}\/snapshots/);
  assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/segment-targets/);
  assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/metrics/);
});

test("permission service exposes content factory access helper", () => {
  const source = readSource("lib/permissions.ts");

  assert.match(source, /canAccessContentFactory/);
  assert.match(source, /has_content_factory_access/);
});
