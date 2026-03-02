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

export interface LatexComplexityFeatures {
  nonWhitespaceChars: number;
  commandCount: number;
  commandNameChars: number;
  controlSymbolEscapes: number;
  delimiterGroupTokens: number;
  maxGroupDepth: number;
  scriptOperatorCount: number;
  maxScriptDepth: number;
  fracRootBinomCount: number;
  fracRootBinomDepth: number;
  largeOperatorCount: number;
  relationOperatorCount: number;
  delimiterSizingCount: number;
  matrixAlignmentComplexity: number;
  accentDecoratorCount: number;
  commandRarityLoad: number;
  unknownCommandCount: number;
  knownCommandCount: number;
}

export interface LatexComplexityResult {
  score: number;
  band: Difficulty;
  features: LatexComplexityFeatures;
}

export interface LatexCommandToken {
  token: string;
  isControlSymbol: boolean;
  position: number;
}

export interface Expression {
  id: string;
  latex: string;
  difficulty: Difficulty;
  complexityScore: number;
  complexityBand: Difficulty;
  name: string;
  topics: TopicId[];
  subtopics: string[];
  complexityFeatures?: LatexComplexityFeatures;
}

export interface ExpressionJsonRecord extends Expression {}

export interface ExpressionsJsonPayload {
  version: string;
  generatedAt: string;
  expressions: ExpressionJsonRecord[];
}

export interface SessionSettings {
  mode: Mode;
  durationSec: 60 | 120;
  difficulties: Difficulty[];
  selectedTopicIds: TopicId[];
  selectedSubtopicsByTopic: Record<TopicId, string[]>;
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
  byDifficulty: Record<Difficulty, { given: number; solved: number }>;
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

export type BestScores = SessionRecord[];

export interface GameState {
  status: SessionStatus;
  settings: SessionSettings;
  stats: SessionStats;
  currentExpression: Expression | null;
  poolRestartedAt: number | null;
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
  registerActivity: () => void;
  toggleReveal: (on?: boolean) => void;
  reset: () => void;
  end: () => void;
  dismissResults: () => void;
  loadHistory: () => void;
  clearHistory: () => void;
  deleteHistoryRecord: (sessionId: string) => void;
  updateSettings: (settings: Partial<SessionSettings>) => void;
}

export type SnippetSourceFormat = "obsidian-ls";

export interface SnippetModeFlags {
  text: boolean;
  math: boolean;
  blockMath: boolean;
  inlineMath: boolean;
  code: boolean;
}

export interface SnippetOptionFlags {
  auto: boolean;
  regex: boolean;
  visual: boolean;
  wordBoundary: boolean;
  modes: SnippetModeFlags;
}

export interface RawObsidianSnippet {
  trigger: string | RegExp;
  replacement: string | ((input: unknown) => string | false);
  options?: string;
  priority?: number;
  description?: string;
  flags?: string;
  triggerKey?: string;
}

export interface CompiledSnippet {
  id: string;
  trigger: string | RegExp;
  triggerSource: string;
  replacement: string;
  options: SnippetOptionFlags;
  priority: number;
  description: string;
  triggerKey: string | null;
}

export interface SnippetVariables {
  [variable: string]: string;
}

export type SnippetParseIssueSeverity = "error" | "warning";

export interface SnippetParseIssue {
  severity: SnippetParseIssueSeverity;
  message: string;
  snippetIndex?: number;
}

export interface TabstopRange {
  start: number;
  end: number;
}

export interface TabstopGroup {
  index: number;
  ranges: TabstopRange[];
}

export interface TabstopState {
  groups: TabstopGroup[];
  activeGroupIndex: number;
}

export interface ExpansionHelperSettings {
  autofractionEnabled: boolean;
  taboutEnabled: boolean;
  matrixShortcutsEnabled: boolean;
  autoBracketPairingEnabled: boolean;
  autoEnlargeBracketsEnabled: boolean;
  autofractionSymbol: string;
  autofractionBreakingChars: string;
  matrixShortcutEnvironments: string[];
  taboutClosingSymbols: string[];
  autoEnlargeTriggers: string[];
}

export interface ExpansionSettings {
  enabled: boolean;
  sourceFormat: SnippetSourceFormat;
  manualTriggerKey: "Tab";
  wordDelimiters: string;
  helpers: ExpansionHelperSettings;
}

export interface SnippetParseResult {
  snippets: CompiledSnippet[];
  issues: SnippetParseIssue[];
}

export interface ExpansionMutation {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  tabstops: TabstopState | null;
  matchStart?: number;
  matchEnd?: number;
}
