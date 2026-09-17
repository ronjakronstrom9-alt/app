import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const API = `${BASE}/api`;

const TOKEN_KEY = "mt_token";

export function imageUri(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BASE}${url}`;
}

// ===== Module-level cache =====
// Cards and lessons are static — cache them so tab switches don't refetch.
let _cardsCache: Card[] | null = null;
let _lessonsCache: Lesson[] | null = null;
export function invalidateStaticCache() {
  _cardsCache = null;
  _lessonsCache = null;
}

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

  listCards: async () => {
    if (_cardsCache) return _cardsCache;
    _cardsCache = await request<Card[]>("GET", "/cards", undefined, false);
    return _cardsCache;
  },
  getCard: (id: string) => request<Card>("GET", `/cards/${id}`, undefined, false),

  listLessons: async () => {
    if (_lessonsCache) return _lessonsCache;
    _lessonsCache = await request<Lesson[]>("GET", "/lessons", undefined, false);
    return _lessonsCache;
  },
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
  checkQuizAnswer: (lessonId: string, questionId: string, answerIndex: number) =>
    request<{ correct: boolean; correct_index: number; explanation: string }>(
      "POST",
      "/quizzes/check",
      { lesson_id: lessonId, question_id: questionId, answer_index: answerIndex },
    ),
  refillHearts: () => request<{ hearts: number }>("POST", "/users/refill-hearts"),
  setLearningMode: (mode: "beginner" | "advanced") =>
    request<User>("POST", "/users/learning-mode", { mode }),
  progress: () => request<Progress>("GET", "/users/progress"),
  toggleFavorite: (cardId: string) =>
    request<{ favorited: boolean; favorites: string[] }>("POST", "/favorites/toggle", { card_id: cardId }),
  listFavorites: () => request<Card[]>("GET", "/favorites"),
  dailyCard: () => request<{ date: string; card: Card; prompt: string }>("GET", "/daily-card"),
  getNote: (cardId: string) => request<{ card_id: string; text: string }>("GET", `/notes/${cardId}`),
  saveNote: (cardId: string, text: string) =>
    request<{ ok: boolean }>("POST", "/notes", { card_id: cardId, text }),
  achievements: () =>
    request<{ total: number; unlocked: number; items: Achievement[] }>("GET", "/achievements"),
  dailyHistory: (year: number, month: number) =>
    request<{ year: number; month: number; count: number; entries: DailyEntry[] }>(
      "GET",
      `/daily-history?year=${year}&month=${month}`,
    ),
  saveReflection: (dateIso: string, text: string) =>
    request<{ ok: boolean }>("POST", "/daily-history/reflect", { date: dateIso, text }),
  getDailyEntry: (dateIso: string) =>
    request<DailyEntry>("GET", `/daily-history/entry?date=${dateIso}`),

  nextCombo: (excludeId?: string) =>
    request<ComboQuestion>("GET", `/combos/next${excludeId ? `?exclude=${excludeId}` : ""}`),
  answerCombo: (comboId: string, answerIndex: number) =>
    request<ComboAnswerResult>("POST", "/combos/answer", { combo_id: comboId, answer_index: answerIndex }),
};

export type ComboCard = { id: string; name: string; image_url: string };

export type ComboQuestion = {
  id: string;
  context: string;
  difficulty: number;
  cards: ComboCard[];
  question: string;
  options: string[];
  combos_unlocked: number;
  combos_total: number;
};

export type ComboAnswerResult = {
  correct: boolean;
  correct_index: number;
  explanation: string;
  xp_earned: number;
  new_xp: number;
  new_level: number;
  newly_unlocked: boolean;
  combos_unlocked: number;
  combos_total: number;
};

export type DailyEntry = {
  date: string;
  card_id: string;
  card_name: string;
  card_number: number;
  image_url: string;
  reflection?: string;
  reflection_updated_at?: string;
  created_at?: string;
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
  favorites: string[];
  learning_mode: "beginner" | "advanced";
  created_at: string;
};

export type Card = {
  id: string;
  name: string;
  number: number;
  arcana: string;
  suit?: string | null;
  keywords_upright: string[];
  keywords_reversed: string[];
  quick_meaning?: string | null;
  example?: string | null;
  upright_meaning: string;
  reversed_meaning: string;
  description: string;
  symbolism: string;
  image_emoji: string;
  image_url: string;
  element: string;
};

export type Lesson = {
  id: string;
  card_id: string;
  order: number;
  title: string;
  intro: string;
  subtitle: string;
  sections: { heading: string; body: string }[];
  xp_reward: number;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  question_type?: "mcq" | "match_image" | "match_meaning" | "reversed_detect" | "keyword_pick";
  image_url?: string | null;
  hint?: string | null;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  target: number;
  progress: number;
  unlocked: boolean;
  pct: number;
};

export type QuizResult = {
  correct: number;
  total: number;
  xp_earned: number;
  xp_streak_bonus?: number;
  new_xp: number;
  new_level: number;
  new_hearts: number;
  new_streak: number;
  lesson_completed: boolean;
  perfect?: boolean;
  achievements_unlocked?: Achievement[];
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
