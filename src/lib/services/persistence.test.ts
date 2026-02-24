import { describe, expect, it } from "vitest";
import { ALL_TOPIC_IDS } from "../data/topics";
import {
  computeBestScores,
  DEFAULT_SETTINGS,
  HISTORY_STORAGE_KEY,
  loadHistory,
  loadSettings,
  sanitizeSettings,
  saveHistory,
  saveSettings,
  SETTINGS_STORAGE_KEY
} from "./persistence";
import type { SessionRecord, SessionSettings } from "../types";

function makeRecord(index: number): SessionRecord {
  return {
    id: `session-${index}`,
    endedAt: 1000 + index,
    settings: {
      mode: "practice",
      durationSec: 60,
      difficulties: ["beginner", "intermediate", "advanced"],
      selectedTopicIds: [...ALL_TOPIC_IDS],
      selectedSubtopicsByTopic: {
        algebra: ["fundamentals"],
        calculus: ["integrals"]
      },
      revealLatex: false
    },
    stats: {
      startedAt: 0,
      elapsedMs: 60000,
      attempts: 10,
      correct: index,
      accuracy: index * 10,
      formulasPerMin: index,
      charsPerMin: index * 11,
      bestStreak: index,
      byDifficulty: {
        beginner: { given: index, solved: index },
        intermediate: { given: 0, solved: 0 },
        advanced: { given: 0, solved: 0 }
      }
    }
  };
}

describe("persistence", () => {
  it("sanitizes invalid settings objects", () => {
    expect(sanitizeSettings({ mode: "invalid", revealLatex: true })).toEqual({
      ...DEFAULT_SETTINGS,
      revealLatex: true
    });
  });

  it("falls back to all topics when selectedTopicIds are invalid", () => {
    const sanitized = sanitizeSettings({
      mode: "practice",
      selectedTopicIds: ["not-a-topic"]
    });
    expect(sanitized.selectedTopicIds).toEqual(ALL_TOPIC_IDS);
  });

  it("supports legacy single topic migration", () => {
    const sanitized = sanitizeSettings({
      topic: "probability"
    });
    expect(sanitized.selectedTopicIds).toEqual(["probability"]);
  });

  it("loads default settings for broken JSON", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{broken-json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and loads settings", () => {
    const settings: SessionSettings = {
      mode: "timed",
      durationSec: 120,
      difficulties: ["advanced"],
      selectedTopicIds: ["mathematical-physics", "differential-equations"],
      selectedSubtopicsByTopic: {
        "mathematical-physics": ["physical laws"],
        "differential-equations": ["field operators"]
      },
      revealLatex: true
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(sanitizeSettings(settings));
  });

  it("caps saved history to last 500 sessions", () => {
    const many = Array.from({ length: 520 }, (_, index) => makeRecord(index + 1));
    const saved = saveHistory(many);
    expect(saved.length).toBe(500);

    const loaded = loadHistory();
    expect(loaded.length).toBe(500);
    expect(loaded[0].id).toBe("session-1");
  });

  it("computes global top 5 best scores", () => {
    const records = Array.from({ length: 8 }, (_, index) => makeRecord(index + 1));
    const bests = computeBestScores(records);
    expect(bests).toHaveLength(5);
    expect(bests[0].id).toBe("session-8");
    expect(bests[4].id).toBe("session-4");
  });

  it("ranks hard-only sessions above equal easy-only sessions", () => {
    const easyOnly = makeRecord(1);
    easyOnly.stats.correct = 8;
    easyOnly.stats.accuracy = 70;
    easyOnly.stats.byDifficulty = {
      beginner: { given: 8, solved: 8 },
      intermediate: { given: 0, solved: 0 },
      advanced: { given: 0, solved: 0 }
    };

    const hardOnly = makeRecord(2);
    hardOnly.stats.correct = 8;
    hardOnly.stats.accuracy = 70;
    hardOnly.stats.byDifficulty = {
      beginner: { given: 0, solved: 0 },
      intermediate: { given: 0, solved: 0 },
      advanced: { given: 8, solved: 8 }
    };

    const bests = computeBestScores([easyOnly, hardOnly]);
    expect(bests[0].id).toBe(hardOnly.id);
  });

  it("ranks high-volume strong sessions above short perfect samples", () => {
    const shortPerfect = makeRecord(1);
    shortPerfect.stats.correct = 3;
    shortPerfect.stats.attempts = 3;
    shortPerfect.stats.accuracy = 100;
    shortPerfect.stats.byDifficulty = {
      beginner: { given: 0, solved: 0 },
      intermediate: { given: 2, solved: 2 },
      advanced: { given: 1, solved: 1 }
    };

    const highVolume = makeRecord(2);
    highVolume.stats.correct = 9;
    highVolume.stats.attempts = 10;
    highVolume.stats.accuracy = 90;
    highVolume.stats.byDifficulty = {
      beginner: { given: 0, solved: 0 },
      intermediate: { given: 7, solved: 6 },
      advanced: { given: 3, solved: 3 }
    };

    const bests = computeBestScores([shortPerfect, highVolume]);
    expect(bests[0].id).toBe(highVolume.id);
  });

  it("returns empty history when storage is empty", () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    expect(loadHistory()).toEqual([]);
  });
});
