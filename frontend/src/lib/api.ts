export interface User {
  id: string;
  name: string;
  plan_type: string;
  trip_count: number;
  created_at?: string;
}

export interface TripPreferences {
  companions: string;
  vehicle: string;
  weather_preference: string;
  photo_spots: boolean;
  with_kids: boolean;
  budget: number;
  interests: string[];
  extra_notes: string;
}

export interface ScheduleItem {
  time: string;
  place: string;
  activity: string;
  type: string;
}

export interface DayPlan {
  day: number;
  date: string;
  schedule: ScheduleItem[];
  tips: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  preferences: TripPreferences;
  itinerary: {
    title: string;
    days: DayPlan[];
    recommendations: { place: string; reason: string; recommended: boolean }[];
    hidden_gems: { place: string; reason: string }[];
    transportation: string;
    indoor_alternatives: { original: string; alternative: string; reason: string }[];
    ai_reasoning: string;
    travel_tips: string[];
  };
  budget: {
    accommodation: number;
    fuel: number;
    toll: number;
    entrance_fees: number;
    food: number;
    total: number;
  };
  share_token: string | null;
  is_shared: boolean;
  created_at: string;
}

const SESSION_KEY = "trippilot_session_id";

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

function setSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (sessionId) headers["X-Session-Id"] = sessionId;

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const raw = await res.text();
    let detail = `요청 실패 (${res.status})`;
    try {
      const parsed = JSON.parse(raw) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      if (raw) detail = raw.slice(0, 200);
    }
    throw new Error(detail);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export async function ensureSession(): Promise<User> {
  const sessionId = getSessionId();
  if (!sessionId) {
    const res = await fetch("/api/auth/session", { method: "POST" });
    const raw = await res.text();
    let data: { detail?: string; session_id?: string; user?: User } = {};
    try {
      data = raw
        ? (JSON.parse(raw) as { detail?: string; session_id?: string; user?: User })
        : {};
    } catch {
      data = { detail: raw?.slice(0, 200) || `세션 생성 실패 (${res.status})` };
    }
    if (!res.ok) throw new Error(data.detail || `세션 생성 실패 (${res.status})`);
    if (!data.session_id || !data.user) throw new Error("세션 응답 형식 오류");
    setSessionId(data.session_id);
    return data.user;
  }
  return request<User>("/api/auth/session");
}

export const api = {
  ensureSession,

  getMe: () => request<User>("/api/auth/session"),

  createTrip: (data: {
    destination: string;
    start_date: string;
    end_date: string;
    preferences: TripPreferences;
  }) =>
    request<Trip>("/api/trips", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTrips: () => request<Trip[]>("/api/trips"),

  getTrip: (id: string) => request<Trip>(`/api/trips/${id}`),

  regenerateTrip: (id: string) =>
    request<Trip>(`/api/trips/${id}/regenerate`, { method: "POST" }),

  shareTrip: (id: string) =>
    request<{ share_url: string; share_token: string }>(`/api/trips/${id}/share`, {
      method: "POST",
    }),

  chat: (message: string, tripId?: string) =>
    request<{ reply: string; suggestions: string[] }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, trip_id: tripId }),
    }),
};

export function getStoredUser(): User | null {
  return null;
}

export function clearAuth() {
  localStorage.removeItem(SESSION_KEY);
}
