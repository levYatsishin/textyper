import { ALL_TOPIC_IDS } from "../data/topics";
import {
  DEFAULT_EXPANSION_SETTINGS,
  DEFAULT_EXPANSION_VARIABLES_SOURCE,
  DEFAULT_OBSIDIAN_SNIPPETS_SOURCE
} from "../data/expansionsDefaults";
import type {
  BestScores,
  Difficulty,
  ExpansionSettings,
  SessionRecord,
  SessionSettings,
  SubmissionResult,
  TopicId
} from "../types";

export const SETTINGS_STORAGE_KEY = "mathTyper.settings.v1";
export const HISTORY_STORAGE_KEY = "mathTyper.history.v1";
export const ACTIVE_SESSION_STORAGE_KEY = "mathTyper.activeSession.v1";
export const EXPANSION_SETTINGS_STORAGE_KEY = "mathTyper.expansions.settings.v1";
export const EXPANSION_SNIPPETS_STORAGE_KEY = "mathTyper.expansions.snippets.v1";
export const EXPANSION_VARIABLES_STORAGE_KEY = "mathTyper.expansions.variables.v1";
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

function sanitizeStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) {
    return [...fallback];
  }
  const unique = [...new Set(raw.filter((item): item is string => typeof item === "string").map((item) => item.trim()))];
  return unique.filter((item) => item.length > 0);
}

function sanitizeAutoEnlargeTriggers(raw: unknown, fallback: string[]): string[] {
  const sanitized = sanitizeStringArray(raw, fallback);
  if (sanitized.length === 0) {
    return [...fallback];
  }

  const legacyShortcutMode = sanitized.every((trigger) => trigger.startsWith("lr"));
  if (legacyShortcutMode) {
    return [...fallback];
  }

  return sanitized.map((trigger) => {
    if (/^[A-Za-z]+$/.test(trigger)) {
      return `\\${trigger}`;
    }
    return trigger;
  });
}

function sanitizeExpansionHelperSettings(raw: unknown): ExpansionSettings["helpers"] {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_EXPANSION_SETTINGS.helpers,
      matrixShortcutEnvironments: [...DEFAULT_EXPANSION_SETTINGS.helpers.matrixShortcutEnvironments],
      taboutClosingSymbols: [...DEFAULT_EXPANSION_SETTINGS.helpers.taboutClosingSymbols],
      autoEnlargeTriggers: [...DEFAULT_EXPANSION_SETTINGS.helpers.autoEnlargeTriggers]
    };
  }

  const input = raw as Partial<ExpansionSettings["helpers"]>;
  return {
    autofractionEnabled:
      typeof input.autofractionEnabled === "boolean"
        ? input.autofractionEnabled
        : DEFAULT_EXPANSION_SETTINGS.helpers.autofractionEnabled,
    taboutEnabled:
      typeof input.taboutEnabled === "boolean" ? input.taboutEnabled : DEFAULT_EXPANSION_SETTINGS.helpers.taboutEnabled,
    matrixShortcutsEnabled:
      typeof input.matrixShortcutsEnabled === "boolean"
        ? input.matrixShortcutsEnabled
        : DEFAULT_EXPANSION_SETTINGS.helpers.matrixShortcutsEnabled,
    autoEnlargeBracketsEnabled:
      typeof input.autoEnlargeBracketsEnabled === "boolean"
        ? input.autoEnlargeBracketsEnabled
        : DEFAULT_EXPANSION_SETTINGS.helpers.autoEnlargeBracketsEnabled,
    autofractionSymbol:
      typeof input.autofractionSymbol === "string" && input.autofractionSymbol.trim().length > 0
        ? input.autofractionSymbol
        : DEFAULT_EXPANSION_SETTINGS.helpers.autofractionSymbol,
    autofractionBreakingChars:
      typeof input.autofractionBreakingChars === "string"
        ? input.autofractionBreakingChars
        : DEFAULT_EXPANSION_SETTINGS.helpers.autofractionBreakingChars,
    matrixShortcutEnvironments: sanitizeStringArray(
      input.matrixShortcutEnvironments,
      DEFAULT_EXPANSION_SETTINGS.helpers.matrixShortcutEnvironments
    ),
    taboutClosingSymbols: sanitizeStringArray(
      input.taboutClosingSymbols,
      DEFAULT_EXPANSION_SETTINGS.helpers.taboutClosingSymbols
    ),
    autoEnlargeTriggers: sanitizeAutoEnlargeTriggers(
      input.autoEnlargeTriggers,
      DEFAULT_EXPANSION_SETTINGS.helpers.autoEnlargeTriggers
    )
  };
}

export function sanitizeExpansionSettings(raw: unknown): ExpansionSettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_EXPANSION_SETTINGS,
      helpers: sanitizeExpansionHelperSettings(DEFAULT_EXPANSION_SETTINGS.helpers)
    };
  }

  const input = raw as Partial<ExpansionSettings>;
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_EXPANSION_SETTINGS.enabled,
    sourceFormat: "obsidian",
    manualTriggerKey: "Tab",
    wordDelimiters:
      typeof input.wordDelimiters === "string" && input.wordDelimiters.length > 0
        ? input.wordDelimiters
        : DEFAULT_EXPANSION_SETTINGS.wordDelimiters,
    helpers: sanitizeExpansionHelperSettings(input.helpers)
  };
}

export function loadExpansionSettings(): ExpansionSettings {
  if (!hasLocalStorage()) {
    return sanitizeExpansionSettings(null);
  }

  const parsed = safeParseJson<unknown>(localStorage.getItem(EXPANSION_SETTINGS_STORAGE_KEY));
  return sanitizeExpansionSettings(parsed);
}

export function saveExpansionSettings(settings: ExpansionSettings): void {
  if (!hasLocalStorage()) {
    return;
  }
  localStorage.setItem(EXPANSION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function sanitizeSourceString(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim().length > 0 ? raw : fallback;
}

export function loadExpansionSnippetSource(): string {
  if (!hasLocalStorage()) {
    return DEFAULT_OBSIDIAN_SNIPPETS_SOURCE;
  }
  return sanitizeSourceString(localStorage.getItem(EXPANSION_SNIPPETS_STORAGE_KEY), DEFAULT_OBSIDIAN_SNIPPETS_SOURCE);
}

export function saveExpansionSnippetSource(source: string): void {
  if (!hasLocalStorage()) {
    return;
  }
  localStorage.setItem(EXPANSION_SNIPPETS_STORAGE_KEY, source);
}

export function loadExpansionVariablesSource(): string {
  if (!hasLocalStorage()) {
    return DEFAULT_EXPANSION_VARIABLES_SOURCE;
  }
  return sanitizeSourceString(localStorage.getItem(EXPANSION_VARIABLES_STORAGE_KEY), DEFAULT_EXPANSION_VARIABLES_SOURCE);
}

export function saveExpansionVariablesSource(source: string): void {
  if (!hasLocalStorage()) {
    return;
  }
  localStorage.setItem(EXPANSION_VARIABLES_STORAGE_KEY, source);
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
  const attemptsConfidence = clampToRange(record.stats.attempts / 12, 0, 1);
  const confidenceAdjustedAccuracy = record.stats.accuracy * (0.35 + attemptsConfidence * 0.65);
  const normalizedCorrect = clampToRange((record.stats.correct / 20) * 100, 0, 100);
  const hardSolvedBonus = byDifficulty.advanced.solved > 0 ? 100 : 0;
  const score =
    0.35 * confidenceAdjustedAccuracy +
    0.35 * weightedSolvedRatio +
    0.25 * normalizedCorrect +
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
  excludedElapsedMs: number;
  activePauseStartedAt: number | null;
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
    ((value as { excludedElapsedMs?: unknown }).excludedElapsedMs === undefined ||
      typeof (value as { excludedElapsedMs?: unknown }).excludedElapsedMs === "number") &&
    ((value as { activePauseStartedAt?: unknown }).activePauseStartedAt === undefined ||
      typeof (value as { activePauseStartedAt?: unknown }).activePauseStartedAt === "number" ||
      (value as { activePauseStartedAt?: unknown }).activePauseStartedAt === null) &&
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
    excludedElapsedMs:
      typeof (parsed as { excludedElapsedMs?: unknown }).excludedElapsedMs === "number"
        ? (parsed as { excludedElapsedMs: number }).excludedElapsedMs
        : 0,
    activePauseStartedAt:
      typeof (parsed as { activePauseStartedAt?: unknown }).activePauseStartedAt === "number"
        ? (parsed as { activePauseStartedAt: number }).activePauseStartedAt
        : null,
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
