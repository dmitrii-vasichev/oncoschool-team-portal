import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.task_urgency import normalize_task_urgency

# Domain value types
TaskStatusType = Literal["new", "in_progress", "review", "done", "cancelled"]
TaskPriorityType = Literal["normal", "urgent"]
TaskSourceType = Literal["text", "voice", "summary", "web"]
MemberRoleType = Literal["admin", "moderator", "member"]
MemberDeactivationStrategyType = Literal["unassign", "reassign"]
UpdateTypeType = Literal["progress", "status_change", "comment", "blocker", "completion"]
TelegramBroadcastStatusType = Literal["scheduled", "sent", "failed", "cancelled"]
MeetingReminderZoomMissingBehaviorType = Literal["hide", "fallback"]
ReminderDigestSectionKeyType = Literal["overdue", "upcoming", "in_progress", "new"]
ReminderTaskLineFieldKeyType = Literal["number", "title", "deadline", "priority"]
IdeaStatusType = Literal[
    "new",
    "in_review",
    "accepted",
    "in_tasks",
    "completed",
    "rejected",
    "deferred",
]
IdeaDepartmentStatusType = Literal["not_started", "in_progress", "ready", "not_required"]
IdeaEventType = Literal[
    "idea_created",
    "status_changed",
    "decision_recorded",
    "department_added",
    "department_updated",
    "task_linked",
    "comment_added",
    "project_created",
    "project_linked",
    "idea_completed",
    "idea_reopened",
    "idea_deleted",
]
ProjectStatusType = Literal["planned", "in_progress", "paused", "completed", "cancelled"]
ProjectDepartmentStatusType = Literal["not_started", "in_progress", "ready", "not_required"]
ProjectMilestoneStatusType = Literal["planned", "in_progress", "done"]
ProjectEventType = Literal[
    "project_created",
    "project_updated",
    "status_changed",
    "department_added",
    "department_updated",
    "milestone_added",
    "milestone_updated",
    "task_linked",
    "comment_added",
    "project_completed",
    "project_deleted",
]
# ── Content Factory types ──
CFProductStreamType = Literal[
    "onco_school", "nko", "medtourism", "alternative",
    "patient_live", "expert_live", "seasonal",
]
CFBundleStatusType = Literal["planning", "production", "live", "retrospective", "archived"]
CFPublicationStatusType = Literal[
    "draft", "needs_copy", "needs_design", "factcheck", "doctor_review",
    "approved", "scheduled", "published", "failed", "cancelled",
]
CFApprovalEventType = Literal[
    "drafted", "reviewed", "factchecked", "doctor_approved",
    "scheduled", "published", "rolled_back",
]
CFPublicationRelationType = Literal[
    "adapted_from", "follow_up_to", "reminder_for",
    "digest_includes", "replaces", "crosspost_of",
]
CFPublicationVariantChannelType = Literal["telegram", "vk", "email", "push", "max", "dzen"]
CFPublishingQueueStatusType = Literal[
    "queued",
    "processing",
    "succeeded",
    "failed",
    "manual_fallback",
    "cancelled",
]
CFPublishingQueueEventType = Literal[
    "queued",
    "started",
    "succeeded",
    "failed",
    "retry_requested",
    "manual_fallback",
    "cancelled",
]
CFSegmentRoleType = Literal["target", "exclusion", "control", "retargeting"]
CFMetricWindowType = Literal["3h", "24h", "72h", "7d", "final", "custom"]
CFMetricSourceType = Literal[
    "manual", "api", "tgstat", "telemetr", "vk_api",
    "email_provider", "getcourse", "parser", "import",
]
CFConfidenceType = Literal["high", "medium", "low"]
CFMetricImportRunStatusType = Literal["pending", "running", "succeeded", "failed", "partial"]
CFMetricImportRunTriggerType = Literal["manual", "scheduled", "system", "test"]
CFRetroType = Literal["weekly", "monthly", "bundle", "adhoc"]
CFSegmentSourceType = Literal["getcourse"]
CFGuestStoryRoleType = Literal[
    "patient", "relative", "doctor", "volunteer", "partner", "other"
]
CFGuestStorySourceType = Literal[
    "manual", "open_call", "referral", "screening_form", "partner", "other"
]
CFGuestStoryStatusType = Literal[
    "sourced", "applied", "editorial_screening", "shortlisted",
    "producer_call_scheduled", "producer_call_done",
    "medical_factcheck_needed", "doctor_approved",
    "consent_sent", "consent_signed", "scheduled",
    "prep_materials_sent", "live_or_recorded", "post_production",
    "published", "gift_sent", "follow_up_done",
    "maybe_later", "rejected", "archived",
]
CFGuestConsentStatusType = Literal[
    "not_started", "sent", "signed", "declined", "revoked", "expired"
]
CFGuestAnonymityLevelType = Literal[
    "full_name", "first_name", "anonymous", "pseudonym"
]
CFGuestGiftStatusType = Literal["not_required", "pending", "sent", "received"]
CFGuestStoryEventType = Literal[
    "created",
    "comment",
    "status_changed",
    "consent_changed",
    "gift_changed",
    "follow_up_changed",
]
MeetingAIProcessingStatusType = Literal[
    "idle",
    "queued",
    "recording_not_ready",
    "recording_ready",
    "transcribing",
    "transcript_ready",
    "draft_ready",
    "published",
    "failed",
]
MeetingTranscriptSourceType = Literal["manual", "zoom_api", "openai_audio"]


# ── TeamMember ──


class TeamMemberCreate(BaseModel):
    full_name: str
    role: MemberRoleType = "member"
    is_test: bool = False
    telegram_id: int | None = None
    telegram_username: str | None = None
    name_variants: list[str] = []
    department_id: uuid.UUID | None = None
    extra_department_ids: list[uuid.UUID] = Field(default_factory=list)
    position: str | None = None
    email: str | None = None
    birthday: date | None = None


class TeamMemberUpdate(BaseModel):
    telegram_id: int | None = None
    telegram_username: str | None = None
    full_name: str | None = None
    name_variants: list[str] | None = None
    role: MemberRoleType | None = None
    is_test: bool | None = None
    is_active: bool | None = None
    has_content_factory_access: bool | None = None
    department_id: uuid.UUID | None = None
    extra_department_ids: list[uuid.UUID] | None = None
    position: str | None = None
    email: str | None = None
    birthday: date | None = None
    deactivation_strategy: MemberDeactivationStrategyType | None = None
    reassign_to_member_id: uuid.UUID | None = None


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int | None
    telegram_username: str | None
    full_name: str
    name_variants: list[str]
    department_id: uuid.UUID | None
    extra_department_ids: list[uuid.UUID] = Field(default_factory=list)
    position: str | None
    email: str | None
    birthday: date | None
    avatar_url: str | None
    role: str
    is_test: bool
    is_active: bool
    has_content_factory_access: bool
    created_at: datetime
    updated_at: datetime


# ── Department ──


class DepartmentCreate(BaseModel):
    name: str
    description: str | None = None
    head_id: uuid.UUID | None = None
    color: str | None = None
    sort_order: int = 0


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    head_id: uuid.UUID | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    head_id: uuid.UUID | None
    color: str | None
    sort_order: int
    is_active: bool
    created_at: datetime


# ── Task ──


class TaskChecklistItem(BaseModel):
    id: str
    title: str
    is_completed: bool = False


class TaskLabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = None


class TaskLabelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = None


class TaskLabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    color: str
    created_by_id: uuid.UUID | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    usage_count: int = 0
    can_edit: bool = False
    can_archive: bool = False
    can_restore: bool = False
    is_shared_for_current_user: bool = False


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    checklist: list[TaskChecklistItem] = Field(default_factory=list)
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    source: TaskSourceType = "text"
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str:
        return normalize_task_urgency(value)


class TaskEdit(BaseModel):
    title: str | None = None
    description: str | None = None
    checklist: list[TaskChecklistItem] | None = None
    status: TaskStatusType | None = None
    priority: TaskPriorityType | None = None
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    reminder_at: datetime | None = None
    reminder_comment: str | None = None
    label_ids: list[uuid.UUID] | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_task_urgency(value)

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    short_id: int
    title: str
    description: str | None
    checklist: list[TaskChecklistItem] = Field(default_factory=list)
    status: str
    priority: str
    assignee_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    meeting_id: uuid.UUID | None
    source: str
    deadline: date | None
    reminder_at: datetime | None
    reminder_comment: str | None
    reminder_sent_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    assignee: TeamMemberResponse | None = None
    created_by: TeamMemberResponse | None = None
    labels: list[TaskLabelResponse] = Field(default_factory=list)


# ── Idea ──


class IdeaCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    review_owner_id: uuid.UUID
    department_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, min_length=1)
    review_owner_id: uuid.UUID | None = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaStatusChange(BaseModel):
    status: IdeaStatusType
    comment: str | None = Field(default=None, validate_default=True)
    deferred_until: date | None = None

    @field_validator("comment", mode="before")
    @classmethod
    def strip_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    @field_validator("comment")
    @classmethod
    def require_reason_for_negative_decisions(
        cls, value: str | None, info
    ) -> str | None:
        status = info.data.get("status")
        if status in {"rejected", "deferred"} and not value:
            raise ValueError("Reason is required for rejected or deferred ideas")
        return value


class IdeaDepartmentCreate(BaseModel):
    department_id: uuid.UUID
    owner_id: uuid.UUID


class IdeaDepartmentUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    status: IdeaDepartmentStatusType | None = None
    note: str | None = None


class IdeaCommentCreate(BaseModel):
    body: str = Field(min_length=1)

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaLinkedTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str:
        return normalize_task_urgency(value)


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    owner_id: uuid.UUID
    source_idea_id: uuid.UUID | None = None
    department_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, min_length=1)
    owner_id: uuid.UUID | None = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip()
        return value


class ProjectStatusChange(BaseModel):
    status: ProjectStatusType


class ProjectDepartmentCreate(BaseModel):
    department_id: uuid.UUID
    owner_id: uuid.UUID


class ProjectDepartmentUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    status: ProjectDepartmentStatusType | None = None
    note: str | None = None


class ProjectMilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    due_date: date | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class ProjectMilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: ProjectMilestoneStatusType | None = None
    due_date: date | None = None
    sort_order: int | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_optional_title(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip()
        return value


class ProjectCommentCreate(BaseModel):
    body: str = Field(min_length=1)

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class ProjectLinkedTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str:
        return normalize_task_urgency(value)


class IdeaEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    payload: dict
    created_at: datetime
    actor: TeamMemberResponse | None = None


class IdeaCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime
    updated_at: datetime
    author: TeamMemberResponse | None = None


class IdeaTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    idea_department_id: uuid.UUID | None
    task_id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    task: TaskResponse | None = None
    hidden: bool = False


class IdeaDepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    department_id: uuid.UUID
    owner_id: uuid.UUID
    status: str
    note: str | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    department: DepartmentResponse | None = None
    owner: TeamMemberResponse | None = None
    task_links: list[IdeaTaskResponse] = Field(default_factory=list)


class ProjectSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: str


class IdeaSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: str


class IdeaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: str
    project_id: uuid.UUID | None = None
    author_id: uuid.UUID
    review_owner_id: uuid.UUID
    decision_comment: str | None
    decision_by_id: uuid.UUID | None
    decision_at: datetime | None
    deferred_until: date | None
    completed_at: datetime | None
    deleted_at: datetime | None = None
    deleted_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    author: TeamMemberResponse | None = None
    review_owner: TeamMemberResponse | None = None
    decision_by: TeamMemberResponse | None = None
    project: ProjectSummaryResponse | None = None
    departments: list[IdeaDepartmentResponse] = Field(default_factory=list)
    task_links: list[IdeaTaskResponse] = Field(default_factory=list)
    comments: list[IdeaCommentResponse] = Field(default_factory=list)
    events: list[IdeaEventResponse] = Field(default_factory=list)
    linked_task_count: int = 0
    visible_linked_task_count: int = 0
    completed_linked_task_count: int = 0
    hidden_linked_task_count: int = 0
    ready_department_count: int = 0
    required_department_count: int = 0
    can_complete: bool = False
    can_delete: bool = False


class PaginatedIdeasResponse(BaseModel):
    items: list[IdeaResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ProjectEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    payload: dict
    created_at: datetime
    actor: TeamMemberResponse | None = None


class ProjectCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime
    updated_at: datetime
    author: TeamMemberResponse | None = None


class ProjectTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    project_department_id: uuid.UUID | None
    task_id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    task: TaskResponse | None = None
    hidden: bool = False


class ProjectDepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    department_id: uuid.UUID
    owner_id: uuid.UUID
    status: str
    note: str | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    department: DepartmentResponse | None = None
    owner: TeamMemberResponse | None = None
    task_links: list[ProjectTaskResponse] = Field(default_factory=list)


class ProjectMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: str
    due_date: date | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: str
    owner_id: uuid.UUID
    source_idea_id: uuid.UUID | None
    completed_at: datetime | None
    deleted_at: datetime | None = None
    deleted_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    owner: TeamMemberResponse | None = None
    source_idea: IdeaSummaryResponse | None = None
    departments: list[ProjectDepartmentResponse] = Field(default_factory=list)
    milestones: list[ProjectMilestoneResponse] = Field(default_factory=list)
    task_links: list[ProjectTaskResponse] = Field(default_factory=list)
    comments: list[ProjectCommentResponse] = Field(default_factory=list)
    events: list[ProjectEventResponse] = Field(default_factory=list)
    linked_task_count: int = 0
    visible_linked_task_count: int = 0
    completed_linked_task_count: int = 0
    hidden_linked_task_count: int = 0
    ready_department_count: int = 0
    required_department_count: int = 0
    completed_milestone_count: int = 0
    milestone_count: int = 0
    can_complete: bool = False
    can_delete: bool = False


class PaginatedProjectsResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── TaskUpdate ──


class TaskUpdateCreate(BaseModel):
    content: str
    update_type: UpdateTypeType = "progress"
    old_status: TaskStatusType | None = None
    new_status: TaskStatusType | None = None
    progress_percent: int | None = None
    source: str = "telegram"


class TaskUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    update_type: str
    old_status: str | None
    new_status: str | None
    progress_percent: int | None
    source: str
    created_at: datetime
    author: TeamMemberResponse | None = None


# ── Meeting ──


class MeetingCreate(BaseModel):
    title: str | None = None
    raw_summary: str
    parsed_summary: str | None = None
    decisions: list[str] = []
    notes: str | None = None
    meeting_date: datetime | None = None
    participant_ids: list[uuid.UUID] = []


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    raw_summary: str | None
    parsed_summary: str | None
    decisions: list[str]
    notes: str | None
    meeting_date: datetime | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    # New fields for Zoom integration & scheduling
    schedule_id: uuid.UUID | None = None
    zoom_meeting_id: str | None = None
    zoom_join_url: str | None = None
    zoom_recording_url: str | None = None
    transcript: str | None = None
    transcript_source: str | None = None
    status: str = "scheduled"
    duration_minutes: int = 60
    effective_status: str = "scheduled"
    participant_ids: list[uuid.UUID] = []
    schedule_recurrence: str | None = None
    is_schedule_template: bool = False


class MeetingBoardMaterial(BaseModel):
    id: str
    title: str
    url: str
    description: str | None = None


class MeetingBoardSettingsUpdate(BaseModel):
    added_member_ids: list[uuid.UUID] | None = None
    added_department_ids: list[uuid.UUID] | None = None
    pinned_task_ids: list[uuid.UUID] | None = None
    focus_label_ids: list[uuid.UUID] | None = None
    materials: list[MeetingBoardMaterial] | None = None
    board_notes: str | None = None


class MeetingBoardSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    added_member_ids: list[uuid.UUID] = Field(default_factory=list)
    added_department_ids: list[uuid.UUID] = Field(default_factory=list)
    pinned_task_ids: list[uuid.UUID] = Field(default_factory=list)
    focus_label_ids: list[uuid.UUID] = Field(default_factory=list)
    materials: list[MeetingBoardMaterial] = Field(default_factory=list)
    board_notes: str | None = None
    created_by_id: uuid.UUID | None = None
    updated_by_id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MeetingBoardResponse(BaseModel):
    meeting: MeetingResponse
    settings: MeetingBoardSettingsResponse
    urgent: list[TaskResponse] = Field(default_factory=list)
    new: list[TaskResponse] = Field(default_factory=list)
    in_progress: list[TaskResponse] = Field(default_factory=list)
    review: list[TaskResponse] = Field(default_factory=list)
    done_this_week: list[TaskResponse] = Field(default_factory=list)


class MeetingBoardTaskDraft(BaseModel):
    title: str
    description: str | None = None
    assignee_name: str | None = None
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    priority: TaskPriorityType = "normal"
    selected: bool = True


class MeetingAIProcessingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    status: MeetingAIProcessingStatusType
    transcript_source: MeetingTranscriptSourceType | None = None
    transcription_model: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    transcript_char_count: int | None = None
    audio_duration_seconds: int | None = None
    estimated_cost_usd: Decimal | None = None
    draft_summary: str | None = None
    draft_decisions: list[str] = Field(default_factory=list)
    draft_tasks: list[MeetingBoardTaskDraft] = Field(default_factory=list)
    published_at: datetime | None = None
    published_by_id: uuid.UUID | None = None
    transcription_requested_by_id: uuid.UUID | None = None
    transcription_phase: str | None = None
    transcription_progress_percent: int = 0
    transcription_current_chunk: int = 0
    transcription_total_chunks: int = 0
    transcription_source_bytes: int | None = None
    transcription_prepared_bytes: int | None = None
    transcription_attempt_count: int = 0
    transcription_last_heartbeat_at: datetime | None = None


class MeetingAIProcessingDraftUpdate(BaseModel):
    draft_summary: str
    draft_decisions: list[str] = Field(default_factory=list)
    draft_tasks: list[MeetingBoardTaskDraft] = Field(default_factory=list)


class MeetingAIPublishRequest(BaseModel):
    draft_summary: str
    draft_decisions: list[str] = Field(default_factory=list)
    draft_tasks: list[MeetingBoardTaskDraft] = Field(default_factory=list)


# ── MeetingSchedule ──


class MeetingScheduleCreate(BaseModel):
    title: str
    day_of_week: int | None = None  # 1-7
    time_local: str | None = None  # "15:00" — frontend sends local time
    timezone: str = "Europe/Moscow"
    duration_minutes: int = 60
    recurrence: str = "weekly"  # weekly | biweekly | monthly_last_workday | one_time | on_demand
    meeting_date_local: str | None = None  # "YYYY-MM-DDTHH:MM" for one_time/on_demand next run
    reminder_enabled: bool = True
    reminder_minutes_before: int = 60
    reminder_offsets_minutes: list[int] = Field(default_factory=lambda: [60, 0])
    reminder_text: str | None = None
    reminder_texts_by_offset: dict[str, str] = Field(default_factory=dict)
    reminder_include_zoom_link: bool = True
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType = "hide"
    reminder_zoom_missing_text: str | None = None
    telegram_targets: list[dict] = []  # [{"chat_id": ..., "thread_id": ...}]
    participant_ids: list[uuid.UUID] = []
    zoom_enabled: bool = True
    notify_participants: bool = False


class MeetingScheduleUpdate(BaseModel):
    title: str | None = None
    day_of_week: int | None = None
    time_local: str | None = None
    timezone: str | None = None
    duration_minutes: int | None = None
    recurrence: str | None = None
    meeting_date_local: str | None = None
    reminder_enabled: bool | None = None
    reminder_minutes_before: int | None = None
    reminder_offsets_minutes: list[int] | None = None
    reminder_text: str | None = None
    reminder_texts_by_offset: dict[str, str] | None = None
    reminder_include_zoom_link: bool | None = None
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType | None = None
    reminder_zoom_missing_text: str | None = None
    telegram_targets: list[dict] | None = None
    participant_ids: list[uuid.UUID] | None = None
    zoom_enabled: bool | None = None
    is_active: bool | None = None
    next_occurrence_skip: bool | None = None
    next_occurrence_time_local: str | None = None  # "HH:MM" local, converted to UTC
    next_occurrence_datetime_local: str | None = None  # "YYYY-MM-DDTHH:MM" local, converted to UTC
    notify_participants: bool | None = None


class MeetingScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    day_of_week: int
    time_utc: time
    timezone: str
    duration_minutes: int
    recurrence: str
    one_time_date: date | None = None
    next_occurrence_at: datetime | None = None
    reminder_enabled: bool
    reminder_minutes_before: int
    reminder_offsets_minutes: list[int]
    reminder_text: str | None
    reminder_texts_by_offset: dict[str, str]
    reminder_include_zoom_link: bool
    reminder_zoom_missing_behavior: MeetingReminderZoomMissingBehaviorType
    reminder_zoom_missing_text: str | None
    telegram_targets: list[dict]
    participant_ids: list[uuid.UUID]
    zoom_enabled: bool
    is_active: bool
    next_occurrence_skip: bool
    next_occurrence_time_override: time | None
    next_occurrence_date: date | None = None  # Computed, not stored in DB
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ── TelegramNotificationTarget ──


class TelegramTargetCreate(BaseModel):
    chat_id: int
    thread_id: int | None = None
    label: str | None = None
    types: list[str] = ["meeting"]
    allow_incoming_tasks: bool = False


class TelegramTargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_id: int
    thread_id: int | None
    label: str | None
    types: list[str]
    allow_incoming_tasks: bool
    is_active: bool
    created_at: datetime


# ── Telegram Broadcasts ──


class TelegramBroadcastImagePresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alias: str
    image_path: str
    preview_url: str
    is_active: bool
    sort_order: int
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class TelegramBroadcastCreate(BaseModel):
    target_id: uuid.UUID
    message_html: str
    scheduled_at: datetime | None = None
    send_now: bool = False


class TelegramBroadcastUpdate(BaseModel):
    target_id: uuid.UUID | None = None
    message_html: str | None = None
    scheduled_at: datetime | None = None


class TelegramBroadcastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    target_id: uuid.UUID
    chat_id: int
    thread_id: int | None
    target_label: str | None
    message_html: str
    image_path: str | None
    scheduled_at: datetime
    status: TelegramBroadcastStatusType
    created_by_id: uuid.UUID | None
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime


class TelegramBroadcastSendTargetResult(BaseModel):
    target_id: uuid.UUID
    chat_id: int
    thread_id: int | None
    target_label: str | None
    ok: bool
    error_message: str | None = None


class TelegramBroadcastSendResponse(BaseModel):
    sent_count: int
    failed_count: int
    results: list[TelegramBroadcastSendTargetResult]


# ── NotificationSubscription ──


class NotificationSubscriptionCreate(BaseModel):
    event_type: str
    is_active: bool = True


class NotificationSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_id: uuid.UUID
    event_type: str
    is_active: bool
    created_at: datetime


# ── InAppNotification ──


class InAppNotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    title: str
    body: str | None
    priority: str
    action_url: str | None
    task_short_id: int | None
    dedupe_key: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime
    actor: TeamMemberResponse | None = None


class InAppNotificationListResponse(BaseModel):
    items: list[InAppNotificationResponse]
    unread_count: int


# ── ReminderSettings ──


class ReminderSettingsCreate(BaseModel):
    member_id: uuid.UUID
    is_enabled: bool = False
    reminder_time: time = time(9, 0)
    timezone: str = "Europe/Moscow"
    days_of_week: list[int] = [1, 2, 3, 4, 5]
    include_overdue: bool = True
    include_upcoming: bool = True
    upcoming_days: int = Field(default=3, ge=0, le=7)
    include_in_progress: bool = True
    include_new: bool = True
    digest_sections_order: list[ReminderDigestSectionKeyType] = Field(
        default_factory=lambda: ["overdue", "upcoming", "in_progress", "new"]
    )
    task_line_show_number: bool = True
    task_line_show_title: bool = True
    task_line_show_deadline: bool = True
    task_line_show_priority: bool = True
    task_line_fields_order: list[ReminderTaskLineFieldKeyType] = Field(
        default_factory=lambda: ["number", "title", "deadline", "priority"]
    )


class ReminderSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    reminder_time: time | None = None
    timezone: str | None = None
    days_of_week: list[int] | None = None
    include_overdue: bool | None = None
    include_upcoming: bool | None = None
    upcoming_days: int | None = Field(default=None, ge=0, le=7)
    include_in_progress: bool | None = None
    include_new: bool | None = None
    digest_sections_order: list[ReminderDigestSectionKeyType] | None = None
    task_line_show_number: bool | None = None
    task_line_show_title: bool | None = None
    task_line_show_deadline: bool | None = None
    task_line_show_priority: bool | None = None
    task_line_fields_order: list[ReminderTaskLineFieldKeyType] | None = None


class ReminderSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_id: uuid.UUID
    is_enabled: bool
    reminder_time: time
    timezone: str
    days_of_week: list[int]
    include_overdue: bool
    include_upcoming: bool
    upcoming_days: int
    include_in_progress: bool
    include_new: bool
    digest_sections_order: list[ReminderDigestSectionKeyType]
    task_line_show_number: bool
    task_line_show_title: bool
    task_line_show_deadline: bool
    task_line_show_priority: bool
    task_line_fields_order: list[ReminderTaskLineFieldKeyType]
    configured_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ── AppSettings ──


class AppSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: dict
    updated_by_id: uuid.UUID | None
    updated_at: datetime


class AIProviderUpdate(BaseModel):
    provider: str
    model: str


# ── Reports ──


class DailyMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    metric_date: date
    source: str
    users_count: int
    payments_count: int
    payments_sum: Decimal
    orders_count: int
    orders_sum: Decimal
    collected_at: datetime
    collected_by_id: uuid.UUID | None = None


class DailyMetricWithDelta(DailyMetricResponse):
    """Single metric with delta vs previous day."""
    delta_users: int | None = None
    delta_payments_count: int | None = None
    delta_payments_sum: Decimal | None = None
    delta_orders_count: int | None = None
    delta_orders_sum: Decimal | None = None


class ReportSummaryResponse(BaseModel):
    """Aggregated summary for a period."""
    days: int
    date_from: date
    date_to: date
    total_users: int
    total_payments_count: int
    total_payments_sum: Decimal
    total_orders_count: int
    total_orders_sum: Decimal
    avg_users_per_day: float
    avg_payments_sum_per_day: float
    avg_orders_sum_per_day: float
    metrics: list[DailyMetricResponse]


class CollectRequest(BaseModel):
    date: date
    pause_minutes: int = 5  # minutes to wait between exports (min 5)


class CollectResponse(BaseModel):
    status: str  # "started" | "completed" | "already_exists"
    metric: DailyMetricResponse | None = None


class BackfillRequest(BaseModel):
    date_from: date
    date_to: date
    pause_minutes: int = 5  # minutes to wait between exports (min 5)


class BackfillResponse(BaseModel):
    status: str  # "started"
    total_dates: int


class ReportScheduleResponse(BaseModel):
    collection_time: str  # "HH:MM"
    send_time: str  # "HH:MM"
    timezone: str
    enabled: bool


class ReportScheduleUpdate(BaseModel):
    collection_time: str  # "HH:MM"
    send_time: str  # "HH:MM"
    timezone: str = "Europe/Moscow"
    enabled: bool = True


class GetCourseCredentialsResponse(BaseModel):
    configured: bool
    base_url: str | None = None
    updated_at: datetime | None = None


class GetCourseCredentialsUpdate(BaseModel):
    base_url: str
    api_key: str


# ── Content Factory: reference schemas ──

class CFPlatformBase(BaseModel):
    code: str = Field(..., max_length=50)
    display_name: str = Field(..., max_length=100)
    is_active: bool = True
    capabilities: dict = Field(default_factory=dict)
    display_order: int = 0


class CFPlatformCreate(CFPlatformBase):
    pass


class CFPlatformUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    capabilities: dict | None = None
    display_order: int | None = None


class CFPlatformResponse(CFPlatformBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class CFFormatBase(BaseModel):
    code: str = Field(..., max_length=50)
    display_name: str = Field(..., max_length=100)
    default_objective: str | None = None
    requires_medical_review: bool = False
    is_active: bool = True
    display_order: int = 0


class CFFormatCreate(CFFormatBase):
    pass


class CFFormatUpdate(BaseModel):
    display_name: str | None = None
    default_objective: str | None = None
    requires_medical_review: bool | None = None
    is_active: bool | None = None
    display_order: int | None = None


class CFFormatResponse(CFFormatBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class CFRubricBase(BaseModel):
    code: str = Field(..., max_length=50)
    display_name: str = Field(..., max_length=100)
    is_active: bool = True


class CFRubricCreate(CFRubricBase):
    pass


class CFRubricUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    deprecated_at: datetime | None = None


class CFRubricResponse(CFRubricBase):
    id: uuid.UUID
    deprecated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class CFNosologyBase(BaseModel):
    code: str = Field(..., max_length=50)
    display_name: str = Field(..., max_length=100)
    is_active: bool = True


class CFNosologyCreate(CFNosologyBase):
    pass


class CFNosologyUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    deprecated_at: datetime | None = None


class CFNosologyResponse(CFNosologyBase):
    id: uuid.UUID
    deprecated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class CFFunnelTemplateBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    description: str | None = None
    template_publications: list = Field(default_factory=list)
    is_active: bool = True


class CFFunnelTemplateCreate(CFFunnelTemplateBase):
    pass


class CFFunnelTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    template_publications: list | None = None
    is_active: bool | None = None


class CFFunnelTemplateResponse(CFFunnelTemplateBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


# ── Content Factory: core schemas ──

class CFExternalSegmentBase(BaseModel):
    source: CFSegmentSourceType = "getcourse"
    source_segment_id: str = Field(..., max_length=100)
    source_url: str | None = None
    name: str = Field(..., max_length=500)
    description: str | None = None
    population_count: int = 0
    is_active: bool = True


class CFExternalSegmentCreate(CFExternalSegmentBase):
    owner_id: uuid.UUID | None = None


class CFExternalSegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    population_count: int | None = None
    is_active: bool | None = None
    source_url: str | None = None


class CFExternalSegmentResponse(CFExternalSegmentBase):
    id: uuid.UUID
    last_fetched_at: datetime | None = None
    owner_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFSegmentSnapshotResponse(BaseModel):
    id: uuid.UUID
    external_segment_id: uuid.UUID
    fetched_at: datetime
    population_count: int
    notes: str | None = None
    model_config = ConfigDict(from_attributes=True)


class CFSegmentRefreshRequest(BaseModel):
    population_count: int = Field(..., ge=0)
    note: str | None = None


class CFBundleBase(BaseModel):
    name: str = Field(..., max_length=500)
    product_stream: CFProductStreamType
    status: CFBundleStatusType = "planning"
    event_date: datetime | None = None
    brief: str | None = None
    funnel_template_id: uuid.UUID | None = None
    source_material_refs: list = Field(default_factory=list)


class CFBundleCreate(CFBundleBase):
    owner_id: uuid.UUID


class CFBundleUpdate(BaseModel):
    name: str | None = None
    product_stream: CFProductStreamType | None = None
    status: CFBundleStatusType | None = None
    event_date: datetime | None = None
    brief: str | None = None
    funnel_template_id: uuid.UUID | None = None
    source_material_refs: list | None = None
    owner_id: uuid.UUID | None = None


class CFBundleResponse(CFBundleBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFPublicationBase(BaseModel):
    bundle_id: uuid.UUID
    platform_id: uuid.UUID
    format_id: uuid.UUID
    rubric_id: uuid.UUID | None = None
    nosology_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=500)
    body_text: str | None = None
    media_refs: list = Field(default_factory=list)
    scheduled_at: datetime | None = None
    status: CFPublicationStatusType = "draft"
    utm: dict = Field(default_factory=dict)


class CFPublicationCreate(CFPublicationBase):
    responsible_id: uuid.UUID


class CFPublicationUpdate(BaseModel):
    platform_id: uuid.UUID | None = None
    format_id: uuid.UUID | None = None
    rubric_id: uuid.UUID | None = None
    nosology_id: uuid.UUID | None = None
    responsible_id: uuid.UUID | None = None
    title: str | None = None
    body_text: str | None = None
    media_refs: list | None = None
    scheduled_at: datetime | None = None
    status: CFPublicationStatusType | None = None
    utm: dict | None = None
    actual_published_at: datetime | None = None
    platform_post_url: str | None = None
    platform_post_id: str | None = None
    cancelled_reason: str | None = None


class CFPublicationResponse(CFPublicationBase):
    id: uuid.UUID
    responsible_id: uuid.UUID
    actual_published_at: datetime | None = None
    platform_post_url: str | None = None
    platform_post_id: str | None = None
    version_number: int
    cancelled_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFPublicationVersionResponse(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    version_number: int
    body_text: str | None = None
    edited_by_id: uuid.UUID
    edited_at: datetime
    approval_event: CFApprovalEventType
    source_materials_refs: list
    notes: str | None = None
    model_config = ConfigDict(from_attributes=True)


class CFPublicationVariantUpsert(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    body_text: str = Field(..., min_length=1)
    notes: str | None = None

    @field_validator("body_text")
    @classmethod
    def validate_body_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("body_text must not be blank")
        return stripped

    @field_validator("title", "notes", mode="before")
    @classmethod
    def normalize_blank_optional_text(cls, value):
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class CFPublicationVariantResponse(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    channel: CFPublicationVariantChannelType
    title: str | None = None
    body_text: str
    notes: str | None = None
    source_version_number: int
    updated_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFPublishingQueueItemResponse(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    platform_id: uuid.UUID
    status: CFPublishingQueueStatusType
    scheduled_for: datetime | None = None
    requested_by_id: uuid.UUID
    attempts: int
    max_attempts: int
    last_attempt_at: datetime | None = None
    next_retry_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    manual_fallback_reason: str | None = None
    payload: dict = Field(default_factory=dict)
    provider_response: dict | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFPublishingQueueEventResponse(BaseModel):
    id: uuid.UUID
    queue_item_id: uuid.UUID
    publication_id: uuid.UUID
    actor_id: uuid.UUID | None = None
    event_type: CFPublishingQueueEventType
    message: str | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFPublishingQueueManualFallbackRequest(BaseModel):
    reason: str = Field(..., min_length=1)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("reason must not be blank")
        return stripped


class CFPublicationSegmentTargetCreate(BaseModel):
    external_segment_id: uuid.UUID
    role: CFSegmentRoleType = "target"
    expected_count: int | None = None


class CFPublicationSegmentTargetResponse(BaseModel):
    publication_id: uuid.UUID
    external_segment_id: uuid.UUID
    role: CFSegmentRoleType
    expected_count: int | None = None
    actual_count_at_send: int | None = None
    model_config = ConfigDict(from_attributes=True)


class CFMetricSnapshotCreate(BaseModel):
    publication_id: uuid.UUID
    window: CFMetricWindowType
    metric_name: str = Field(..., max_length=50)
    metric_value: Decimal | None = None
    metric_value_text: str | None = None
    source: CFMetricSourceType = "manual"
    source_method: str | None = None
    confidence: CFConfidenceType = "high"
    raw_payload: dict | None = None
    note: str | None = None
    captured_by_id: uuid.UUID | None = None
    source_config_id: uuid.UUID | None = None
    import_run_id: uuid.UUID | None = None
    external_metric_id: str | None = Field(default=None, max_length=200)
    dedupe_key: str | None = Field(default=None, max_length=500)


class CFMetricSnapshotResponse(CFMetricSnapshotCreate):
    id: uuid.UUID
    captured_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFMetricSourceConfigBase(BaseModel):
    source: CFMetricSourceType
    name: str = Field(..., max_length=200)
    description: str | None = None
    is_active: bool = True
    freshness_window_hours: int = Field(default=24, ge=1)
    default_confidence: CFConfidenceType = "medium"
    config: dict = Field(default_factory=dict)
    credentials_ref: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class CFMetricSourceConfigCreate(CFMetricSourceConfigBase):
    created_by_id: uuid.UUID | None = None


class CFMetricSourceConfigUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    freshness_window_hours: int | None = Field(default=None, ge=1)
    default_confidence: CFConfidenceType | None = None
    config: dict | None = None
    credentials_ref: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class CFMetricSourceConfigResponse(CFMetricSourceConfigBase):
    id: uuid.UUID
    created_by_id: uuid.UUID | None = None
    last_run_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFMetricImportRunResponse(BaseModel):
    id: uuid.UUID
    source_config_id: uuid.UUID
    status: CFMetricImportRunStatusType
    triggered_by: CFMetricImportRunTriggerType
    requested_by_id: uuid.UUID | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    found_count: int = 0
    created_count: int = 0
    skipped_duplicate_count: int = 0
    error_count: int = 0
    error_message: str | None = None
    raw_summary: dict | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFRetroNoteBase(BaseModel):
    period_start: date
    period_end: date
    retro_type: CFRetroType = "weekly"
    bundle_id: uuid.UUID | None = None
    best_by_objective: dict = Field(default_factory=dict)
    broken: list = Field(default_factory=list)
    learnings: dict = Field(default_factory=dict)
    decisions: dict = Field(default_factory=dict)
    actions: list = Field(default_factory=list)
    notes: str | None = None


class CFRetroNoteCreate(CFRetroNoteBase):
    facilitator_id: uuid.UUID


class CFRetroNoteUpdate(BaseModel):
    best_by_objective: dict | None = None
    broken: list[dict] | None = None
    learnings: dict | None = None
    decisions: dict | None = None
    actions: list[dict] | None = None
    notes: str | None = None


class CFRetroNoteResponse(CFRetroNoteBase):
    id: uuid.UUID
    facilitator_id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFGuestStoryBase(BaseModel):
    display_name: str = Field(..., max_length=200)
    contact_ref: str | None = Field(default=None, max_length=300)
    role: CFGuestStoryRoleType
    source: CFGuestStorySourceType = "manual"
    source_notes: str | None = None
    story_brief: str | None = None
    status: CFGuestStoryStatusType = "sourced"
    owner_id: uuid.UUID
    stage_due_at: datetime | None = None
    nosology_id: uuid.UUID | None = None
    bundle_id: uuid.UUID | None = None
    publication_id: uuid.UUID | None = None
    screening_notes: str | None = None
    medical_factcheck_notes: str | None = None
    rejection_reason: str | None = None
    consent_status: CFGuestConsentStatusType = "not_started"
    consent_version: str | None = Field(default=None, max_length=50)
    consent_signed_at: datetime | None = None
    allowed_channels: list[str] = Field(default_factory=list)
    anonymity_level: CFGuestAnonymityLevelType = "full_name"
    sensitive_topics: list[str] = Field(default_factory=list)
    legal_notes: str | None = None
    gift_status: CFGuestGiftStatusType = "not_required"
    follow_up_due_at: datetime | None = None


class CFGuestStoryCreate(CFGuestStoryBase):
    pass


class CFGuestStoryUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=200)
    contact_ref: str | None = Field(default=None, max_length=300)
    role: CFGuestStoryRoleType | None = None
    source: CFGuestStorySourceType | None = None
    source_notes: str | None = None
    story_brief: str | None = None
    status: CFGuestStoryStatusType | None = None
    owner_id: uuid.UUID | None = None
    stage_due_at: datetime | None = None
    nosology_id: uuid.UUID | None = None
    bundle_id: uuid.UUID | None = None
    publication_id: uuid.UUID | None = None
    screening_notes: str | None = None
    medical_factcheck_notes: str | None = None
    rejection_reason: str | None = None
    consent_status: CFGuestConsentStatusType | None = None
    consent_version: str | None = Field(default=None, max_length=50)
    consent_signed_at: datetime | None = None
    allowed_channels: list[str] | None = None
    anonymity_level: CFGuestAnonymityLevelType | None = None
    sensitive_topics: list[str] | None = None
    legal_notes: str | None = None
    gift_status: CFGuestGiftStatusType | None = None
    follow_up_due_at: datetime | None = None


class CFGuestStoryResponse(CFGuestStoryBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CFGuestStoryEventCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
    parent_event_id: uuid.UUID | None = None

    @field_validator("body")
    @classmethod
    def validate_body(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("body must not be blank")
        return stripped


class CFGuestStoryEventResponse(BaseModel):
    id: uuid.UUID
    guest_story_id: uuid.UUID
    parent_event_id: uuid.UUID | None
    actor_id: uuid.UUID | None
    event_type: CFGuestStoryEventType
    body: str | None
    old_value: str | None
    new_value: str | None
    payload: dict[str, object] = Field(default_factory=dict)
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
