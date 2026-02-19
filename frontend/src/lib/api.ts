import type {
  TelegramAuthData,
  LoginResponse,
  Task,
  TaskCreateRequest,
  TaskEditRequest,
  TaskUpdate,
  TaskUpdateCreateRequest,
  PaginatedResponse,
  Meeting,
  TeamMember,
  Department,
  TeamTreeResponse,
  OverviewAnalytics,
  DashboardTasksAnalytics,
  MemberStats,
  MeetingAnalytics,
  ReminderSettings,
  AppSettingsValue,
  AISettingsResponse,
  ParseSummaryResponse,
  CreateMeetingRequest,
  MeetingWithTasksResponse,
  MeetingSchedule,
  MeetingScheduleCreateRequest,
  TelegramNotificationTarget,
  ZoomStatusResponse,
  TeamMemberUpdateRequest,
  MemberDeactivationPreviewResponse,
  InAppNotificationListResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error(
        "Сервер недоступен. Убедитесь, что бэкенд запущен на " + API_URL
      );
    }

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      // Only clear token and redirect if we had a token (not during login)
      if (this.getToken()) {
        this.setToken(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      throw new Error(body.detail || "Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail;
      throw new Error(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ")
            : `HTTP ${res.status}`
      );
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // ==================== Auth ====================

  async loginWithTelegram(data: TelegramAuthData): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("/api/auth/telegram", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setToken(resp.access_token);
    return resp;
  }

  async getAuthConfig(): Promise<{ bot_username: string; debug?: boolean }> {
    return this.request<{ bot_username: string; debug?: boolean }>("/api/auth/config");
  }

  async devLogin(telegramId: number): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ telegram_id: telegramId }),
    });
    this.setToken(resp.access_token);
    return resp;
  }

  async getMe(): Promise<TeamMember> {
    return this.request<TeamMember>("/api/auth/me");
  }

  async initiateWebLogin(username: string): Promise<{ request_id: string; expires_at: string }> {
    return this.request("/api/auth/web-login", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  }

  async checkWebLoginStatus(requestId: string): Promise<{
    status: "pending" | "confirmed" | "expired";
    access_token?: string;
    member_id?: string;
    role?: string;
  }> {
    return this.request(`/api/auth/web-login/${requestId}/status`);
  }

  logout() {
    this.setToken(null);
  }

  // ==================== Tasks ====================

  async getTasks(params?: Record<string, string>): Promise<PaginatedResponse<Task>> {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<PaginatedResponse<Task>>(`/api/tasks${query}`);
  }

  async getTask(shortId: number): Promise<Task> {
    return this.request<Task>(`/api/tasks/${shortId}`);
  }

  async createTask(data: TaskCreateRequest): Promise<Task> {
    return this.request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(shortId: number, data: TaskEditRequest): Promise<Task> {
    return this.request<Task>(`/api/tasks/${shortId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(shortId: number): Promise<void> {
    return this.request<void>(`/api/tasks/${shortId}`, {
      method: "DELETE",
    });
  }

  // ==================== Task Updates ====================

  async getTaskUpdates(shortId: number): Promise<TaskUpdate[]> {
    return this.request<TaskUpdate[]>(`/api/tasks/${shortId}/updates`);
  }

  async createTaskUpdate(
    shortId: number,
    data: TaskUpdateCreateRequest
  ): Promise<TaskUpdate> {
    return this.request<TaskUpdate>(`/api/tasks/${shortId}/updates`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ==================== Meetings ====================

  async getMeetings(params?: { upcoming?: boolean; past?: boolean; member_id?: string; department_id?: string }): Promise<Meeting[]> {
    const searchParams = new URLSearchParams();
    if (params?.upcoming) searchParams.set("upcoming", "true");
    if (params?.past) searchParams.set("past", "true");
    if (params?.member_id) searchParams.set("member_id", params.member_id);
    if (params?.department_id) searchParams.set("department_id", params.department_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<Meeting[]>(`/api/meetings${query}`);
  }

  async getMeeting(id: string): Promise<Meeting> {
    return this.request<Meeting>(`/api/meetings/${id}`);
  }

  async getMeetingTasks(id: string): Promise<Task[]> {
    return this.request<Task[]>(`/api/meetings/${id}/tasks`);
  }

  async createMeetingManual(data: { title: string; meeting_date: string; timezone?: string; zoom_enabled?: boolean; duration_minutes?: number; participant_ids?: string[] }): Promise<Meeting> {
    return this.request<Meeting>("/api/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMeeting(id: string, data: Partial<Meeting> & { participant_ids?: string[] }): Promise<Meeting> {
    return this.request<Meeting>(`/api/meetings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteMeeting(id: string): Promise<void> {
    return this.request<void>(`/api/meetings/${id}`, {
      method: "DELETE",
    });
  }

  // Transcript & Summary
  async addTranscript(meetingId: string, text: string): Promise<Meeting> {
    return this.request<Meeting>(`/api/meetings/${meetingId}/transcript`, {
      method: "POST",
      body: JSON.stringify({ text, source: "manual" }),
    });
  }

  async fetchZoomTranscript(meetingId: string): Promise<{ transcript: string | null; message?: string }> {
    return this.request<{ transcript: string | null; message?: string }>(
      `/api/meetings/${meetingId}/fetch-transcript`,
      { method: "POST" }
    );
  }

  async parseMeetingSummary(meetingId: string, text?: string): Promise<ParseSummaryResponse> {
    return this.request<ParseSummaryResponse>(
      `/api/meetings/${meetingId}/parse-summary`,
      {
        method: "POST",
        body: JSON.stringify(text ? { text } : {}),
      }
    );
  }

  async applySummary(meetingId: string, data: CreateMeetingRequest): Promise<MeetingWithTasksResponse> {
    return this.request<MeetingWithTasksResponse>(
      `/api/meetings/${meetingId}/apply-summary`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  async getZoomStatus(meetingId: string): Promise<ZoomStatusResponse> {
    return this.request<ZoomStatusResponse>(`/api/meetings/${meetingId}/zoom-status`);
  }

  // ==================== In-app Notifications ====================

  async getNotifications(params?: {
    unread_only?: boolean;
    limit?: number;
  }): Promise<InAppNotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.unread_only) searchParams.set("unread_only", "true");
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<InAppNotificationListResponse>(`/api/notifications${query}`);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await this.request(`/api/notifications/${notificationId}/read`, {
      method: "POST",
    });
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.request<{ updated: number }>("/api/notifications/read-all", {
      method: "POST",
    });
  }

  // ==================== Meeting Schedules ====================

  async getMeetingSchedules(): Promise<MeetingSchedule[]> {
    return this.request<MeetingSchedule[]>("/api/meeting-schedules");
  }

  async createMeetingSchedule(data: MeetingScheduleCreateRequest): Promise<MeetingSchedule> {
    return this.request<MeetingSchedule>("/api/meeting-schedules", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMeetingSchedule(id: string, data: Partial<MeetingScheduleCreateRequest>): Promise<MeetingSchedule> {
    return this.request<MeetingSchedule>(`/api/meeting-schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteMeetingSchedule(id: string): Promise<void> {
    return this.request<void>(`/api/meeting-schedules/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== Telegram Targets ====================

  async getTelegramTargets(): Promise<TelegramNotificationTarget[]> {
    return this.request<TelegramNotificationTarget[]>("/api/telegram-targets");
  }

  async createTelegramTarget(data: { chat_id: number; thread_id?: number | null; label?: string | null }): Promise<TelegramNotificationTarget> {
    return this.request<TelegramNotificationTarget>("/api/telegram-targets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTelegramTarget(id: string, data: { chat_id?: number; thread_id?: number | null; label?: string | null }): Promise<TelegramNotificationTarget> {
    return this.request<TelegramNotificationTarget>(`/api/telegram-targets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTelegramTarget(id: string): Promise<void> {
    return this.request<void>(`/api/telegram-targets/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== Departments ====================

  async getDepartments(): Promise<Department[]> {
    return this.request<Department[]>("/api/departments");
  }

  async createDepartment(data: Partial<Department>): Promise<Department> {
    return this.request<Department>("/api/departments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    return this.request<Department>(`/api/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteDepartment(id: string): Promise<void> {
    return this.request<void>(`/api/departments/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== Team ====================

  async getTeam(options?: { includeInactive?: boolean }): Promise<TeamMember[]> {
    const params = new URLSearchParams();
    if (options?.includeInactive) {
      params.set("include_inactive", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<TeamMember[]>(`/api/team${query}`);
  }

  async createTeamMember(data: {
    full_name: string;
    role?: string;
    telegram_id?: number | null;
    telegram_username?: string;
    department_id?: string | null;
    position?: string;
    email?: string;
    birthday?: string;
    name_variants?: string[];
  }): Promise<TeamMember> {
    return this.request<TeamMember>("/api/team", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTeamTree(options?: { includeInactive?: boolean }): Promise<TeamTreeResponse> {
    const params = new URLSearchParams();
    if (options?.includeInactive) {
      params.set("include_inactive", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<TeamTreeResponse>(`/api/team/tree${query}`);
  }

  async updateTeamMember(
    id: string,
    data: TeamMemberUpdateRequest
  ): Promise<TeamMember> {
    return this.request<TeamMember>(`/api/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getTeamMemberDeactivationPreview(
    memberId: string
  ): Promise<MemberDeactivationPreviewResponse> {
    return this.request<MemberDeactivationPreviewResponse>(
      `/api/team/${memberId}/deactivation-preview`
    );
  }

  async uploadAvatar(memberId: string, file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}/api/team/${memberId}/avatar`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async deleteAvatar(memberId: string): Promise<void> {
    return this.request<void>(`/api/team/${memberId}/avatar`, {
      method: "DELETE",
    });
  }

  // ==================== Analytics ====================

  async getOverview(departmentId?: string): Promise<OverviewAnalytics> {
    const params = new URLSearchParams();
    if (departmentId) {
      params.set("department_id", departmentId);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<OverviewAnalytics>(`/api/analytics/overview${query}`);
  }

  async getDashboardTasksAnalytics(departmentId?: string): Promise<DashboardTasksAnalytics> {
    const params = new URLSearchParams();
    if (departmentId) {
      params.set("department_id", departmentId);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<DashboardTasksAnalytics>(`/api/analytics/dashboard-tasks${query}`);
  }

  async getMembersAnalytics(departmentId?: string): Promise<{ members: MemberStats[] }> {
    const params = new URLSearchParams();
    if (departmentId) {
      params.set("department_id", departmentId);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ members: MemberStats[] }>(`/api/analytics/members${query}`);
  }

  async getMeetingsAnalytics(): Promise<MeetingAnalytics> {
    return this.request<MeetingAnalytics>("/api/analytics/meetings");
  }

  // ==================== Settings ====================

  async getNotificationSubscriptions(): Promise<{ subscriptions: Record<string, boolean> }> {
    return this.request<{ subscriptions: Record<string, boolean> }>(
      "/api/settings/notifications"
    );
  }

  async updateNotificationSubscriptions(
    subscriptions: Record<string, boolean>
  ): Promise<{ subscriptions: Record<string, boolean> }> {
    return this.request<{ subscriptions: Record<string, boolean> }>(
      "/api/settings/notifications",
      {
        method: "PUT",
        body: JSON.stringify({ subscriptions }),
      }
    );
  }

  async getReminderSettings(memberId: string): Promise<ReminderSettings> {
    return this.request<ReminderSettings>(
      `/api/settings/reminders/${memberId}`
    );
  }

  async updateReminderSettings(
    memberId: string,
    data: Partial<ReminderSettings>
  ): Promise<ReminderSettings> {
    return this.request<ReminderSettings>(
      `/api/settings/reminders/${memberId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  async getAiSettings(): Promise<AISettingsResponse> {
    return this.request<AISettingsResponse>("/api/settings/ai");
  }

  async updateAiSettings(data: AppSettingsValue): Promise<AISettingsResponse> {
    return this.request<AISettingsResponse>("/api/settings/ai", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async bulkUpdateReminders(data: {
    is_enabled: boolean;
    reminder_time?: string;
    days_of_week?: number[];
  }): Promise<{ updated: number }> {
    return this.request<{ updated: number }>("/api/settings/reminders/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
