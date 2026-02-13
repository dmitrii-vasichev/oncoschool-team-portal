import type {
  LoginResponse,
  Task,
  TaskCreateRequest,
  TaskEditRequest,
  TaskUpdate,
  TaskUpdateCreateRequest,
  PaginatedResponse,
  TeamMember,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
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
      throw new Error("Сервер недоступен");
    }

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
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

  async loginMiniApp(initData: string): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("/api/auth/mini-app", {
      method: "POST",
      body: JSON.stringify({ init_data: initData }),
    });
    this.setToken(resp.access_token);
    return resp;
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

  // ==================== Team ====================

  async getTeam(): Promise<TeamMember[]> {
    return this.request<TeamMember[]>("/api/team");
  }
}

export const api = new ApiClient();
