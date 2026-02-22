import type { BestScores, SessionRecord, SessionSettings } from "../types";

export const SETTINGS_STORAGE_KEY = "mathTyper.settings.v1";
export const HISTORY_STORAGE_KEY = "mathTyper.history.v1";
export const BESTS_STORAGE_KEY = "mathTyper.bests.v1";
const HISTORY_LIMIT = 50;

export const DEFAULT_SETTINGS: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulty: "mixed",
  revealLatex: false
};

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isDuration(value: unknown): value is SessionSettings["durationSec"] {
  return value === 60 || value === 120 || value === 300;
}

function isMode(value: unknown): value is SessionSettings["mode"] {
  return value === "practice" || value === "timed";
}

function isDifficulty(value: unknown): value is SessionSettings["difficulty"] {
  return value === "beginner" || value === "intermediate" || value === "advanced" || value === "mixed";
}

export function sanitizeSettings(raw: unknown): SessionSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const input = raw as Partial<SessionSettings>;

  return {
    mode: isMode(input.mode) ? input.mode : DEFAULT_SETTINGS.mode,
    durationSec: isDuration(input.durationSec) ? input.durationSec : DEFAULT_SETTINGS.durationSec,
    difficulty: isDifficulty(input.difficulty) ? input.difficulty : DEFAULT_SETTINGS.difficulty,
    revealLatex: typeof input.revealLatex === "boolean" ? input.revealLatex : DEFAULT_SETTINGS.revealLatex
  };
}

export function loadSettings(): SessionSettings {
  if (!hasLocalStorage()) {
    return { ...DEFAULT_SETTINGS };
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(SETTINGS_STORAGE_KEY));
  return sanitizeSettings(parsed);
}

export function saveSettings(settings: SessionSettings): void {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function isSessionRecord(raw: unknown): raw is SessionRecord {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const record = raw as SessionRecord;
  return typeof record.id === "string" && typeof record.endedAt === "number" && typeof record.stats?.attempts === "number";
}

export function loadHistory(): SessionRecord[] {
  if (!hasLocalStorage()) {
    return [];
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(HISTORY_STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isSessionRecord).slice(0, HISTORY_LIMIT);
}

export function saveHistory(history: SessionRecord[]): SessionRecord[] {
  const trimmed = history.slice(0, HISTORY_LIMIT);
  if (hasLocalStorage()) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  }
  return trimmed;
}

export function getBestKey(mode: SessionSettings["mode"], difficulty: SessionSettings["difficulty"]): string {
  return `${mode}:${difficulty}`;
}

export function computeBestScores(history: SessionRecord[]): BestScores {
  const bests: BestScores = {};

  for (const record of history) {
    const key = getBestKey(record.settings.mode, record.settings.difficulty);
    const currentBest = bests[key];

    if (!currentBest || record.stats.correct > currentBest.stats.correct) {
      bests[key] = record;
      continue;
    }

    if (record.stats.correct === currentBest.stats.correct && record.stats.accuracy > currentBest.stats.accuracy) {
      bests[key] = record;
      continue;
    }

    if (
      record.stats.correct === currentBest.stats.correct &&
      record.stats.accuracy === currentBest.stats.accuracy &&
      record.stats.formulasPerMin > currentBest.stats.formulasPerMin
    ) {
      bests[key] = record;
    }
  }

  return bests;
}

export function loadBestScores(): BestScores {
  if (!hasLocalStorage()) {
    return {};
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(BESTS_STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const value = parsed as Record<string, SessionRecord>;
  const result: BestScores = {};
  for (const [key, record] of Object.entries(value)) {
    if (isSessionRecord(record)) {
      result[key] = record;
    }
  }
  return result;
}

export function saveBestScores(bests: BestScores): void {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(BESTS_STORAGE_KEY, JSON.stringify(bests));
}
