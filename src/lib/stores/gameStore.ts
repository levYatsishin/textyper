import { writable } from "svelte/store";
import { getTopicScopedSubtopics } from "../services/topicSubtopics";
import { compareLatex } from "../services/matcher";
import { createEmptyStats, toSessionStats } from "../services/metrics";
import {
  clearActiveSession,
  computeBestScores,
  DEFAULT_SETTINGS,
  loadActiveSession,
  loadHistory,
  loadSettings,
  saveActiveSession,
  sanitizeSettings,
  saveHistory,
  saveSettings
} from "../services/persistence";
import type {
  CompareLatexFn,
  Difficulty,
  Expression,
  GameState,
  GameStore,
  SessionRecord,
  SessionSettings
} from "../types";

interface GameStoreOptions {
  matcher?: CompareLatexFn;
  now?: () => number;
  random?: () => number;
  timerIntervalMs?: number;
  setTimer?: typeof setInterval;
  clearTimer?: typeof clearInterval;
}

const DEFAULT_TIMER_INTERVAL_MS = 250;
const ZEN_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
export const POOL_RESTART_LOCK_MS = 1050;

function getTimeLimitMs(settings: SessionSettings): number | null {
  return settings.mode === "timed" ? settings.durationSec * 1000 : null;
}

function getExpressionPool(
  expressions: Expression[],
  difficulties: SessionSettings["difficulties"],
  selectedTopicIds: SessionSettings["selectedTopicIds"],
  selectedSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"]
): Expression[] {
  const selectedTopics = new Set(selectedTopicIds);
  return expressions.filter(
    (item) =>
      difficulties.includes(item.difficulty) &&
      item.topics.some((topicId) => {
        if (!selectedTopics.has(topicId)) {
          return false;
        }
        const selectedSubtopics = selectedSubtopicsByTopic[topicId] ?? [];
        if (selectedSubtopics.length === 0) {
          return true;
        }
        return getTopicScopedSubtopics(item, topicId).some((subtopic) => selectedSubtopics.includes(subtopic));
      })
  );
}

function hasSameDifficulties(
  left: SessionSettings["difficulties"],
  right: SessionSettings["difficulties"]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((difficulty, index) => difficulty === right[index]);
}

function hasSameTopicIds(
  left: SessionSettings["selectedTopicIds"],
  right: SessionSettings["selectedTopicIds"]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((topicId, index) => topicId === right[index]);
}

function hasSameSubtopicsByTopic(
  left: SessionSettings["selectedSubtopicsByTopic"],
  right: SessionSettings["selectedSubtopicsByTopic"],
  topicIds: SessionSettings["selectedTopicIds"]
): boolean {
  return topicIds.every((topicId) => {
    const leftValues = left[topicId] ?? [];
    const rightValues = right[topicId] ?? [];
    if (leftValues.length !== rightValues.length) {
      return false;
    }
    return leftValues.every((value, index) => value === rightValues[index]);
  });
}

function buildSubtopicUniverse(expressions: Expression[]): Record<string, string[]> {
  const byTopic = new Map<string, Set<string>>();

  for (const expression of expressions) {
    for (const topicId of expression.topics) {
      if (!byTopic.has(topicId)) {
        byTopic.set(topicId, new Set<string>());
      }
      const subtopics = byTopic.get(topicId)!;
      for (const subtopic of getTopicScopedSubtopics(expression, topicId)) {
        subtopics.add(subtopic);
      }
    }
  }

  const result: Record<string, string[]> = {};
  for (const [topicId, subtopics] of byTopic.entries()) {
    result[topicId] = [...subtopics].sort((left, right) => left.localeCompare(right));
  }

  return result;
}

function createSessionRecord(endedAt: number, settings: SessionSettings, stats: GameState["stats"]): SessionRecord {
  return {
    id: `${endedAt}-${Math.random().toString(36).slice(2, 9)}`,
    endedAt,
    settings: { ...settings },
    stats: { ...stats }
  };
}

function incrementDifficultyStats(
  current: GameState["stats"]["byDifficulty"],
  difficulty: Difficulty,
  solvedIncrement: number
): GameState["stats"]["byDifficulty"] {
  const currentEntry = current[difficulty];
  return {
    ...current,
    [difficulty]: {
      given: currentEntry.given + 1,
      solved: currentEntry.solved + solvedIncrement
    }
  };
}

function findExpressionById(expressions: Expression[], expressionId: string | null): Expression | null {
  if (!expressionId) {
    return null;
  }
  return expressions.find((item) => item.id === expressionId) ?? null;
}

export function createGameStore(expressions: Expression[], options: GameStoreOptions = {}): GameStore {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const matcher = options.matcher ?? compareLatex;
  const setTimer = options.setTimer ?? setInterval;
  const clearTimer = options.clearTimer ?? clearInterval;
  const timerIntervalMs = options.timerIntervalMs ?? DEFAULT_TIMER_INTERVAL_MS;
  const subtopicUniverse = buildSubtopicUniverse(expressions);
  let queuedExpressionIds: string[] = [];
  let queuedExpressionKey = "";
  let hasPickedFromQueue = false;
  let excludedElapsedMs = 0;
  let activePauseStartedAt: number | null = null;

  function applySubtopicDefaults(settings: SessionSettings): SessionSettings {
    const normalizedMap: SessionSettings["selectedSubtopicsByTopic"] = {};

    for (const topicId of settings.selectedTopicIds) {
      const available = subtopicUniverse[topicId] ?? [];
      const incoming = settings.selectedSubtopicsByTopic[topicId] ?? [];
      const selected = available.filter((subtopic) => incoming.includes(subtopic));
      normalizedMap[topicId] = selected.length > 0 ? selected : [...available];
    }

    return {
      ...settings,
      selectedSubtopicsByTopic: normalizedMap
    };
  }

  function getFilterKey(
    difficulties: SessionSettings["difficulties"],
    selectedTopicIds: SessionSettings["selectedTopicIds"],
    selectedSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"]
  ): string {
    const subtopicsKey = selectedTopicIds
      .map((topicId) => `${topicId}:${(selectedSubtopicsByTopic[topicId] ?? []).join(",")}`)
      .join("|");
    return `${difficulties.join("|")}::${selectedTopicIds.join("|")}::${subtopicsKey}`;
  }

  function shuffleExpressionIds(expressionIds: string[]): string[] {
    const shuffled = [...expressionIds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function moveDifferentIdToFront(expressionIds: string[], previousId: string | null): void {
    if (!previousId || expressionIds.length <= 1 || expressionIds[0] !== previousId) {
      return;
    }
    const swapIndex = expressionIds.findIndex((expressionId) => expressionId !== previousId);
    if (swapIndex <= 0) {
      return;
    }
    [expressionIds[0], expressionIds[swapIndex]] = [expressionIds[swapIndex], expressionIds[0]];
  }

  function pickNextExpression(
    difficulties: SessionSettings["difficulties"],
    selectedTopicIds: SessionSettings["selectedTopicIds"],
    selectedSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"],
    previousId: string | null
  ): { expression: Expression | null; poolRestarted: boolean } {
    const pool = getExpressionPool(expressions, difficulties, selectedTopicIds, selectedSubtopicsByTopic);
    if (pool.length === 0) {
      return { expression: null, poolRestarted: false };
    }

    const key = getFilterKey(difficulties, selectedTopicIds, selectedSubtopicsByTopic);
    if (key !== queuedExpressionKey) {
      queuedExpressionKey = key;
      queuedExpressionIds = [];
      hasPickedFromQueue = false;
    }

    const poolIdSet = new Set(pool.map((item) => item.id));
    queuedExpressionIds = queuedExpressionIds.filter((expressionId) => poolIdSet.has(expressionId));

    let poolRestarted = false;
    if (queuedExpressionIds.length === 0) {
      poolRestarted = hasPickedFromQueue;
      queuedExpressionIds = shuffleExpressionIds(pool.map((item) => item.id));
    }

    moveDifferentIdToFront(queuedExpressionIds, previousId);

    const pickedExpressionId = queuedExpressionIds.shift() ?? null;
    if (!pickedExpressionId) {
      return { expression: null, poolRestarted };
    }

    const picked = pool.find((item) => item.id === pickedExpressionId) ?? null;
    hasPickedFromQueue = picked !== null;
    return { expression: picked, poolRestarted };
  }

  function resetExpressionCycle(
    difficulties: SessionSettings["difficulties"],
    selectedTopicIds: SessionSettings["selectedTopicIds"],
    selectedSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"],
    _currentExpressionId: string | null = null
  ): void {
    queuedExpressionKey = getFilterKey(difficulties, selectedTopicIds, selectedSubtopicsByTopic);
    queuedExpressionIds = [];
    hasPickedFromQueue = false;
  }

  function syncElapsedPause(at: number): void {
    if (activePauseStartedAt === null) {
      return;
    }
    if (at - activePauseStartedAt >= POOL_RESTART_LOCK_MS) {
      excludedElapsedMs += POOL_RESTART_LOCK_MS;
      activePauseStartedAt = null;
    }
  }

  function getActivePauseElapsed(at: number): number {
    if (activePauseStartedAt === null) {
      return 0;
    }
    return Math.min(Math.max(0, at - activePauseStartedAt), POOL_RESTART_LOCK_MS);
  }

  function getEffectiveElapsedMs(at: number, startedAt: number): number {
    syncElapsedPause(at);
    return Math.max(0, at - startedAt - excludedElapsedMs - getActivePauseElapsed(at));
  }

  function triggerPoolRestartPause(at: number): void {
    syncElapsedPause(at);
    if (activePauseStartedAt === null) {
      activePauseStartedAt = at;
    }
  }

  const initialSettings = applySubtopicDefaults(sanitizeSettings(loadSettings()));
  const initialHistory = loadHistory();
  const initialBests = computeBestScores(initialHistory);

  const activeSnapshot = loadActiveSession();
  const restoredSettings = activeSnapshot ? applySubtopicDefaults(sanitizeSettings(activeSnapshot.settings)) : null;
  excludedElapsedMs = activeSnapshot?.excludedElapsedMs ?? 0;
  activePauseStartedAt = activeSnapshot?.activePauseStartedAt ?? null;
  const restoredElapsedMs = activeSnapshot ? getEffectiveElapsedMs(now(), activeSnapshot.startedAt) : 0;
  const restoredLastActivityAt = activeSnapshot
    ? Math.max(activeSnapshot.startedAt, activeSnapshot.lastActivityAt)
    : 0;
  const restoredLimitMs =
    restoredSettings && restoredSettings.mode === "timed" ? restoredSettings.durationSec * 1000 : null;
  const hasExpiredZenInactivity =
    !!restoredSettings &&
    !!activeSnapshot &&
    restoredSettings.mode === "practice" &&
    now() - restoredLastActivityAt >= ZEN_INACTIVITY_TIMEOUT_MS;
  const canRestoreActiveSession =
    !!activeSnapshot &&
    !(restoredLimitMs !== null && restoredElapsedMs >= restoredLimitMs) &&
    !hasExpiredZenInactivity;

  if (activeSnapshot && !canRestoreActiveSession) {
    clearActiveSession();
  }

  const initialPreviewPick = pickNextExpression(
    initialSettings.difficulties,
    initialSettings.selectedTopicIds,
    initialSettings.selectedSubtopicsByTopic,
    null
  );
  const initialPreviewExpression = initialPreviewPick.expression;

  const restoredExpression = canRestoreActiveSession && activeSnapshot && restoredSettings
    ? findExpressionById(expressions, activeSnapshot.currentExpressionId)
    : null;
  const hasRestoredExpression =
    !!restoredExpression &&
    !!restoredSettings?.difficulties.includes(restoredExpression.difficulty) &&
    restoredExpression.topics.some((topicId) => {
      if (!restoredSettings.selectedTopicIds.includes(topicId)) {
        return false;
      }
      const selectedSubtopics = restoredSettings.selectedSubtopicsByTopic[topicId] ?? [];
      if (selectedSubtopics.length === 0) {
        return true;
      }
      return getTopicScopedSubtopics(restoredExpression, topicId).some((subtopic) =>
        selectedSubtopics.includes(subtopic)
      );
    });

  let state: GameState = canRestoreActiveSession && activeSnapshot && restoredSettings
    ? {
        status: "running",
        settings: restoredSettings,
        stats: toSessionStats({
          startedAt: activeSnapshot.startedAt,
          elapsedMs: restoredElapsedMs,
          attempts: activeSnapshot.attempts,
          correct: activeSnapshot.correct,
          bestStreak: activeSnapshot.bestStreak,
          typedChars: activeSnapshot.typedChars,
          byDifficulty: activeSnapshot.byDifficulty
        }),
        currentExpression:
          (hasRestoredExpression ? restoredExpression : null) ??
          pickNextExpression(
            restoredSettings.difficulties,
            restoredSettings.selectedTopicIds,
            restoredSettings.selectedSubtopicsByTopic,
            null
          ).expression,
        poolRestartedAt: null,
        remainingMs:
          restoredLimitMs === null ? null : Math.max(0, restoredLimitMs - restoredElapsedMs),
        currentStreak: activeSnapshot.currentStreak,
        typedChars: activeSnapshot.typedChars,
        isSubmitting: false,
        lastResult: activeSnapshot.lastResult,
        history: initialHistory,
        bests: initialBests,
        lastSession: null
      }
    : {
        status: "idle",
        settings: initialSettings,
        stats: createEmptyStats(now()),
        currentExpression: initialPreviewExpression,
        poolRestartedAt: null,
        remainingMs: getTimeLimitMs(initialSettings),
        currentStreak: 0,
        typedChars: 0,
        isSubmitting: false,
        lastResult: null,
        history: initialHistory,
        bests: initialBests,
        lastSession: null
      };

  let lastActivityAt = canRestoreActiveSession ? restoredLastActivityAt : now();

  if (!canRestoreActiveSession) {
    excludedElapsedMs = 0;
    activePauseStartedAt = null;
  }

  if (state.status === "running") {
    resetExpressionCycle(
      state.settings.difficulties,
      state.settings.selectedTopicIds,
      state.settings.selectedSubtopicsByTopic,
      state.currentExpression?.id ?? null
    );
  }

  const store = writable<GameState>(state);
  let timer: ReturnType<typeof setInterval> | null = null;

  function setState(nextState: GameState): void {
    if (nextState.status === "running") {
      syncElapsedPause(now());
      saveActiveSession({
        savedAt: now(),
        lastActivityAt,
        settings: nextState.settings,
        startedAt: nextState.stats.startedAt,
        excludedElapsedMs,
        activePauseStartedAt,
        attempts: nextState.stats.attempts,
        correct: nextState.stats.correct,
        bestStreak: nextState.stats.bestStreak,
        typedChars: nextState.typedChars,
        byDifficulty: nextState.stats.byDifficulty,
        currentStreak: nextState.currentStreak,
        currentExpressionId: nextState.currentExpression?.id ?? null,
        lastResult: nextState.lastResult
      });
    } else {
      clearActiveSession();
    }

    state = nextState;
    store.set(nextState);
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function finalizeSession(currentState: GameState, endedAt: number): GameState {
    const elapsedMs = getEffectiveElapsedMs(endedAt, currentState.stats.startedAt);
    const finalStats = toSessionStats({
      startedAt: currentState.stats.startedAt,
      elapsedMs,
      attempts: currentState.stats.attempts,
      correct: currentState.stats.correct,
      bestStreak: currentState.stats.bestStreak,
      typedChars: currentState.typedChars,
      byDifficulty: currentState.stats.byDifficulty
    });

    let record: SessionRecord | null = null;
    let history = currentState.history;
    let bests = currentState.bests;

    if (finalStats.attempts > 0) {
      record = createSessionRecord(endedAt, currentState.settings, finalStats);
      history = saveHistory([record, ...currentState.history]);
      bests = computeBestScores(history);
    }
    saveSettings(currentState.settings);
    stopTimer();

    return {
      ...currentState,
      status: "ended",
      stats: finalStats,
      remainingMs: currentState.settings.mode === "timed" ? 0 : null,
      isSubmitting: false,
      history,
      bests,
      lastSession: record
    };
  }

  function tick(): void {
    if (state.status !== "running") {
      return;
    }
    const sessionStartedAt = state.stats.startedAt;

    const currentTime = now();
    const elapsedMs = getEffectiveElapsedMs(currentTime, state.stats.startedAt);
    const limitMs = getTimeLimitMs(state.settings);
    const stats = toSessionStats({
      startedAt: state.stats.startedAt,
      elapsedMs,
      attempts: state.stats.attempts,
      correct: state.stats.correct,
      bestStreak: state.stats.bestStreak,
      typedChars: state.typedChars,
      byDifficulty: state.stats.byDifficulty
    });

    let nextState: GameState = {
      ...state,
      stats,
      remainingMs: limitMs === null ? null : Math.max(0, limitMs - elapsedMs)
    };

    if (state.settings.mode === "practice" && currentTime - lastActivityAt >= ZEN_INACTIVITY_TIMEOUT_MS) {
      nextState = finalizeSession(nextState, currentTime);
    } else if (limitMs !== null && elapsedMs >= limitMs) {
      nextState = finalizeSession(nextState, currentTime);
    }

    if (state.status !== "running" || state.stats.startedAt !== sessionStartedAt) {
      return;
    }
    setState(nextState);
  }

  function startTimerLoop(): void {
    stopTimer();
    timer = setTimer(tick, timerIntervalMs);
  }

  function normalizeSettings(settings: Partial<SessionSettings>): SessionSettings {
    return applySubtopicDefaults(
      sanitizeSettings({
        ...DEFAULT_SETTINGS,
        ...state.settings,
        ...settings
      })
    );
  }

  function start(settings?: Partial<SessionSettings>): void {
    const nextSettings = normalizeSettings(settings ?? {});
    const startedAt = now();
    lastActivityAt = startedAt;
    resetExpressionCycle(
      nextSettings.difficulties,
      nextSettings.selectedTopicIds,
      nextSettings.selectedSubtopicsByTopic
    );
    excludedElapsedMs = 0;
    activePauseStartedAt = null;
    const firstPick = pickNextExpression(
      nextSettings.difficulties,
      nextSettings.selectedTopicIds,
      nextSettings.selectedSubtopicsByTopic,
      null
    );

    setState({
      ...state,
      status: "running",
      settings: nextSettings,
      stats: createEmptyStats(startedAt),
      currentExpression: firstPick.expression,
      poolRestartedAt: null,
      remainingMs: getTimeLimitMs(nextSettings),
      currentStreak: 0,
      typedChars: 0,
      isSubmitting: false,
      lastResult: null,
      lastSession: null
    });

    saveSettings(nextSettings);
    startTimerLoop();
  }

  async function submit(inputLatex: string): Promise<void> {
    if (state.status !== "running" || !state.currentExpression || state.isSubmitting) {
      return;
    }

    const sessionStartedAt = state.stats.startedAt;
    const targetExpression = state.currentExpression;

    setState({
      ...state,
      isSubmitting: true
    });

    const result = await matcher(inputLatex, targetExpression.latex);

    if (
      state.status !== "running" ||
      state.stats.startedAt !== sessionStartedAt ||
      state.currentExpression?.id !== targetExpression.id
    ) {
      if (state.isSubmitting) {
        setState({
          ...state,
          isSubmitting: false
        });
      }
      return;
    }

    const currentTime = now();
    const elapsedMs = getEffectiveElapsedMs(currentTime, sessionStartedAt);
    const attempts = state.stats.attempts + 1;
    const correct = state.stats.correct + (result.isMatch ? 1 : 0);
    const currentStreak = result.isMatch ? state.currentStreak + 1 : 0;
    const typedChars = state.typedChars + inputLatex.length;
    const bestStreak = Math.max(state.stats.bestStreak, currentStreak);
    const byDifficulty = incrementDifficultyStats(
      state.stats.byDifficulty,
      targetExpression.difficulty,
      result.isMatch ? 1 : 0
    );
    const stats = toSessionStats({
      startedAt: sessionStartedAt,
      elapsedMs,
      attempts,
      correct,
      bestStreak,
      typedChars,
      byDifficulty
    });
    const limitMs = getTimeLimitMs(state.settings);

    const nextPick = pickNextExpression(
      state.settings.difficulties,
      state.settings.selectedTopicIds,
      state.settings.selectedSubtopicsByTopic,
      targetExpression.id
    );

    const restartedAt = nextPick.poolRestarted ? now() : null;
    if (restartedAt !== null) {
      triggerPoolRestartPause(restartedAt);
    }

    let nextState: GameState = {
      ...state,
      stats,
      typedChars,
      isSubmitting: false,
      currentStreak,
      currentExpression: nextPick.expression,
      poolRestartedAt: restartedAt ?? state.poolRestartedAt,
      remainingMs: limitMs === null ? null : Math.max(0, limitMs - elapsedMs),
      lastResult: {
        isCorrect: result.isMatch,
        strategy: result.strategy,
        mismatchRatio: result.mismatchRatio,
        inputLatex,
        targetLatex: targetExpression.latex
      }
    };

    if (limitMs !== null && elapsedMs >= limitMs) {
      nextState = finalizeSession(nextState, now());
    }

    setState(nextState);
  }

  function skip(): void {
    if (state.status !== "running" || !state.currentExpression || state.isSubmitting) {
      return;
    }

    const currentTime = now();
    const elapsedMs = getEffectiveElapsedMs(currentTime, state.stats.startedAt);
    lastActivityAt = currentTime;
    const attempts = state.stats.attempts + 1;
    const stats = toSessionStats({
      startedAt: state.stats.startedAt,
      elapsedMs,
      attempts,
      correct: state.stats.correct,
      bestStreak: state.stats.bestStreak,
      typedChars: state.typedChars,
      byDifficulty: incrementDifficultyStats(state.stats.byDifficulty, state.currentExpression.difficulty, 0)
    });
    const limitMs = getTimeLimitMs(state.settings);

    const nextPick = pickNextExpression(
      state.settings.difficulties,
      state.settings.selectedTopicIds,
      state.settings.selectedSubtopicsByTopic,
      state.currentExpression.id
    );

    const restartedAt = nextPick.poolRestarted ? now() : null;
    if (restartedAt !== null) {
      triggerPoolRestartPause(restartedAt);
    }

    let nextState: GameState = {
      ...state,
      stats,
      currentStreak: 0,
      currentExpression: nextPick.expression,
      poolRestartedAt: restartedAt ?? state.poolRestartedAt,
      remainingMs: limitMs === null ? null : Math.max(0, limitMs - elapsedMs),
      lastResult: {
        isCorrect: false,
        strategy: "fail",
        mismatchRatio: 1,
        inputLatex: "",
        targetLatex: state.currentExpression.latex
      }
    };

    if (limitMs !== null && elapsedMs >= limitMs) {
      nextState = finalizeSession(nextState, now());
    }

    setState(nextState);
  }

  function toggleReveal(on?: boolean): void {
    const revealLatex = typeof on === "boolean" ? on : !state.settings.revealLatex;
    const settings = {
      ...state.settings,
      revealLatex
    };
    saveSettings(settings);
    setState({
      ...state,
      settings
    });
  }

  function registerActivity(): void {
    if (state.status !== "running") {
      return;
    }
    lastActivityAt = now();
  }

  function updateSettings(settingsPatch: Partial<SessionSettings>): void {
    const previousSettings = state.settings;
    const nextSettings = normalizeSettings(settingsPatch);
    const elapsedMs = state.status === "running" ? getEffectiveElapsedMs(now(), state.stats.startedAt) : 0;
    const limitMs = getTimeLimitMs(nextSettings);
    const difficultiesChanged = !hasSameDifficulties(nextSettings.difficulties, previousSettings.difficulties);
    const topicsChanged = !hasSameTopicIds(nextSettings.selectedTopicIds, previousSettings.selectedTopicIds);
    const subtopicsChanged = !hasSameSubtopicsByTopic(
      nextSettings.selectedSubtopicsByTopic,
      previousSettings.selectedSubtopicsByTopic,
      nextSettings.selectedTopicIds
    );
    const filtersChanged = difficultiesChanged || topicsChanged || subtopicsChanged;

    let nextState: GameState = {
      ...state,
      settings: nextSettings,
      remainingMs:
        state.status === "running"
          ? limitMs === null
            ? null
            : Math.max(0, limitMs - elapsedMs)
          : limitMs
    };

    if (state.status === "running" && filtersChanged) {
      resetExpressionCycle(
        nextSettings.difficulties,
        nextSettings.selectedTopicIds,
        nextSettings.selectedSubtopicsByTopic,
        state.currentExpression?.id ?? null
      );
      nextState = {
        ...nextState,
        currentExpression: pickNextExpression(
          nextSettings.difficulties,
          nextSettings.selectedTopicIds,
          nextSettings.selectedSubtopicsByTopic,
          state.currentExpression?.id ?? null
        ).expression,
        poolRestartedAt: null
      };
    } else if (state.status !== "running" && filtersChanged) {
      resetExpressionCycle(
        nextSettings.difficulties,
        nextSettings.selectedTopicIds,
        nextSettings.selectedSubtopicsByTopic,
        state.currentExpression?.id ?? null
      );
      nextState = {
        ...nextState,
        currentExpression: pickNextExpression(
          nextSettings.difficulties,
          nextSettings.selectedTopicIds,
          nextSettings.selectedSubtopicsByTopic,
          state.currentExpression?.id ?? null
        ).expression,
        poolRestartedAt: null
      };
    }

    setState(nextState);
    saveSettings(nextSettings);

    if (state.status === "running") {
      if (nextSettings.mode === "timed" && limitMs !== null && elapsedMs >= limitMs) {
        end();
        return;
      }
      startTimerLoop();
    }
  }

  function end(): void {
    if (state.status !== "running") {
      return;
    }
    setState(finalizeSession(state, now()));
  }

  function reset(): void {
    start(state.settings);
  }

  function dismissResults(): void {
    if (state.status !== "ended") {
      return;
    }

    setState({
      ...state,
      status: "idle",
      isSubmitting: false,
      lastResult: null,
      remainingMs: getTimeLimitMs(state.settings)
    });
  }

  function loadHistoryIntoState(): void {
    const history = loadHistory();
    const bests = computeBestScores(history);

    setState({
      ...state,
      history,
      bests
    });
  }

  function clearHistoryRecords(): void {
    const history = saveHistory([]);
    const bests = computeBestScores(history);
    setState({
      ...state,
      history,
      bests
    });
  }

  function deleteHistoryRecord(sessionId: string): void {
    const history = saveHistory(state.history.filter((record) => record.id !== sessionId));
    const bests = computeBestScores(history);
    setState({
      ...state,
      history,
      bests,
      lastSession: state.lastSession?.id === sessionId ? null : state.lastSession
    });
  }

  if (state.status === "running") {
    startTimerLoop();
  }

  return {
    subscribe: store.subscribe,
    start,
    submit,
    skip,
    registerActivity,
    toggleReveal,
    reset,
    end,
    dismissResults,
    loadHistory: loadHistoryIntoState,
    clearHistory: clearHistoryRecords,
    deleteHistoryRecord,
    updateSettings
  };
}
