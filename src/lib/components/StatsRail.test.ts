import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import StatsRail from "./StatsRail.svelte";
import type { SessionRecord, SessionStats } from "../types";

function makeRecord(index: number): SessionRecord {
  const correct = index;
  const attempts = 10;
  const elapsedMs = 60_000;

  return {
    id: `session-${index}`,
    endedAt: 1000 + index,
    settings: {
      mode: "practice",
      durationSec: 60,
      difficulties: ["beginner", "intermediate", "advanced"],
      selectedTopicIds: [],
      selectedSubtopicsByTopic: {},
      revealLatex: false
    },
    stats: {
      startedAt: 0,
      elapsedMs,
      attempts,
      correct,
      accuracy: (correct / attempts) * 100,
      formulasPerMin: correct,
      charsPerMin: correct * 10,
      bestStreak: correct,
      byDifficulty: {
        beginner: { given: correct, solved: correct },
        intermediate: { given: 0, solved: 0 },
        advanced: { given: 0, solved: 0 }
      }
    }
  };
}

describe("StatsRail", () => {
  it("shows recent performance and lifetime totals with distinct scopes", () => {
    const history = Array.from({ length: 8 }, (_, index) => makeRecord(index + 1));
    render(StatsRail, { history });

    expect(screen.getByText("Recent performance · last 7")).toBeTruthy();
    expect(screen.getByText("8 sessions · Lifetime totals")).toBeTruthy();

    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("0.25")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("36 correct")).toBeTruthy();
    expect(screen.getByText("08:00")).toBeTruthy();
  });

  it("shows zeroed values when history is empty", () => {
    render(StatsRail, { history: [] });

    expect(screen.getByText("Recent performance · last 0")).toBeTruthy();
    expect(screen.getByText("0 sessions · Lifetime totals")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByText("00:00")).toBeTruthy();
  });

  it("shows current-only scope and live metrics while running", () => {
    const liveStats: SessionStats = {
      startedAt: 0,
      elapsedMs: 93_000,
      attempts: 12,
      correct: 7,
      accuracy: 58.33,
      formulasPerMin: 0,
      charsPerMin: 222.11,
      bestStreak: 5,
      byDifficulty: {
        beginner: { given: 4, solved: 3 },
        intermediate: { given: 5, solved: 3 },
        advanced: { given: 3, solved: 1 }
      }
    };

    render(StatsRail, {
      history: Array.from({ length: 8 }, (_, index) => makeRecord(index + 1)),
      stats: liveStats,
      currentStreak: 2,
      status: "running"
    });

    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.queryByText("Recent performance · last 7")).toBeNull();
    expect(screen.queryByText("8 sessions · Lifetime totals")).toBeNull();
    expect(screen.getByText("58.33%")).toBeTruthy();
    expect(screen.getByText("0.22")).toBeTruthy();
    expect(screen.getByText("222.11")).toBeTruthy();
    expect(screen.getByText("2 (best 5)")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("7 correct")).toBeTruthy();
    expect(screen.getByText("01:33")).toBeTruthy();
  });
});
