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
  assert.match(source, /async getCFSegment/);
  assert.match(source, /async refreshCFSegment/);
  assert.match(source, /async getCFSegmentSnapshots/);
  assert.match(source, /async getCFPublicationSegmentTargets/);
  assert.match(source, /async addCFPublicationSegmentTarget/);
  assert.match(source, /async removeCFPublicationSegmentTarget/);
  assert.match(source, /async recordCFMetric/);
  assert.match(source, /\/api\/content-factory\/segments\/\$\{id\}/);
  assert.match(source, /\/api\/content-factory\/segments\/\$\{segmentId\}\/snapshots/);
  assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/segment-targets/);
  assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/metrics/);
});

test("content factory API client exposes Sprint 6 retro endpoints", () => {
  const source = readSource("lib/api.ts");

  assert.match(source, /async getCFRetro/);
  assert.match(source, /async createCFRetro/);
  assert.match(source, /async updateCFRetro/);
  assert.match(source, /\/api\/content-factory\/retros\/\$\{id\}/);
  assert.match(source, /\/api\/content-factory\/retros",/);
});

test("content factory API client exposes Sprint 7 reference admin endpoints", () => {
  const source = readSource("lib/api.ts");

  assert.match(source, /only_active/);
  assert.match(source, /async createCFPlatform/);
  assert.match(source, /async updateCFPlatform/);
  assert.match(source, /async deleteCFPlatform/);
  assert.match(source, /async createCFFormat/);
  assert.match(source, /async updateCFFormat/);
  assert.match(source, /async deleteCFFormat/);
  assert.match(source, /async createCFRubric/);
  assert.match(source, /async updateCFRubric/);
  assert.match(source, /async deleteCFRubric/);
  assert.match(source, /async createCFNosology/);
  assert.match(source, /async updateCFNosology/);
  assert.match(source, /async deleteCFNosology/);
  assert.match(source, /async createCFFunnelTemplate/);
  assert.match(source, /async updateCFFunnelTemplate/);
  assert.match(source, /async deleteCFFunnelTemplate/);
  assert.match(source, /\/api\/content-factory\/platforms\/\$\{id\}/);
  assert.match(source, /\/api\/content-factory\/funnel-templates\/\$\{id\}/);
});

test("permission service exposes content factory access helper", () => {
  const source = readSource("lib/permissions.ts");

  assert.match(source, /canAccessContentFactory/);
  assert.match(source, /has_content_factory_access/);
});
