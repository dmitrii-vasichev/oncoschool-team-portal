import { getApiBaseCandidates, getConfiguredApiUrl } from "./api-base-url";

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
  MeetingReminderTextsSettings,
  MeetingWeeklyDigestSettings,
  MeetingWeeklyDigestSendResponse,
  AppSettingsValue,
  AISettingsResponse,
  ParseSummaryResponse,
  CreateMeetingRequest,
  MeetingWithTasksResponse,
  MeetingSchedule,
  MeetingScheduleCreateRequest,
  TelegramNotificationTarget,
  TelegramBroadcast,
  TelegramBroadcastImagePreset,
  TelegramBroadcastCreateRequest,
  TelegramBroadcastSendResponse,
  TelegramBroadcastUpdateRequest,
  ZoomStatusResponse,
  TeamMemberUpdateRequest,
  MemberDeactivationPreviewResponse,
  InAppNotificationListResponse,
  NotificationSubscriptionsSettings,
  // Content module types
  TelegramChannel,
  TelegramChannelCreateRequest,
  TelegramChannelUpdateRequest,
  DataInventoryResponse,
  AnalysisPrompt,
  AnalysisPromptCreateRequest,
  AnalysisPromptUpdateRequest,
  AnalysisPrepareRequest,
  AnalysisPrepareResponse,
  AnalysisRunRequest,
  AnalysisRun,
  AnalysisHistoryResponse,
  AIFeatureConfig,
  AIFeatureConfigUpdateRequest,
  ContentAccess,
  ContentAccessGrantRequest,
  TelegramConnectionStatus,
  TelegramConnectRequest,
  TelegramVerifyRequest,
  // Reports
  DailyMetric,
  DailyMetricWithDelta,
  ReportSummary,
  CollectResponse,
  ReportSchedule,
  GetCourseCredentials,
} from "./types";

class ApiClient {
  private token: string | null = null;
  private activeApiBaseUrl: string | null = null;
  private readonly retryableMethods = new Set([
    "GET",
    "HEAD",
    "OPTIONS",
    "PUT",
  ]);
  private readonly maxNetworkRetries: Record<string, number> = {
    GET: 1,
    HEAD: 1,
    OPTIONS: 1,
    PUT: 2,
  };

  private getApiBases(): string[] {
    return getApiBaseCandidates(this.activeApiBaseUrl);
  }

  private async fetchWithApiFallback(path: string, options: RequestInit): Promise<Response> {
    const apiBases = this.getApiBases();
    let lastError: unknown = null;

    for (const apiBase of apiBases) {
      try {
        const response = await fetch(`${apiBase}${path}`, options);
        this.activeApiBaseUrl = apiBase;
        return response;
      } catch (error) {
        lastError = error;
      }
    }

    const configuredBase = getConfiguredApiUrl();
    const reason =
      lastError instanceof Error && lastError.message
        ? ` Причина: ${lastError.message}.`
        : "";
    throw new Error(
      `Сервер недоступен. Убедитесь, что бэкенд запущен на ${configuredBase}.` +
        (apiBases.length > 1 ? ` Попытки: ${apiBases.join(", ")}.` : "") +
        reason
    );
  }

  private isTransientNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.message.includes("Сервер недоступен") ||
      error.message.includes("Failed to fetch")
    );
  }

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
    const method = (options.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res: Response;
    let retryAttempt = 0;
    const maxRetries = this.maxNetworkRetries[method] ?? 0;
    while (true) {
      try {
        res = await this.fetchWithApiFallback(path, {
          ...options,
          method,
          headers,
        });
        break;
      } catch (error) {
        if (
          !this.retryableMethods.has(method) ||
          retryAttempt >= maxRetries ||
          !this.isTransientNetworkError(error)
        ) {
          throw error;
        }
        const delayMs = 1000 * (retryAttempt + 1);
        retryAttempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
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

  async loginWithTelegramWebApp(initData: string): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("/api/auth/telegram-webapp", {
      method: "POST",
      body: JSON.stringify({ init_data: initData }),
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

  async deleteMeeting(
    id: string,
    options?: { notifyParticipants?: boolean }
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options?.notifyParticipants) {
      params.set("notify_participants", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<void>(`/api/meetings/${id}${query}`, {
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

  async getMeetingSchedule(id: string): Promise<MeetingSchedule> {
    return this.request<MeetingSchedule>(`/api/meeting-schedules/${id}`);
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

  async deleteMeetingSchedule(
    id: string,
    options?: { notifyParticipants?: boolean }
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options?.notifyParticipants) {
      params.set("notify_participants", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<void>(`/api/meeting-schedules/${id}${query}`, {
      method: "DELETE",
    });
  }

  // ==================== Telegram Targets ====================

  async getTelegramTargets(): Promise<TelegramNotificationTarget[]> {
    return this.request<TelegramNotificationTarget[]>("/api/telegram-targets");
  }

  async createTelegramTarget(data: {
    chat_id: number;
    thread_id?: number | null;
    label?: string | null;
    type?: string | null;
    allow_incoming_tasks?: boolean;
  }): Promise<TelegramNotificationTarget> {
    return this.request<TelegramNotificationTarget>("/api/telegram-targets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTelegramTarget(id: string, data: {
    chat_id?: number;
    thread_id?: number | null;
    label?: string | null;
    type?: string | null;
    allow_incoming_tasks?: boolean;
  }): Promise<TelegramNotificationTarget> {
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

  // ==================== Telegram Broadcasts ====================

  async getTelegramBroadcasts(params?: {
    status?: "scheduled" | "sent" | "failed" | "cancelled";
    limit?: number;
  }): Promise<TelegramBroadcast[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<TelegramBroadcast[]>(`/api/broadcasts${query}`);
  }

  async getTelegramBroadcastImagePresets(params?: {
    includeInactive?: boolean;
  }): Promise<TelegramBroadcastImagePreset[]> {
    const searchParams = new URLSearchParams();
    if (typeof params?.includeInactive === "boolean") {
      searchParams.set("include_inactive", params.includeInactive ? "true" : "false");
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<TelegramBroadcastImagePreset[]>(
      `/api/broadcasts/image-presets${query}`
    );
  }

  async createTelegramBroadcastImagePreset(data: {
    alias: string;
    imageFile: File;
    sortOrder?: number;
    isActive?: boolean;
  }): Promise<TelegramBroadcastImagePreset> {
    const formData = new FormData();
    formData.append("alias", data.alias);
    formData.append("image", data.imageFile);
    if (typeof data.sortOrder === "number") {
      formData.append("sort_order", String(data.sortOrder));
    }
    if (typeof data.isActive === "boolean") {
      formData.append("is_active", data.isActive ? "true" : "false");
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await this.fetchWithApiFallback("/api/broadcasts/image-presets", {
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

  async updateTelegramBroadcastImagePreset(
    id: string,
    data: {
      alias?: string;
      sortOrder?: number;
      isActive?: boolean;
      imageFile?: File | null;
    }
  ): Promise<TelegramBroadcastImagePreset> {
    const formData = new FormData();
    if (typeof data.alias === "string") {
      formData.append("alias", data.alias);
    }
    if (typeof data.sortOrder === "number") {
      formData.append("sort_order", String(data.sortOrder));
    }
    if (typeof data.isActive === "boolean") {
      formData.append("is_active", data.isActive ? "true" : "false");
    }
    if (data.imageFile) {
      formData.append("image", data.imageFile);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await this.fetchWithApiFallback(`/api/broadcasts/image-presets/${id}`, {
      method: "PATCH",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async deleteTelegramBroadcastImagePreset(id: string): Promise<void> {
    return this.request<void>(`/api/broadcasts/image-presets/${id}`, {
      method: "DELETE",
    });
  }

  async createTelegramBroadcast(
    data: TelegramBroadcastCreateRequest
  ): Promise<TelegramBroadcast> {
    return this.request<TelegramBroadcast>("/api/broadcasts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTelegramBroadcast(
    id: string,
    data: TelegramBroadcastUpdateRequest
  ): Promise<TelegramBroadcast> {
    return this.request<TelegramBroadcast>(`/api/broadcasts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async cancelTelegramBroadcast(id: string): Promise<void> {
    return this.request<void>(`/api/broadcasts/${id}`, {
      method: "DELETE",
    });
  }

  async sendNowTelegramBroadcast(id: string): Promise<TelegramBroadcast> {
    return this.request<TelegramBroadcast>(`/api/broadcasts/${id}/send-now`, {
      method: "POST",
    });
  }

  async createTelegramBroadcastBatch(data: {
    targetIds: string[];
    messageHtml: string;
    scheduledAt?: string;
    sendNow?: boolean;
    imageFile?: File | null;
    imagePresetId?: string | null;
  }): Promise<TelegramBroadcast[]> {
    const formData = new FormData();
    formData.append("target_ids", JSON.stringify(data.targetIds));
    formData.append("message_html", data.messageHtml);
    if (data.scheduledAt) {
      formData.append("scheduled_at", data.scheduledAt);
    }
    formData.append("send_now", data.sendNow ? "true" : "false");
    if (data.imageFile) {
      formData.append("image", data.imageFile);
    }
    if (data.imagePresetId) {
      formData.append("image_preset_id", data.imagePresetId);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await this.fetchWithApiFallback("/api/broadcasts/batch", {
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

  async sendTelegramBroadcast(
    data: {
      targetIds: string[];
      messageHtml: string;
      imageFile?: File | null;
      imagePresetId?: string | null;
    }
  ): Promise<TelegramBroadcastSendResponse> {
    const formData = new FormData();
    formData.append("target_ids", JSON.stringify(data.targetIds));
    formData.append("message_html", data.messageHtml);
    if (data.imageFile) {
      formData.append("image", data.imageFile);
    }
    if (data.imagePresetId) {
      formData.append("image_preset_id", data.imagePresetId);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await this.fetchWithApiFallback("/api/broadcasts/send", {
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

  async getTeam(options?: { includeInactive?: boolean; includeTest?: boolean }): Promise<TeamMember[]> {
    const params = new URLSearchParams();
    if (options?.includeInactive) {
      params.set("include_inactive", "true");
    }
    if (options?.includeTest) {
      params.set("include_test", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<TeamMember[]>(`/api/team${query}`);
  }

  async createTeamMember(data: {
    full_name: string;
    role?: string;
    is_test?: boolean;
    telegram_id?: number | null;
    telegram_username?: string;
    department_id?: string | null;
    extra_department_ids?: string[];
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

  async getTeamTree(options?: { includeInactive?: boolean; includeTest?: boolean }): Promise<TeamTreeResponse> {
    const params = new URLSearchParams();
    if (options?.includeInactive) {
      params.set("include_inactive", "true");
    }
    if (options?.includeTest) {
      params.set("include_test", "true");
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
    const res = await this.fetchWithApiFallback(`/api/team/${memberId}/avatar`, {
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

  async getNotificationSubscriptions(): Promise<NotificationSubscriptionsSettings> {
    return this.request<NotificationSubscriptionsSettings>(
      "/api/settings/notifications"
    );
  }

  async updateNotificationSubscriptions(
    data: {
      subscriptions: Record<string, boolean>;
      task_overdue_interval_hours?: number;
      task_overdue_daily_time_msk?: string;
    }
  ): Promise<NotificationSubscriptionsSettings> {
    return this.request<NotificationSubscriptionsSettings>(
      "/api/settings/notifications",
      {
        method: "PUT",
        body: JSON.stringify(data),
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

  async getMeetingReminderTexts(): Promise<MeetingReminderTextsSettings> {
    return this.request<MeetingReminderTextsSettings>(
      "/api/settings/meeting-reminder-texts"
    );
  }

  async updateMeetingReminderTexts(
    textsByOffset: Record<string, string>
  ): Promise<MeetingReminderTextsSettings> {
    return this.request<MeetingReminderTextsSettings>(
      "/api/settings/meeting-reminder-texts",
      {
        method: "PUT",
        body: JSON.stringify({ texts_by_offset: textsByOffset }),
      }
    );
  }

  async getMeetingWeeklyDigestSettings(): Promise<MeetingWeeklyDigestSettings> {
    return this.request<MeetingWeeklyDigestSettings>(
      "/api/settings/meeting-weekly-digest"
    );
  }

  async updateMeetingWeeklyDigestSettings(data: {
    enabled: boolean;
    day_of_week: number;
    time_local: string;
    target_ids: string[];
    template: string;
  }): Promise<MeetingWeeklyDigestSettings> {
    return this.request<MeetingWeeklyDigestSettings>(
      "/api/settings/meeting-weekly-digest",
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  async sendPendingMeetingWeeklyDigest(targetIds?: string[]): Promise<MeetingWeeklyDigestSendResponse> {
    return this.request<MeetingWeeklyDigestSendResponse>(
      "/api/settings/meeting-weekly-digest/send-pending-now",
      {
        method: "POST",
        body: JSON.stringify({ target_ids: targetIds ?? [] }),
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

  // ==================== Content: Telegram Channels ====================

  async getChannels(): Promise<TelegramChannel[]> {
    return this.request<TelegramChannel[]>("/api/content/telegram/channels");
  }

  async createChannel(data: TelegramChannelCreateRequest): Promise<TelegramChannel> {
    return this.request<TelegramChannel>("/api/content/telegram/channels", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateChannel(id: string, data: TelegramChannelUpdateRequest): Promise<TelegramChannel> {
    return this.request<TelegramChannel>(`/api/content/telegram/channels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(id: string): Promise<void> {
    return this.request<void>(`/api/content/telegram/channels/${id}`, {
      method: "DELETE",
    });
  }

  async getDataInventory(): Promise<DataInventoryResponse> {
    return this.request<DataInventoryResponse>("/api/content/telegram/data-inventory");
  }

  // ==================== Content: Analysis Prompts ====================

  async getPrompts(): Promise<AnalysisPrompt[]> {
    return this.request<AnalysisPrompt[]>("/api/content/telegram/prompts");
  }

  async createPrompt(data: AnalysisPromptCreateRequest): Promise<AnalysisPrompt> {
    return this.request<AnalysisPrompt>("/api/content/telegram/prompts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePrompt(id: string, data: AnalysisPromptUpdateRequest): Promise<AnalysisPrompt> {
    return this.request<AnalysisPrompt>(`/api/content/telegram/prompts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deletePrompt(id: string): Promise<void> {
    return this.request<void>(`/api/content/telegram/prompts/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== Content: Analysis ====================

  async prepareAnalysis(data: AnalysisPrepareRequest): Promise<AnalysisPrepareResponse> {
    return this.request<AnalysisPrepareResponse>("/api/content/telegram/analysis/prepare", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async runAnalysis(data: AnalysisRunRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>("/api/content/telegram/analysis/run", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAnalysisHistory(params?: { page?: number; per_page?: number }): Promise<AnalysisHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.per_page) searchParams.set("per_page", String(params.per_page));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.request<AnalysisHistoryResponse>(`/api/content/telegram/analysis/history${query}`);
  }

  async getAnalysisResult(runId: string): Promise<AnalysisRun> {
    return this.request<AnalysisRun>(`/api/content/telegram/analysis/${runId}`);
  }

  async downloadAnalysisResult(runId: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await this.fetchWithApiFallback(
      `/api/content/telegram/analysis/${runId}/download`,
      { method: "GET", headers }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.blob();
  }

  /**
   * Stream analysis progress via SSE.
   * Returns an EventSource that emits AnalysisProgressEvent messages.
   */
  streamAnalysisProgress(runId: string): EventSource {
    const token = this.getToken();
    const apiBases = this.getApiBases();
    const apiBase = apiBases[0];
    const url = `${apiBase}/api/content/telegram/analysis/${runId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    return new EventSource(url);
  }

  // ==================== Reports ====================

  async getReportToday(): Promise<DailyMetricWithDelta> {
    return this.request<DailyMetricWithDelta>("/api/reports/getcourse/today");
  }

  async getReportRange(dateFrom?: string, dateTo?: string): Promise<DailyMetric[]> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<DailyMetric[]>(`/api/reports/getcourse/range${query}`);
  }

  async getReportSummary(days?: number): Promise<ReportSummary> {
    const params = new URLSearchParams();
    if (days) params.set("days", String(days));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<ReportSummary>(`/api/reports/getcourse/summary${query}`);
  }

  async collectReport(date: string): Promise<CollectResponse> {
    return this.request<CollectResponse>("/api/reports/getcourse/collect", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  }

  // ==================== Settings: Reports ====================

  async getGetCourseCredentials(): Promise<GetCourseCredentials> {
    return this.request<GetCourseCredentials>("/api/settings/getcourse-credentials");
  }

  async updateGetCourseCredentials(data: { base_url: string; api_key: string }): Promise<GetCourseCredentials> {
    return this.request<GetCourseCredentials>("/api/settings/getcourse-credentials", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getReportSchedule(): Promise<ReportSchedule> {
    return this.request<ReportSchedule>("/api/settings/report-schedule");
  }

  async updateReportSchedule(data: ReportSchedule): Promise<ReportSchedule> {
    return this.request<ReportSchedule>("/api/settings/report-schedule", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ==================== Admin: AI Feature Config ====================

  async getAIFeatureConfigs(): Promise<AIFeatureConfig[]> {
    return this.request<AIFeatureConfig[]>("/api/admin/ai-config");
  }

  async updateAIFeatureConfig(featureKey: string, data: AIFeatureConfigUpdateRequest): Promise<AIFeatureConfig> {
    return this.request<AIFeatureConfig>(`/api/admin/ai-config/${featureKey}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ==================== Admin: Content Access ====================

  async getContentAccess(): Promise<ContentAccess[]> {
    return this.request<ContentAccess[]>("/api/admin/content-access");
  }

  async grantContentAccess(data: ContentAccessGrantRequest): Promise<ContentAccess> {
    return this.request<ContentAccess>("/api/admin/content-access", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async revokeContentAccess(accessId: string): Promise<void> {
    return this.request<void>(`/api/admin/content-access/${accessId}`, {
      method: "DELETE",
    });
  }

  // ==================== Admin: Telegram Connection ====================

  async getTelegramConnectionStatus(): Promise<TelegramConnectionStatus> {
    return this.request<TelegramConnectionStatus>("/api/admin/telegram/status");
  }

  async connectTelegram(data: TelegramConnectRequest): Promise<TelegramConnectionStatus> {
    return this.request<TelegramConnectionStatus>("/api/admin/telegram/connect", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async verifyTelegramCode(data: TelegramVerifyRequest): Promise<TelegramConnectionStatus> {
    return this.request<TelegramConnectionStatus>("/api/admin/telegram/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async disconnectTelegram(): Promise<void> {
    return this.request<void>("/api/admin/telegram/disconnect", {
      method: "POST",
    });
  }
}

export const api = new ApiClient();
