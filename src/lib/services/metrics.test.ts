import { describe, expect, it } from "vitest";
import { computeAccuracy, computeCharsPerMin, computeFormulasPerMin, toSessionStats } from "./metrics";

describe("metrics", () => {
  it("returns 0 accuracy for no attempts", () => {
    expect(computeAccuracy(0, 0)).toBe(0);
  });

  it("calculates bounded accuracy", () => {
    expect(computeAccuracy(7, 10)).toBe(70);
  });

  it("calculates formulas and chars per minute", () => {
    expect(computeFormulasPerMin(12, 120000)).toBe(6);
    expect(computeCharsPerMin(300, 120000)).toBe(150);
  });

  it("builds session stats from counters", () => {
    const stats = toSessionStats({
      startedAt: 10,
      elapsedMs: 30000,
      attempts: 5,
      correct: 4,
      bestStreak: 3,
      typedChars: 220,
      byDifficulty: {
        beginner: { given: 2, solved: 2 },
        intermediate: { given: 2, solved: 1 },
        advanced: { given: 1, solved: 1 }
      }
    });

    expect(stats.startedAt).toBe(10);
    expect(stats.attempts).toBe(5);
    expect(stats.correct).toBe(4);
    expect(stats.accuracy).toBe(80);
    expect(stats.bestStreak).toBe(3);
    expect(stats.charsPerMin).toBe(440);
    expect(stats.byDifficulty.intermediate.solved).toBe(1);
  });
});
