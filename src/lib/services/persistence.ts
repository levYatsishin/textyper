import { ALL_TOPIC_IDS } from "../data/topics";
import type { BestScores, Difficulty, SessionRecord, SessionSettings, SubmissionResult, TopicId } from "../types";

export const SETTINGS_STORAGE_KEY = "mathTyper.settings.v1";
export const HISTORY_STORAGE_KEY = "mathTyper.history.v1";
export const BESTS_STORAGE_KEY = "mathTyper.bests.v1";
export const ACTIVE_SESSION_STORAGE_KEY = "mathTyper.activeSession.v1";
const HISTORY_LIMIT = 50;
const DIFFICULTY_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

export const DEFAULT_SETTINGS: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulties: [...DIFFICULTY_ORDER],
  selectedTopicIds: [...ALL_TOPIC_IDS],
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
  return value === 60 || value === 120;
}

function isMode(value: unknown): value is SessionSettings["mode"] {
  return value === "practice" || value === "timed";
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function isTopicId(value: unknown): value is TopicId {
  return typeof value === "string" && ALL_TOPIC_IDS.includes(value);
}

function normalizeDifficulties(values: Difficulty[]): Difficulty[] {
  const unique = [...new Set(values)];
  return DIFFICULTY_ORDER.filter((difficulty) => unique.includes(difficulty));
}

function normalizeTopicIds(values: TopicId[]): TopicId[] {
  const unique = [...new Set(values)];
  return ALL_TOPIC_IDS.filter((topicId) => unique.includes(topicId));
}

function sanitizeDifficulties(raw: unknown, legacyDifficulty: unknown): Difficulty[] {
  if (Array.isArray(raw)) {
    const values = normalizeDifficulties(raw.filter(isDifficulty));
    if (values.length > 0) {
      return values;
    }
  }

  if (legacyDifficulty === "mixed") {
    return [...DIFFICULTY_ORDER];
  }

  if (isDifficulty(legacyDifficulty)) {
    return [legacyDifficulty];
  }

  return [...DEFAULT_SETTINGS.difficulties];
}

function sanitizeTopicIds(raw: unknown, legacyTopic: unknown): TopicId[] {
  if (Array.isArray(raw)) {
    const values = normalizeTopicIds(raw.filter(isTopicId));
    if (values.length > 0) {
      return values;
    }
  }

  if (isTopicId(legacyTopic)) {
    return [legacyTopic];
  }

  return [...DEFAULT_SETTINGS.selectedTopicIds];
}

export function sanitizeSettings(raw: unknown): SessionSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const input = raw as Partial<SessionSettings> & { difficulty?: unknown; topic?: unknown };

  return {
    mode: isMode(input.mode) ? input.mode : DEFAULT_SETTINGS.mode,
    durationSec: isDuration(input.durationSec) ? input.durationSec : DEFAULT_SETTINGS.durationSec,
    difficulties: sanitizeDifficulties(input.difficulties, input.difficulty),
    selectedTopicIds: sanitizeTopicIds(input.selectedTopicIds, input.topic),
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
  const record = raw as Partial<SessionRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.endedAt === "number" &&
    typeof record.stats?.startedAt === "number" &&
    typeof record.stats?.elapsedMs === "number" &&
    typeof record.stats?.attempts === "number" &&
    typeof record.stats?.correct === "number" &&
    typeof record.stats?.accuracy === "number" &&
    typeof record.stats?.formulasPerMin === "number" &&
    typeof record.stats?.charsPerMin === "number" &&
    typeof record.stats?.bestStreak === "number"
  );
}

function sanitizeSessionRecord(raw: unknown): SessionRecord | null {
  if (!isSessionRecord(raw)) {
    return null;
  }
  return {
    ...raw,
    settings: sanitizeSettings(raw.settings)
  };
}

export function loadHistory(): SessionRecord[] {
  if (!hasLocalStorage()) {
    return [];
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(HISTORY_STORAGE_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => sanitizeSessionRecord(item))
    .filter((item): item is SessionRecord => item !== null)
    .slice(0, HISTORY_LIMIT);
}

export function saveHistory(history: SessionRecord[]): SessionRecord[] {
  const trimmed = history.slice(0, HISTORY_LIMIT);
  if (hasLocalStorage()) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  }
  return trimmed;
}

export function getBestKey(
  mode: SessionSettings["mode"],
  difficulties: SessionSettings["difficulties"],
  selectedTopicIds: SessionSettings["selectedTopicIds"]
): string {
  return `${mode}:${normalizeDifficulties(difficulties).join("+")}:${normalizeTopicIds(selectedTopicIds).join("+")}`;
}

export function computeBestScores(history: SessionRecord[]): BestScores {
  const bests: BestScores = {};

  for (const record of history) {
    const key = getBestKey(record.settings.mode, record.settings.difficulties, record.settings.selectedTopicIds);
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
  for (const [, record] of Object.entries(value)) {
    const sanitized = sanitizeSessionRecord(record);
    if (sanitized) {
      const key = getBestKey(
        sanitized.settings.mode,
        sanitized.settings.difficulties,
        sanitized.settings.selectedTopicIds
      );
      const currentBest = result[key];
      if (
        !currentBest ||
        sanitized.stats.correct > currentBest.stats.correct ||
        (sanitized.stats.correct === currentBest.stats.correct &&
          sanitized.stats.accuracy > currentBest.stats.accuracy) ||
        (sanitized.stats.correct === currentBest.stats.correct &&
          sanitized.stats.accuracy === currentBest.stats.accuracy &&
          sanitized.stats.formulasPerMin > currentBest.stats.formulasPerMin)
      ) {
        result[key] = sanitized;
      }
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

export interface ActiveSessionSnapshot {
  savedAt: number;
  settings: SessionSettings;
  startedAt: number;
  attempts: number;
  correct: number;
  bestStreak: number;
  typedChars: number;
  currentStreak: number;
  currentExpressionId: string | null;
  lastResult: SubmissionResult | null;
}

function isSubmissionResult(raw: unknown): raw is SubmissionResult {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const value = raw as SubmissionResult;
  return (
    typeof value.isCorrect === "boolean" &&
    typeof value.strategy === "string" &&
    typeof value.mismatchRatio === "number" &&
    typeof value.inputLatex === "string" &&
    typeof value.targetLatex === "string"
  );
}

function isActiveSessionSnapshot(raw: unknown): raw is ActiveSessionSnapshot {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const value = raw as ActiveSessionSnapshot;
  return (
    typeof value.savedAt === "number" &&
    typeof value.startedAt === "number" &&
    typeof value.attempts === "number" &&
    typeof value.correct === "number" &&
    typeof value.bestStreak === "number" &&
    typeof value.typedChars === "number" &&
    typeof value.currentStreak === "number" &&
    (typeof value.currentExpressionId === "string" || value.currentExpressionId === null) &&
    (value.lastResult === null || isSubmissionResult(value.lastResult))
  );
}

export function loadActiveSession(): ActiveSessionSnapshot | null {
  if (!hasLocalStorage()) {
    return null;
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY));
  if (!isActiveSessionSnapshot(parsed)) {
    return null;
  }

  return {
    ...parsed,
    settings: sanitizeSettings(parsed.settings)
  };
}

export function saveActiveSession(snapshot: ActiveSessionSnapshot): void {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearActiveSession(): void {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}
