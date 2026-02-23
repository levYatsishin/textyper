import { describe, expect, it } from "vitest";
import { ALL_TOPIC_IDS } from "../data/topics";
import {
  BESTS_STORAGE_KEY,
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
      bestStreak: index
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
      revealLatex: true
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(sanitizeSettings(settings));
  });

  it("caps saved history to last 50 sessions", () => {
    const many = Array.from({ length: 70 }, (_, index) => makeRecord(index + 1));
    const saved = saveHistory(many);
    expect(saved.length).toBe(50);

    const loaded = loadHistory();
    expect(loaded.length).toBe(50);
    expect(loaded[0].id).toBe("session-1");
  });

  it("computes best scores by mode+difficulty", () => {
    const first = makeRecord(3);
    const second = makeRecord(5);
    second.settings.difficulties = ["advanced"];

    const bests = computeBestScores([first, second]);
    expect(bests[`practice:beginner+intermediate+advanced:${ALL_TOPIC_IDS.join("+")}`].id).toBe(first.id);
    expect(bests[`practice:advanced:${ALL_TOPIC_IDS.join("+")}`].id).toBe(second.id);
  });

  it("returns empty history and bests when storage is empty", () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    localStorage.removeItem(BESTS_STORAGE_KEY);
    expect(loadHistory()).toEqual([]);
  });
});
