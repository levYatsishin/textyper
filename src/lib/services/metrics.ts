import type { SessionStats } from "../types";

export interface SessionMetricsInput {
  startedAt: number;
  elapsedMs: number;
  attempts: number;
  correct: number;
  bestStreak: number;
  typedChars: number;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeAccuracy(correct: number, attempts: number): number {
  if (attempts <= 0) {
    return 0;
  }
  return roundToTwo((correct / attempts) * 100);
}

export function computeFormulasPerMin(correct: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }
  return roundToTwo(correct / (elapsedMs / 60000));
}

export function computeCharsPerMin(typedChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }
  return roundToTwo(typedChars / (elapsedMs / 60000));
}

export function createEmptyStats(startedAt = Date.now()): SessionStats {
  return {
    startedAt,
    elapsedMs: 0,
    attempts: 0,
    correct: 0,
    accuracy: 0,
    formulasPerMin: 0,
    charsPerMin: 0,
    bestStreak: 0
  };
}

export function toSessionStats(input: SessionMetricsInput): SessionStats {
  return {
    startedAt: input.startedAt,
    elapsedMs: Math.max(0, input.elapsedMs),
    attempts: input.attempts,
    correct: input.correct,
    accuracy: computeAccuracy(input.correct, input.attempts),
    formulasPerMin: computeFormulasPerMin(input.correct, input.elapsedMs),
    charsPerMin: computeCharsPerMin(input.typedChars, input.elapsedMs),
    bestStreak: input.bestStreak
  };
}
