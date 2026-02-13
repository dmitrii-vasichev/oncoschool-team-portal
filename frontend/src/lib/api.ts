import type {
  LoginRequest,
  LoginResponse,
  Task,
  TaskCreateRequest,
  TaskEditRequest,
  TaskUpdate,
  TaskUpdateCreateRequest,
  PaginatedResponse,
  Meeting,
  TeamMember,
  OverviewAnalytics,
  MemberStats,
  MeetingAnalytics,
  ReminderSettings,
  AppSettingsValue,
  AISettingsResponse,
  ParseSummaryResponse,
  CreateMeetingRequest,
  MeetingWithTasksResponse,
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

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

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
      throw new Error(body.detail || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // ==================== Auth ====================

  async login(data: LoginRequest): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setToken(resp.access_token);
    return resp;
  }

  async getMe(): Promise<TeamMember> {
    return this.request<TeamMember>("/api/auth/me");
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

  async getMeetings(): Promise<Meeting[]> {
    return this.request<Meeting[]>("/api/meetings");
  }

  async getMeeting(id: string): Promise<Meeting> {
    return this.request<Meeting>(`/api/meetings/${id}`);
  }

  async getMeetingTasks(id: string): Promise<Task[]> {
    return this.request<Task[]>(`/api/meetings/${id}/tasks`);
  }

  async parseSummary(summaryText: string): Promise<ParseSummaryResponse> {
    return this.request<ParseSummaryResponse>("/api/meetings/parse-summary", {
      method: "POST",
      body: JSON.stringify({ summary_text: summaryText }),
    });
  }

  async createMeeting(data: CreateMeetingRequest): Promise<MeetingWithTasksResponse> {
    return this.request<MeetingWithTasksResponse>("/api/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteMeeting(id: string): Promise<void> {
    return this.request<void>(`/api/meetings/${id}`, {
      method: "DELETE",
    });
  }

  // ==================== Team ====================

  async getTeam(): Promise<TeamMember[]> {
    return this.request<TeamMember[]>("/api/team");
  }

  async updateTeamMember(
    id: string,
    data: Partial<TeamMember>
  ): Promise<TeamMember> {
    return this.request<TeamMember>(`/api/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // ==================== Analytics ====================

  async getOverview(): Promise<OverviewAnalytics> {
    return this.request<OverviewAnalytics>("/api/analytics/overview");
  }

  async getMembersAnalytics(): Promise<{ members: MemberStats[] }> {
    return this.request<{ members: MemberStats[] }>("/api/analytics/members");
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
