import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameStore } from "./gameStore";
import type { Expression, GameState } from "../types";

const SAMPLE_EXPRESSIONS: Expression[] = [
  { id: "1", latex: "x+y", difficulty: "beginner", topic: "algebra" },
  { id: "2", latex: "\\frac{1}{2}", difficulty: "intermediate", topic: "fractions" },
  { id: "3", latex: "\\int_0^1 x\\,dx", difficulty: "advanced", topic: "calculus" }
];

function getState(store: { subscribe: (run: (value: GameState) => void) => () => void }): GameState {
  let snapshot!: GameState;
  const unsubscribe = store.subscribe((value) => {
    snapshot = value;
  });
  unsubscribe();
  return snapshot;
}

describe("gameStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps practice mode running after submit", async () => {
    const matcher = vi.fn().mockResolvedValue({
      isMatch: true,
      mismatchRatio: 0,
      strategy: "exact"
    });

    const store = createGameStore(SAMPLE_EXPRESSIONS, {
      matcher,
      now: () => Date.now()
    });

    store.start({ mode: "practice", difficulty: "mixed" });
    await store.submit("x+y");

    const state = getState(store);
    expect(state.status).toBe("running");
    expect(state.stats.attempts).toBe(1);
    expect(state.stats.correct).toBe(1);
    expect(state.currentExpression).not.toBeNull();
  });

  it("auto-ends timed mode at duration", async () => {
    vi.useFakeTimers();

    const store = createGameStore(SAMPLE_EXPRESSIONS, {
      now: () => Date.now(),
      timerIntervalMs: 100
    });

    store.start({ mode: "timed", durationSec: 60, difficulty: "mixed" });
    await vi.advanceTimersByTimeAsync(61000);

    const state = getState(store);
    expect(state.status).toBe("ended");
    expect(state.remainingMs).toBe(0);
  });

  it("persists reveal toggle across store instances", () => {
    const firstStore = createGameStore(SAMPLE_EXPRESSIONS);
    firstStore.toggleReveal(true);

    const secondStore = createGameStore(SAMPLE_EXPRESSIONS);
    const state = getState(secondStore);
    expect(state.settings.revealLatex).toBe(true);
  });

  it("resets active streak on incorrect submissions", async () => {
    const matcher = vi
      .fn()
      .mockResolvedValueOnce({ isMatch: true, mismatchRatio: 0, strategy: "exact" })
      .mockResolvedValueOnce({ isMatch: false, mismatchRatio: 0.3, strategy: "render" });

    const store = createGameStore(SAMPLE_EXPRESSIONS, {
      matcher,
      now: () => Date.now()
    });

    store.start({ mode: "practice", difficulty: "mixed" });
    await store.submit("x+y");
    await store.submit("\\frac{3}{4}");

    const state = getState(store);
    expect(state.stats.attempts).toBe(2);
    expect(state.currentStreak).toBe(0);
    expect(state.stats.bestStreak).toBe(1);
  });
});
