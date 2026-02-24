import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ResultsModal from "./ResultsModal.svelte";
import type { SessionRecord } from "../types";

function makeSession(mode: SessionRecord["settings"]["mode"]): SessionRecord {
  return {
    id: "session-1",
    endedAt: new Date("2026-02-24T10:33:53Z").getTime(),
    settings: {
      mode,
      durationSec: 60,
      difficulties: ["beginner", "advanced"],
      selectedTopicIds: ["algebra"],
      selectedSubtopicsByTopic: { algebra: ["fundamentals"] },
      revealLatex: false
    },
    stats: {
      startedAt: 1,
      elapsedMs: 388000,
      attempts: 8,
      correct: 5,
      accuracy: 62.5,
      formulasPerMin: 0.77,
      charsPerMin: 10.5,
      bestStreak: 3,
      byDifficulty: {
        beginner: { given: 5, solved: 4 },
        intermediate: { given: 1, solved: 0 },
        advanced: { given: 2, solved: 1 }
      }
    }
  };
}

describe("ResultsModal", () => {
  it("shows timed difficulty pill and breakdown for selected difficulties", () => {
    render(ResultsModal, {
      open: true,
      session: makeSession("timed")
    });

    const difficultyPill = screen.getByText(/difficulty:/i);
    expect(difficultyPill.textContent).toContain("easy");
    expect(difficultyPill.textContent).toContain("|");
    expect(difficultyPill.textContent).toContain("hard");
    expect(difficultyPill.textContent).not.toContain("+");
    expect(screen.getByText("4/5 solved")).toBeTruthy();
    expect(screen.getByText("1/2 solved")).toBeTruthy();
  });

  it("does not show zen difficulty pill and keeps time spent", () => {
    render(ResultsModal, {
      open: true,
      session: makeSession("practice")
    });

    expect(screen.queryByText(/difficulty:/i)).toBeNull();
    expect(screen.getByText(/time spent:/i)).toBeTruthy();
  });
});
