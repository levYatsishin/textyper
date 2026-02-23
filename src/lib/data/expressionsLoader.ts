import { ALL_TOPIC_IDS } from "./topics";
import type {
  Difficulty,
  Expression,
  ExpressionJsonRecord,
  ExpressionsJsonPayload,
  LatexComplexityFeatures
} from "../types";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && DIFFICULTIES.includes(value as Difficulty);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateComplexityFeatures(
  value: unknown,
  index: number
): LatexComplexityFeatures | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    throw new Error(`Expression at index ${index}: complexityFeatures must be an object when provided.`);
  }

  const features = value as Record<string, unknown>;
  const requiredKeys: Array<keyof LatexComplexityFeatures> = [
    "nonWhitespaceChars",
    "commandCount",
    "commandNameChars",
    "controlSymbolEscapes",
    "delimiterGroupTokens",
    "maxGroupDepth",
    "scriptOperatorCount",
    "maxScriptDepth",
    "fracRootBinomCount",
    "fracRootBinomDepth",
    "largeOperatorCount",
    "relationOperatorCount",
    "delimiterSizingCount",
    "matrixAlignmentComplexity",
    "accentDecoratorCount",
    "commandRarityLoad",
    "unknownCommandCount",
    "knownCommandCount"
  ];

  for (const key of requiredKeys) {
    if (!isFiniteNumber(features[key])) {
      throw new Error(`Expression at index ${index}: complexityFeatures.${key} must be a finite number.`);
    }
  }

  return {
    nonWhitespaceChars: features.nonWhitespaceChars as number,
    commandCount: features.commandCount as number,
    commandNameChars: features.commandNameChars as number,
    controlSymbolEscapes: features.controlSymbolEscapes as number,
    delimiterGroupTokens: features.delimiterGroupTokens as number,
    maxGroupDepth: features.maxGroupDepth as number,
    scriptOperatorCount: features.scriptOperatorCount as number,
    maxScriptDepth: features.maxScriptDepth as number,
    fracRootBinomCount: features.fracRootBinomCount as number,
    fracRootBinomDepth: features.fracRootBinomDepth as number,
    largeOperatorCount: features.largeOperatorCount as number,
    relationOperatorCount: features.relationOperatorCount as number,
    delimiterSizingCount: features.delimiterSizingCount as number,
    matrixAlignmentComplexity: features.matrixAlignmentComplexity as number,
    accentDecoratorCount: features.accentDecoratorCount as number,
    commandRarityLoad: features.commandRarityLoad as number,
    unknownCommandCount: features.unknownCommandCount as number,
    knownCommandCount: features.knownCommandCount as number
  };
}

export function validateExpressionRecord(record: unknown, index: number): Expression {
  if (!record || typeof record !== "object") {
    throw new Error(`Expression at index ${index}: record must be an object.`);
  }

  const value = record as Partial<ExpressionJsonRecord>;

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new Error(`Expression at index ${index}: id is required.`);
  }

  if (typeof value.latex !== "string" || value.latex.trim().length === 0) {
    throw new Error(`Expression at index ${index}: latex is required.`);
  }

  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error(`Expression at index ${index}: name is required.`);
  }

  if (!isDifficulty(value.difficulty)) {
    throw new Error(`Expression ${value.id}: difficulty must be beginner, intermediate, or advanced.`);
  }

  if (!isDifficulty(value.complexityBand)) {
    throw new Error(`Expression ${value.id}: complexityBand must be beginner, intermediate, or advanced.`);
  }

  if (value.difficulty !== value.complexityBand) {
    throw new Error(`Expression ${value.id}: difficulty must equal complexityBand.`);
  }

  if (!isFiniteNumber(value.complexityScore) || value.complexityScore < 0 || value.complexityScore > 100) {
    throw new Error(`Expression ${value.id}: complexityScore must be in range 0..100.`);
  }

  if (!isStringArray(value.topics) || value.topics.length === 0) {
    throw new Error(`Expression ${value.id}: topics must be a non-empty string array.`);
  }

  const invalidTopics = value.topics.filter((topicId) => !ALL_TOPIC_IDS.includes(topicId));
  if (invalidTopics.length > 0) {
    throw new Error(`Expression ${value.id}: unknown topic ids: ${invalidTopics.join(", ")}.`);
  }

  if (!isStringArray(value.subtopics) || value.subtopics.length === 0) {
    throw new Error(`Expression ${value.id}: subtopics must be a non-empty string array.`);
  }

  const complexityFeatures = validateComplexityFeatures(value.complexityFeatures, index);

  return {
    id: value.id,
    latex: value.latex,
    difficulty: value.difficulty,
    complexityScore: value.complexityScore,
    complexityBand: value.complexityBand,
    name: value.name,
    topics: value.topics,
    subtopics: value.subtopics,
    ...(complexityFeatures ? { complexityFeatures } : {})
  };
}

export function assertUniqueExpressionIds(expressions: Expression[]): void {
  const seen = new Set<string>();
  for (const expression of expressions) {
    if (seen.has(expression.id)) {
      throw new Error(`Duplicate expression id: ${expression.id}`);
    }
    seen.add(expression.id);
  }
}

export function loadExpressionsFromJson(payload: unknown): Expression[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Formulas payload must be an object.");
  }

  const value = payload as Partial<ExpressionsJsonPayload>;
  if (!Array.isArray(value.expressions)) {
    throw new Error("Formulas payload must include an expressions array.");
  }

  const expressions = value.expressions.map((record, index) => validateExpressionRecord(record, index));
  assertUniqueExpressionIds(expressions);
  return expressions;
}
