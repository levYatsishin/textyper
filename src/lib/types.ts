import type { Readable } from "svelte/store";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Mode = "practice" | "timed";
export type SessionStatus = "idle" | "running" | "ended";
export type MatchStrategy = "exact" | "render" | "fail";
export type TopicId = string;

export interface TopicDefinition {
  id: TopicId;
  label: string;
  order: number;
}

export interface Expression {
  id: string;
  latex: string;
  difficulty: Difficulty;
  name: string;
  topics: TopicId[];
}

export interface SessionSettings {
  mode: Mode;
  durationSec: 60 | 120;
  difficulties: Difficulty[];
  selectedTopicIds: TopicId[];
  revealLatex: boolean;
}

export interface SessionStats {
  startedAt: number;
  elapsedMs: number;
  attempts: number;
  correct: number;
  accuracy: number;
  formulasPerMin: number;
  charsPerMin: number;
  bestStreak: number;
}

export interface MatchResult {
  isMatch: boolean;
  mismatchRatio: number;
  strategy: MatchStrategy;
}

export interface SubmissionResult {
  isCorrect: boolean;
  strategy: MatchStrategy;
  mismatchRatio: number;
  inputLatex: string;
  targetLatex: string;
}

export interface SessionRecord {
  id: string;
  endedAt: number;
  settings: SessionSettings;
  stats: SessionStats;
}

export interface BestScoreEntry {
  key: string;
  record: SessionRecord;
}

export type BestScores = Record<string, SessionRecord>;

export interface GameState {
  status: SessionStatus;
  settings: SessionSettings;
  stats: SessionStats;
  currentExpression: Expression | null;
  remainingMs: number | null;
  currentStreak: number;
  typedChars: number;
  isSubmitting: boolean;
  lastResult: SubmissionResult | null;
  history: SessionRecord[];
  bests: BestScores;
  lastSession: SessionRecord | null;
}

export interface CompareLatexOptions {
  tolerance?: number;
  renderComparator?: (inputLatex: string, targetLatex: string) => Promise<number>;
}

export type CompareLatexFn = (
  inputLatex: string,
  targetLatex: string,
  options?: CompareLatexOptions
) => Promise<MatchResult>;

export interface GameStore extends Readable<GameState> {
  start: (settings?: Partial<SessionSettings>) => void;
  submit: (inputLatex: string) => Promise<void>;
  skip: () => void;
  toggleReveal: (on?: boolean) => void;
  reset: () => void;
  end: () => void;
  loadHistory: () => void;
  updateSettings: (settings: Partial<SessionSettings>) => void;
}
