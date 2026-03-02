import { describe, expect, it } from "vitest";
import { ALL_TOPIC_IDS } from "../data/topics";
import {
  computeBestScores,
  DEFAULT_SETTINGS,
  EXPANSION_SETTINGS_STORAGE_KEY,
  EXPANSION_SNIPPETS_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  loadExpansionSettings,
  loadExpansionSnippetSource,
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

  it("adds required delimiters for script-context snippet expansion", () => {
    localStorage.setItem(
      EXPANSION_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        wordDelimiters: " \t\n.,;:!?()[]{}<>+-=*/\\|\"'"
      })
    );

    const loaded = loadExpansionSettings();
    expect(loaded.wordDelimiters).toContain("^");
    expect(loaded.wordDelimiters).toContain("_");
    expect(loaded.wordDelimiters).toContain("&");
    expect(loaded.wordDelimiters).toContain("$");
    expect(loaded.wordDelimiters).toContain("~");
    expect(loaded.wordDelimiters).toContain("#");
    expect(loaded.wordDelimiters).toContain("%");
    expect(loaded.wordDelimiters).toContain("`");
  });

  it("migrates legacy lim snippet tabstops to fixed expansion", () => {
    localStorage.setItem(
      EXPANSION_SNIPPETS_STORAGE_KEY,
      '[{ trigger: "lim", replacement: "\\\\lim_{n \\\\to \\\\infty} $1$0", options: "A" }]'
    );

    expect(loadExpansionSnippetSource()).toContain('replacement: "\\\\lim_{${1:n} \\\\to ${2:\\\\infty}} $0"');
    expect(loadExpansionSnippetSource()).not.toContain('replacement: "\\\\lim_{n \\\\to \\\\infty} $1$0"');
  });

  it("migrates legacy snippet pack with rm to longer math-font triggers and adds ln/log", () => {
    localStorage.setItem(
      EXPANSION_SNIPPETS_STORAGE_KEY,
      `[
  { trigger: "bf", replacement: "\\\\mathbf{$1}$0", options: "A", description: "bold symbol" },
  { trigger: "rm", replacement: "\\\\mathrm{$1}$0", options: "A" },
  { trigger: "det", replacement: "\\\\det", options: "A" },
  { trigger: "int", replacement: "\\\\int $1 \\\\, d$2 $0", options: "Aw", priority: 2 },
  { trigger: "oinf", replacement: "\\\\int_{0}^{\\\\infty} $1 \\\\, d$2 $0", options: "Aw", priority: 2 },
  { trigger: "infi", replacement: "\\\\int_{-\\\\infty}^{\\\\infty} $1 \\\\, d$2 $0", options: "Aw", priority: 2 },
  { trigger: "dint", replacement: "\\\\int_{$1}^{$2} $3 \\\\, d$4 $0", options: "Aw", priority: 2 }
]`
    );

    const migrated = loadExpansionSnippetSource();
    expect(migrated).toContain('{ trigger: "mnorm", replacement: "\\\\mathnormal{$1}$0", options: "A"');
    expect(migrated).toContain('{ trigger: "mrm", replacement: "\\\\mathrm{$1}$0", options: "A"');
    expect(migrated).toContain('{ trigger: "mit", replacement: "\\\\mathit{$1}$0", options: "A"');
    expect(migrated).toContain('{ trigger: "msf", replacement: "\\\\mathsf{$1}$0", options: "A"');
    expect(migrated).toContain('{ trigger: "mtt", replacement: "\\\\mathtt{$1}$0", options: "A"');
    expect(migrated).not.toContain('{ trigger: "rm", replacement: "\\\\mathrm{$1}$0", options: "A" },');

    expect(migrated).toContain('{ trigger: "ln", replacement: "\\\\ln", options: "Aw" },');
    expect(migrated).toContain('{ trigger: "log", replacement: "\\\\log", options: "Aw" },');

    expect(migrated).toContain('replacement: "\\\\int $0 \\\\, d${1:x} $2"');
    expect(migrated).toContain('replacement: "\\\\int_{0}^{\\\\infty} $0 \\\\, d${1:x} $2"');
    expect(migrated).toContain('replacement: "\\\\int_{-\\\\infty}^{\\\\infty} $0 \\\\, d${1:x} $2"');
    expect(migrated).toContain('replacement: "\\\\int_{${1:a}}^{${2:b}} $0 \\\\, d${3:x} $4"');
  });
});
