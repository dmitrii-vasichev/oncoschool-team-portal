import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActiveTaskFilterChips,
  clearStructuredTaskFilters,
  countActiveStructuredTaskFilters,
  EMPTY_FILTERS,
  removeTaskFilterChip,
  type ActiveTaskFilterChip,
  type TaskFilterValues,
} from "./taskFilterUtils.ts";
import type { Department, TaskLabel, TeamMember } from "../../lib/types.ts";

function label(id: string, name: string): TaskLabel {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    color: "teal",
    created_by_id: null,
    is_archived: false,
    usage_count: 1,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    can_edit: false,
    can_archive: false,
    can_restore: false,
    is_shared_for_current_user: false,
  };
}

const departments: Department[] = [
  {
    id: "dept-dev",
    name: "Разработка",
    description: null,
    head_id: null,
    color: null,
    sort_order: 1,
    is_active: true,
    created_at: "2026-05-06T00:00:00Z",
  },
];

const members: TeamMember[] = [
  {
    id: "member-1",
    telegram_id: null,
    telegram_username: null,
    full_name: "Иван Петров",
    name_variants: [],
    department_id: "dept-dev",
    extra_department_ids: [],
    position: null,
    email: null,
    birthday: null,
    avatar_url: null,
    role: "member",
    is_test: false,
    is_active: true,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
  },
];

function filters(overrides: Partial<TaskFilterValues>): TaskFilterValues {
  return { ...EMPTY_FILTERS, ...overrides };
}

test("countActiveStructuredTaskFilters excludes search and counts label selection as one group", () => {
  const value = filters({
    search: "landing",
    labels: [label("label-vk", "VK"), label("label-site", "Site")],
    department_id: "dept-dev",
    assignee_id: "member-1",
    priority: "high",
    source: "voice",
  });

  assert.equal(
    countActiveStructuredTaskFilters(value, { showDepartmentFilter: true }),
    5
  );
});

test("countActiveStructuredTaskFilters ignores hidden department filter", () => {
  const value = filters({
    department_id: "dept-dev",
    source: "web",
  });

  assert.equal(
    countActiveStructuredTaskFilters(value, { showDepartmentFilter: false }),
    1
  );
});

test("buildActiveTaskFilterChips shows two labels plus overflow before other filters", () => {
  const value = filters({
    labels: [
      label("label-vk", "VK"),
      label("label-site", "Site"),
      label("label-crm", "CRM"),
    ],
    department_id: "dept-dev",
    assignee_id: "member-1",
    priority: "urgent",
    source: "summary",
  });

  const chips = buildActiveTaskFilterChips({
    filters: value,
    departments,
    members,
    showDepartmentFilter: true,
  });

  assert.deepEqual(
    chips.map((chip) => chip.label),
    [
      "VK",
      "Site",
      "+1 меток",
      "Отдел: Разработка",
      "Исполнитель: Иван Петров",
      "Срочность: Срочная",
      "Summary",
    ]
  );
});

test("buildActiveTaskFilterChips normalizes legacy priority filters to urgency labels", () => {
  assert.deepEqual(
    buildActiveTaskFilterChips({
      filters: filters({ priority: "high" }),
      departments,
      members,
      showDepartmentFilter: true,
    }).map((chip) => chip.label),
    ["Срочность: Срочная"]
  );

  assert.deepEqual(
    buildActiveTaskFilterChips({
      filters: filters({ priority: "low" }),
      departments,
      members,
      showDepartmentFilter: true,
    }).map((chip) => chip.label),
    ["Срочность: Обычная"]
  );
});

test("clearStructuredTaskFilters preserves search and clears structured fields", () => {
  const value = filters({
    search: "landing",
    labels: [label("label-vk", "VK")],
    department_id: "dept-dev",
    created_by_id: "member-1",
    priority: "low",
    source: "text",
  });

  assert.deepEqual(clearStructuredTaskFilters(value), {
    ...EMPTY_FILTERS,
    search: "landing",
  });
});

test("removeTaskFilterChip removes a selected label without clearing other labels", () => {
  const value = filters({
    labels: [
      label("label-vk", "VK"),
      label("label-site", "Site"),
    ],
  });
  const chip: ActiveTaskFilterChip = {
    type: "label",
    key: "label:label-vk",
    label: "VK",
    labelId: "label-vk",
  };

  assert.deepEqual(
    removeTaskFilterChip(value, chip).labels.map((item) => item.id),
    ["label-site"]
  );
});
