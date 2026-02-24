import { ALL_TOPIC_IDS } from "../data/topics";
import type { BestScores, Difficulty, SessionRecord, SessionSettings, SubmissionResult, TopicId } from "../types";

export const SETTINGS_STORAGE_KEY = "mathTyper.settings.v1";
export const HISTORY_STORAGE_KEY = "mathTyper.history.v1";
export const ACTIVE_SESSION_STORAGE_KEY = "mathTyper.activeSession.v1";
const HISTORY_LIMIT = 500;
const BEST_SCORES_LIMIT = 5;
const DIFFICULTY_ORDER: Difficulty[] = ["beginner", "intermediate", "advanced"];

export const DEFAULT_SETTINGS: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulties: [...DIFFICULTY_ORDER],
  selectedTopicIds: [...ALL_TOPIC_IDS],
  selectedSubtopicsByTopic: {},
  revealLatex: false
};

function createEmptyDifficultyStats(): SessionRecord["stats"]["byDifficulty"] {
  return {
    beginner: { given: 0, solved: 0 },
    intermediate: { given: 0, solved: 0 },
    advanced: { given: 0, solved: 0 }
  };
}

function sanitizeDifficultyStats(
  raw: unknown,
  fallbackSettings: SessionSettings | null,
  fallbackAttempts: number,
  fallbackCorrect: number
): SessionRecord["stats"]["byDifficulty"] {
  const empty = createEmptyDifficultyStats();
  const toNonNegativeNumber = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  if (raw && typeof raw === "object") {
    const input = raw as Record<string, unknown>;
    return {
      beginner: {
        given: toNonNegativeNumber((input.beginner as { given?: unknown } | undefined)?.given),
        solved: toNonNegativeNumber((input.beginner as { solved?: unknown } | undefined)?.solved)
      },
      intermediate: {
        given: toNonNegativeNumber((input.intermediate as { given?: unknown } | undefined)?.given),
        solved: toNonNegativeNumber((input.intermediate as { solved?: unknown } | undefined)?.solved)
      },
      advanced: {
        given: toNonNegativeNumber((input.advanced as { given?: unknown } | undefined)?.given),
        solved: toNonNegativeNumber((input.advanced as { solved?: unknown } | undefined)?.solved)
      }
    };
  }

  if (fallbackSettings && fallbackSettings.difficulties.length === 1) {
    const difficulty = fallbackSettings.difficulties[0];
    empty[difficulty] = {
      given: Math.max(0, fallbackAttempts),
      solved: Math.max(0, fallbackCorrect)
    };
  }

  return empty;
}

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

function sanitizeSubtopicsMap(raw: unknown): Record<TopicId, string[]> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const value = raw as Record<string, unknown>;
  const result: Record<TopicId, string[]> = {};

  for (const topicId of ALL_TOPIC_IDS) {
    const entry = value[topicId];
    if (!Array.isArray(entry)) {
      continue;
    }
    const unique = [...new Set(entry.filter((item): item is string => typeof item === "string"))];
    result[topicId] = unique.sort((left, right) => left.localeCompare(right));
  }

  return result;
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
    selectedSubtopicsByTopic: sanitizeSubtopicsMap(input.selectedSubtopicsByTopic),
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
  const settings = sanitizeSettings(raw.settings);
  return {
    ...raw,
    settings,
    stats: {
      ...raw.stats,
      byDifficulty: sanitizeDifficultyStats(
        (raw.stats as { byDifficulty?: unknown }).byDifficulty,
        settings,
        raw.stats.attempts,
        raw.stats.correct
      )
    }
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

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBestnessScore(record: SessionRecord): number {
  const byDifficulty = record.stats.byDifficulty;
  const weightedGiven =
    byDifficulty.beginner.given * 1 +
    byDifficulty.intermediate.given * 1.8 +
    byDifficulty.advanced.given * 3;
  const weightedSolved =
    byDifficulty.beginner.solved * 1 +
    byDifficulty.intermediate.solved * 1.8 +
    byDifficulty.advanced.solved * 3;
  const weightedSolvedRatio = weightedGiven > 0 ? (weightedSolved / weightedGiven) * 100 : 0;
  const normalizedCorrect = clampToRange((record.stats.correct / 20) * 100, 0, 100);
  const hardSolvedBonus = byDifficulty.advanced.solved > 0 ? 100 : 0;
  const score =
    0.45 * record.stats.accuracy +
    0.3 * weightedSolvedRatio +
    0.2 * normalizedCorrect +
    0.05 * hardSolvedBonus;
  return Number(score.toFixed(4));
}

function compareBestness(left: SessionRecord, right: SessionRecord): number {
  const scoreGap = getBestnessScore(right) - getBestnessScore(left);
  if (scoreGap !== 0) {
    return scoreGap;
  }

  const hardSolvedGap = right.stats.byDifficulty.advanced.solved - left.stats.byDifficulty.advanced.solved;
  if (hardSolvedGap !== 0) {
    return hardSolvedGap;
  }

  const correctGap = right.stats.correct - left.stats.correct;
  if (correctGap !== 0) {
    return correctGap;
  }

  const accuracyGap = right.stats.accuracy - left.stats.accuracy;
  if (accuracyGap !== 0) {
    return accuracyGap;
  }

  return right.endedAt - left.endedAt;
}

export function computeBestScores(history: SessionRecord[]): BestScores {
  return [...history].sort(compareBestness).slice(0, BEST_SCORES_LIMIT);
}

export interface ActiveSessionSnapshot {
  savedAt: number;
  lastActivityAt: number;
  settings: SessionSettings;
  startedAt: number;
  attempts: number;
  correct: number;
  bestStreak: number;
  typedChars: number;
  byDifficulty: SessionRecord["stats"]["byDifficulty"];
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
    (value.lastActivityAt === undefined || typeof value.lastActivityAt === "number") &&
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
    lastActivityAt:
      typeof (parsed as { lastActivityAt?: unknown }).lastActivityAt === "number"
        ? (parsed as { lastActivityAt: number }).lastActivityAt
        : parsed.startedAt,
    settings: sanitizeSettings(parsed.settings),
    byDifficulty: sanitizeDifficultyStats(
      (parsed as { byDifficulty?: unknown }).byDifficulty,
      sanitizeSettings(parsed.settings),
      parsed.attempts,
      parsed.correct
    )
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
