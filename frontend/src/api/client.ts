import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const API = `${BASE}/api`;

const TOKEN_KEY = "mt_token";

async function getToken(): Promise<string | null> {
  return (await storage.secureGet<string>(TOKEN_KEY, "")) || null;
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  auth: boolean = true,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>("POST", "/auth/signup", { email, password, name }, false),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/login", { email, password }, false),
  me: () => request<User>("GET", "/auth/me"),

  listCards: () => request<Card[]>("GET", "/cards", undefined, false),
  getCard: (id: string) => request<Card>("GET", `/cards/${id}`, undefined, false),

  listLessons: () => request<Lesson[]>("GET", "/lessons", undefined, false),
  getLesson: (id: string) => request<Lesson>("GET", `/lessons/${id}`, undefined, false),

  getQuiz: (lessonId: string) =>
    request<{ id: string; lesson_id: string; questions: QuizQuestion[] }>(
      "GET",
      `/quizzes/${lessonId}`,
    ),
  submitQuiz: (lessonId: string, answers: number[], heartsLost: number) =>
    request<QuizResult>("POST", "/quizzes/submit", {
      lesson_id: lessonId,
      answers,
      hearts_lost: heartsLost,
    }),
  refillHearts: () => request<{ hearts: number }>("POST", "/users/refill-hearts"),
  progress: () => request<Progress>("GET", "/users/progress"),
};

export type User = {
  id: string;
  email: string;
  name: string;
  xp: number;
  level: number;
  hearts: number;
  streak: number;
  last_active_date: string | null;
  completed_lessons: string[];
  created_at: string;
};

export type Card = {
  id: string;
  name: string;
  number: number;
  arcana: string;
  keywords_upright: string[];
  keywords_reversed: string[];
  upright_meaning: string;
  reversed_meaning: string;
  description: string;
  image_emoji: string;
  element: string;
};

export type Lesson = {
  id: string;
  card_id: string;
  order: number;
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  xp_reward: number;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

export type QuizResult = {
  correct: number;
  total: number;
  xp_earned: number;
  new_xp: number;
  new_level: number;
  new_hearts: number;
  new_streak: number;
  lesson_completed: boolean;
};

export type Progress = {
  xp: number;
  level: number;
  current_level_xp: number;
  next_level_xp: number;
  hearts: number;
  streak: number;
  completed_lessons: number;
  total_lessons: number;
  completion_pct: number;
  completed_lesson_ids: string[];
};
