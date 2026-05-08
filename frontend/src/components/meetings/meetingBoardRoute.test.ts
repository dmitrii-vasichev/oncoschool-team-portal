import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("meeting detail page exposes the meeting board entry point", () => {
  const source = readSource("app/meetings/[id]/page.tsx");

  assert.match(source, /LayoutDashboard/);
  assert.match(source, /href=\{`\/meetings\/\$\{meeting\.id\}\/board`\}/);
  assert.match(source, /Открыть доску встречи/);
});

test("meeting board route loads and renders board sections", () => {
  const source = readSource("app/meetings/[id]/board/page.tsx");

  assert.match(source, /api\.getMeetingBoard\(meetingId\)/);
  assert.match(source, /MEETING_BOARD_SECTIONS\.map/);
  assert.match(source, /MeetingBoardScopePanel/);
  assert.match(source, /MeetingBoardMaterials/);
  assert.match(source, /participantCount=\{board\.meeting\.participant_ids\.length\}/);
  assert.match(source, /toastError/);
});

test("meeting board components keep the required shareable-board affordances", () => {
  const header = readSource("components/meetings/MeetingBoardHeader.tsx");
  const section = readSource("components/meetings/MeetingBoardSection.tsx");
  const scopePanel = readSource("components/meetings/MeetingBoardScopePanel.tsx");
  const materials = readSource("components/meetings/MeetingBoardMaterials.tsx");

  assert.match(header, /К встрече/);
  assert.match(header, /formatMeetingHeaderDateTime/);
  assert.match(header, /Users/);
  assert.match(section, /getMeetingBoardSectionMeta/);
  assert.match(section, /isMeetingBoardTaskOverdue/);
  assert.match(section, /TaskCard/);
  assert.match(section, /dashed/);
  assert.match(scopePanel, /Настроить/);
  assert.match(scopePanel, /SheetContent/);
  assert.match(scopePanel, /TaskLabelPicker/);
  assert.match(scopePanel, /Фокус встречи/);
  assert.match(scopePanel, /focus_label_ids/);
  assert.match(scopePanel, /allowCreate=\{false\}/);
  assert.match(scopePanel, /getMeetingBoardScopeCounts/);
  assert.match(materials, /Материалы пока не добавлены/);
  assert.match(materials, /sanitizeMeetingBoardMaterialUrl/);
  assert.match(materials, /rel="noreferrer"/);
  assert.match(materials, /board_notes/);
});
