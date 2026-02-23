import { writable } from "svelte/store";
import { compareLatex } from "../services/matcher";
import { createEmptyStats, toSessionStats } from "../services/metrics";
import {
  clearActiveSession,
  computeBestScores,
  DEFAULT_SETTINGS,
  loadActiveSession,
  loadBestScores,
  loadHistory,
  loadSettings,
  saveActiveSession,
  sanitizeSettings,
  saveBestScores,
  saveHistory,
  saveSettings
} from "../services/persistence";
import type {
  CompareLatexFn,
  Expression,
  GameState,
  GameStore,
  SessionRecord,
  SessionSettings
} from "../types";

interface GameStoreOptions {
  matcher?: CompareLatexFn;
  now?: () => number;
  timerIntervalMs?: number;
  setTimer?: typeof setInterval;
  clearTimer?: typeof clearInterval;
}

const DEFAULT_TIMER_INTERVAL_MS = 250;

function getTimeLimitMs(settings: SessionSettings): number | null {
  return settings.mode === "timed" ? settings.durationSec * 1000 : null;
}

function pickExpression(
  expressions: Expression[],
  difficulty: SessionSettings["difficulty"],
  previousId: string | null
): Expression | null {
  const pool =
    difficulty === "mixed" ? expressions : expressions.filter((item) => item.difficulty === difficulty);

  if (pool.length === 0) {
    return null;
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const candidates = previousId ? pool.filter((item) => item.id !== previousId) : pool;
  const source = candidates.length > 0 ? candidates : pool;
  const index = Math.floor(Math.random() * source.length);
  return source[index];
}

function createSessionRecord(endedAt: number, settings: SessionSettings, stats: GameState["stats"]): SessionRecord {
  return {
    id: `${endedAt}-${Math.random().toString(36).slice(2, 9)}`,
    endedAt,
    settings: { ...settings },
    stats: { ...stats }
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
  const matcher = options.matcher ?? compareLatex;
  const setTimer = options.setTimer ?? setInterval;
  const clearTimer = options.clearTimer ?? clearInterval;
  const timerIntervalMs = options.timerIntervalMs ?? DEFAULT_TIMER_INTERVAL_MS;

  const initialSettings = sanitizeSettings(loadSettings());
  const initialHistory = loadHistory();
  const storedBests = loadBestScores();
  const initialBests = Object.keys(storedBests).length > 0 ? storedBests : computeBestScores(initialHistory);
  if (Object.keys(storedBests).length === 0 && initialHistory.length > 0) {
    saveBestScores(initialBests);
  }

  const activeSnapshot = loadActiveSession();
  const restoredSettings = activeSnapshot ? sanitizeSettings(activeSnapshot.settings) : null;
  const restoredElapsedMs = activeSnapshot ? Math.max(0, now() - activeSnapshot.startedAt) : 0;
  const restoredLimitMs =
    restoredSettings && restoredSettings.mode === "timed" ? restoredSettings.durationSec * 1000 : null;
  const canRestoreActiveSession =
    !!activeSnapshot && !(restoredLimitMs !== null && restoredElapsedMs >= restoredLimitMs);

  if (activeSnapshot && !canRestoreActiveSession) {
    clearActiveSession();
  }

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
          typedChars: activeSnapshot.typedChars
        }),
        currentExpression:
          findExpressionById(expressions, activeSnapshot.currentExpressionId) ??
          pickExpression(expressions, restoredSettings.difficulty, null),
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
    currentExpression: null,
    remainingMs: getTimeLimitMs(initialSettings),
    currentStreak: 0,
    typedChars: 0,
    isSubmitting: false,
    lastResult: null,
    history: initialHistory,
    bests: initialBests,
    lastSession: null
  };

  const store = writable<GameState>(state);
  let timer: ReturnType<typeof setInterval> | null = null;

  function setState(nextState: GameState): void {
    if (nextState.status === "running") {
      saveActiveSession({
        savedAt: now(),
        settings: nextState.settings,
        startedAt: nextState.stats.startedAt,
        attempts: nextState.stats.attempts,
        correct: nextState.stats.correct,
        bestStreak: nextState.stats.bestStreak,
        typedChars: nextState.typedChars,
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
    const elapsedMs = Math.max(0, endedAt - currentState.stats.startedAt);
    const finalStats = toSessionStats({
      startedAt: currentState.stats.startedAt,
      elapsedMs,
      attempts: currentState.stats.attempts,
      correct: currentState.stats.correct,
      bestStreak: currentState.stats.bestStreak,
      typedChars: currentState.typedChars
    });

    let record: SessionRecord | null = null;
    let history = currentState.history;
    let bests = currentState.bests;

    if (finalStats.attempts > 0) {
      record = createSessionRecord(endedAt, currentState.settings, finalStats);
      history = saveHistory([record, ...currentState.history]);
      bests = computeBestScores(history);
      saveBestScores(bests);
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

    const elapsedMs = Math.max(0, now() - state.stats.startedAt);
    const limitMs = getTimeLimitMs(state.settings);
    const stats = toSessionStats({
      startedAt: state.stats.startedAt,
      elapsedMs,
      attempts: state.stats.attempts,
      correct: state.stats.correct,
      bestStreak: state.stats.bestStreak,
      typedChars: state.typedChars
    });

    let nextState: GameState = {
      ...state,
      stats,
      remainingMs: limitMs === null ? null : Math.max(0, limitMs - elapsedMs)
    };

    if (limitMs !== null && elapsedMs >= limitMs) {
      nextState = finalizeSession(nextState, now());
    }

    setState(nextState);
  }

  function startTimerLoop(): void {
    stopTimer();
    timer = setTimer(tick, timerIntervalMs);
  }

  function normalizeSettings(settings: Partial<SessionSettings>): SessionSettings {
    return sanitizeSettings({
      ...DEFAULT_SETTINGS,
      ...state.settings,
      ...settings
    });
  }

  function start(settings?: Partial<SessionSettings>): void {
    const nextSettings = normalizeSettings(settings ?? {});
    const startedAt = now();
    const firstExpression = pickExpression(expressions, nextSettings.difficulty, null);

    setState({
      ...state,
      status: "running",
      settings: nextSettings,
      stats: createEmptyStats(startedAt),
      currentExpression: firstExpression,
      remainingMs: getTimeLimitMs(nextSettings),
      currentStreak: 0,
      typedChars: 0,
      isSubmitting: false,
      lastResult: null,
      lastSession: null
    });

    saveSettings(nextSettings);
    if (nextSettings.mode === "timed") {
      startTimerLoop();
    } else {
      stopTimer();
    }
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

    const elapsedMs = Math.max(0, now() - sessionStartedAt);
    const attempts = state.stats.attempts + 1;
    const correct = state.stats.correct + (result.isMatch ? 1 : 0);
    const currentStreak = result.isMatch ? state.currentStreak + 1 : 0;
    const typedChars = state.typedChars + inputLatex.length;
    const bestStreak = Math.max(state.stats.bestStreak, currentStreak);
    const stats = toSessionStats({
      startedAt: sessionStartedAt,
      elapsedMs,
      attempts,
      correct,
      bestStreak,
      typedChars
    });
    const limitMs = getTimeLimitMs(state.settings);

    let nextState: GameState = {
      ...state,
      stats,
      typedChars,
      isSubmitting: false,
      currentStreak,
      currentExpression: pickExpression(expressions, state.settings.difficulty, targetExpression.id),
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

    const elapsedMs = Math.max(0, now() - state.stats.startedAt);
    const attempts = state.stats.attempts + 1;
    const stats = toSessionStats({
      startedAt: state.stats.startedAt,
      elapsedMs,
      attempts,
      correct: state.stats.correct,
      bestStreak: state.stats.bestStreak,
      typedChars: state.typedChars
    });
    const limitMs = getTimeLimitMs(state.settings);

    let nextState: GameState = {
      ...state,
      stats,
      currentStreak: 0,
      currentExpression: pickExpression(expressions, state.settings.difficulty, state.currentExpression.id),
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

  function updateSettings(settingsPatch: Partial<SessionSettings>): void {
    const previousSettings = state.settings;
    const nextSettings = normalizeSettings(settingsPatch);
    const elapsedMs = state.status === "running" ? Math.max(0, now() - state.stats.startedAt) : 0;
    const limitMs = getTimeLimitMs(nextSettings);
    const difficultyChanged = nextSettings.difficulty !== previousSettings.difficulty;

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

    if (state.status === "running" && difficultyChanged) {
      nextState = {
        ...nextState,
        currentExpression: pickExpression(expressions, nextSettings.difficulty, state.currentExpression?.id ?? null)
      };
    }

    setState(nextState);
    saveSettings(nextSettings);

    if (state.status === "running") {
      if (nextSettings.mode === "timed") {
        if (limitMs !== null && elapsedMs >= limitMs) {
          end();
          return;
        }
        startTimerLoop();
      } else {
        stopTimer();
      }
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

  function loadHistoryIntoState(): void {
    const history = loadHistory();
    const fromStorage = loadBestScores();
    const bests = Object.keys(fromStorage).length > 0 ? fromStorage : computeBestScores(history);

    if (Object.keys(fromStorage).length === 0 && history.length > 0) {
      saveBestScores(bests);
    }

    setState({
      ...state,
      history,
      bests
    });
  }

  if (state.status === "running" && state.settings.mode === "timed") {
    startTimerLoop();
  }

  return {
    subscribe: store.subscribe,
    start,
    submit,
    skip,
    toggleReveal,
    reset,
    end,
    loadHistory: loadHistoryIntoState,
    updateSettings
  };
}
