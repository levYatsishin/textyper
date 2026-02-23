import { knownCommands, tier0Commands, tier1Commands } from "../data/latexCommandCatalog";
import type { Difficulty, LatexCommandToken, LatexComplexityFeatures, LatexComplexityResult } from "../types";

const EASY_MAX_SCORE = 32;
const MEDIUM_MAX_SCORE = 49;

const FEATURE_CAPS = {
  nonWhitespaceChars: 90,
  commandCount: 14,
  commandNameChars: 55,
  controlSymbolEscapes: 4,
  delimiterGroupTokens: 16,
  maxGroupDepth: 4,
  scriptOperatorCount: 10,
  maxScriptDepth: 3,
  fracRootBinomCount: 5,
  fracRootBinomDepth: 3,
  largeOperatorCount: 4,
  relationOperatorCount: 6,
  delimiterSizingCount: 3,
  matrixAlignmentComplexity: 5,
  accentDecoratorCount: 4,
  commandRarityLoad: 8
} as const;

const FEATURE_WEIGHTS = {
  nonWhitespaceChars: 18,
  commandCount: 8,
  commandNameChars: 7,
  controlSymbolEscapes: 2,
  delimiterGroupTokens: 3,
  maxGroupDepth: 7,
  scriptOperatorCount: 6,
  maxScriptDepth: 5,
  fracRootBinomCount: 6,
  fracRootBinomDepth: 5,
  largeOperatorCount: 4,
  relationOperatorCount: 2,
  delimiterSizingCount: 2,
  matrixAlignmentComplexity: 5,
  accentDecoratorCount: 3,
  commandRarityLoad: 17
} as const;

const relationCommands = new Set([
  "approx",
  "cong",
  "equiv",
  "geq",
  "geqslant",
  "gtr",
  "iff",
  "implies",
  "in",
  "leq",
  "leqslant",
  "lessgtr",
  "lt",
  "neq",
  "notin",
  "sim",
  "subset",
  "subseteq",
  "supset",
  "supseteq",
  "to"
]);

const delimiterSizingCommands = new Set([
  "left",
  "right",
  "middle",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "Bigl",
  "biggl",
  "Biggl",
  "bigr",
  "Bigr",
  "biggr",
  "Biggr",
  "bigm",
  "Bigm",
  "biggm",
  "Biggm"
]);

const fracRootBinomCommands = new Set(["frac", "dfrac", "tfrac", "binom", "sqrt", "genfrac"]);
const largeOperatorCommands = new Set([
  "sum",
  "prod",
  "int",
  "oint",
  "iint",
  "iiint",
  "iiiint",
  "idotsint",
  "bigcup",
  "bigcap",
  "bigsqcup",
  "bigvee",
  "bigwedge",
  "bigodot",
  "bigotimes",
  "bigoplus",
  "biguplus"
]);

const accentDecoratorCommands = new Set([
  "bar",
  "dot",
  "ddot",
  "hat",
  "overline",
  "overbrace",
  "overrightarrow",
  "underline",
  "underbrace",
  "underleftarrow",
  "underrightarrow",
  "vec",
  "widehat",
  "widetilde"
]);

const matrixEnvironmentNames = new Set([
  "aligned",
  "alignedat",
  "array",
  "Bmatrix",
  "bmatrix",
  "cases",
  "matrix",
  "pmatrix",
  "smallmatrix",
  "split",
  "vmatrix",
  "Vmatrix"
]);

const tier0Set = new Set(tier0Commands);
const tier1Set = new Set(tier1Commands);
const knownCommandSet = new Set(knownCommands);

const asciiLetterPattern = /[A-Za-z]/;
const whitespacePattern = /\s/;
const relationLiteralPattern = /[=<>]/;

interface FractionDepthState {
  depthByGroupLevel: number[];
  maxDepth: number;
}

function toCommandNameLength(token: string): number {
  return token.replace(/[^A-Za-z]/g, "").length;
}

function skipCommandToken(source: string, from: number): number {
  let index = from;
  if (index >= source.length || source[index] !== "\\") {
    return index;
  }

  index += 1;
  if (index >= source.length) {
    return index;
  }

  if (asciiLetterPattern.test(source[index])) {
    while (index < source.length && asciiLetterPattern.test(source[index])) {
      index += 1;
    }
    if (source[index] === "*") {
      index += 1;
    }
    return index;
  }

  return index + 1;
}

function getCommandTokenAt(source: string, commandStartIndex: number): LatexCommandToken | null {
  if (source[commandStartIndex] !== "\\") {
    return null;
  }

  const tokenStart = commandStartIndex + 1;
  if (tokenStart >= source.length) {
    return null;
  }

  if (asciiLetterPattern.test(source[tokenStart])) {
    let tokenEnd = tokenStart;
    while (tokenEnd < source.length && asciiLetterPattern.test(source[tokenEnd])) {
      tokenEnd += 1;
    }
    if (source[tokenEnd] === "*") {
      tokenEnd += 1;
    }
    return {
      token: source.slice(tokenStart, tokenEnd),
      isControlSymbol: false,
      position: commandStartIndex
    };
  }

  return {
    token: source[tokenStart],
    isControlSymbol: true,
    position: commandStartIndex
  };
}

function collectCommandTokens(source: string): LatexCommandToken[] {
  const tokens: LatexCommandToken[] = [];
  let index = 0;

  while (index < source.length) {
    if (source[index] !== "\\") {
      index += 1;
      continue;
    }

    const token = getCommandTokenAt(source, index);
    if (!token) {
      index += 1;
      continue;
    }

    tokens.push(token);
    index = skipCommandToken(source, index);
  }

  return tokens;
}

function getGroupDepthAtEachCommand(source: string): Record<number, number> {
  const result: Record<number, number> = {};
  let index = 0;
  let groupDepth = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      const token = getCommandTokenAt(source, index);
      if (token) {
        result[index] = groupDepth;
      }
      index = skipCommandToken(source, index);
      continue;
    }

    if (char === "{") {
      groupDepth += 1;
      index += 1;
      continue;
    }

    if (char === "}") {
      groupDepth = Math.max(0, groupDepth - 1);
      index += 1;
      continue;
    }

    index += 1;
  }

  return result;
}

function computeGroupDepth(source: string): number {
  let index = 0;
  let groupDepth = 0;
  let maxDepth = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index = skipCommandToken(source, index);
      continue;
    }

    if (char === "{") {
      groupDepth += 1;
      maxDepth = Math.max(maxDepth, groupDepth);
      index += 1;
      continue;
    }

    if (char === "}") {
      groupDepth = Math.max(0, groupDepth - 1);
      index += 1;
      continue;
    }

    index += 1;
  }

  return maxDepth;
}

function computeScriptMetrics(source: string): { scriptOperatorCount: number; maxScriptDepth: number } {
  let scriptOperatorCount = 0;
  let maxScriptDepth = 0;
  let groupDepth = 0;
  const activeScriptEndDepths: number[] = [];

  let index = 0;
  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index = skipCommandToken(source, index);
      continue;
    }

    if (char === "{") {
      groupDepth += 1;
      index += 1;
      continue;
    }

    if (char === "}") {
      groupDepth = Math.max(0, groupDepth - 1);
      while (activeScriptEndDepths.length > 0 && activeScriptEndDepths[activeScriptEndDepths.length - 1] > groupDepth) {
        activeScriptEndDepths.pop();
      }
      index += 1;
      continue;
    }

    if (char === "^" || char === "_") {
      scriptOperatorCount += 1;
      let lookahead = index + 1;
      while (lookahead < source.length && whitespacePattern.test(source[lookahead])) {
        lookahead += 1;
      }

      if (lookahead < source.length && source[lookahead] === "{") {
        activeScriptEndDepths.push(groupDepth + 1);
        maxScriptDepth = Math.max(maxScriptDepth, activeScriptEndDepths.length);
      } else {
        maxScriptDepth = Math.max(maxScriptDepth, activeScriptEndDepths.length + 1);
      }
    }

    index += 1;
  }

  return { scriptOperatorCount, maxScriptDepth };
}

function computeFractionDepth(commandTokens: LatexCommandToken[], groupDepthByCommandStart: Record<number, number>): number {
  const state: FractionDepthState = {
    depthByGroupLevel: [],
    maxDepth: 0
  };

  for (const command of commandTokens) {
    if (command.isControlSymbol || !fracRootBinomCommands.has(command.token)) {
      continue;
    }

    const groupDepth = groupDepthByCommandStart[command.position] ?? 0;
    const parentDepth = state.depthByGroupLevel
      .slice(0, groupDepth + 1)
      .reduce((maxValue, candidateDepth) => Math.max(maxValue, candidateDepth ?? 0), 0);
    const currentDepth = parentDepth + 1;
    state.depthByGroupLevel[groupDepth] = Math.max(state.depthByGroupLevel[groupDepth] ?? 0, currentDepth);
    state.maxDepth = Math.max(state.maxDepth, currentDepth);
  }

  return state.maxDepth;
}

function computeMatrixAlignmentComplexity(source: string): number {
  let complexity = 0;
  const environmentPattern = /\\begin\{([A-Za-z*]+)\}([\s\S]*?)\\end\{\1\}/g;
  let match = environmentPattern.exec(source);

  while (match) {
    const environmentName = match[1];
    const environmentBody = match[2];
    if (matrixEnvironmentNames.has(environmentName)) {
      const rows = environmentBody.split(/\\\\/);
      const rowCount = rows.length;
      const maxColumns = rows.reduce((maxValue, row) => {
        const columnCount = row.split("&").length;
        return Math.max(maxValue, columnCount);
      }, 1);
      complexity += 1 + Math.max(0, rowCount - 1) + Math.max(0, maxColumns - 1);
    }

    match = environmentPattern.exec(source);
  }

  return complexity;
}

function clampUnit(value: number, cap: number): number {
  if (cap <= 0) {
    return 0;
  }
  return Math.min(value / cap, 1);
}

export function tokenizeLatex(latex: string): LatexCommandToken[] {
  return collectCommandTokens(latex);
}

export function getCommandTierWeight(commandToken: string, isControlSymbol = false): number {
  if (isControlSymbol) {
    return 0.4;
  }

  if (tier0Set.has(commandToken)) {
    return 0.4;
  }

  if (tier1Set.has(commandToken)) {
    return 1;
  }

  if (knownCommandSet.has(commandToken)) {
    return 1.9;
  }

  return 2.8;
}

export function extractComplexityFeatures(latex: string): LatexComplexityFeatures {
  const source = latex ?? "";
  const commandTokens = collectCommandTokens(source);
  const groupDepthByCommandStart = getGroupDepthAtEachCommand(source);

  const nonWhitespaceChars = (source.match(/\S/g) ?? []).length;
  const commandCount = commandTokens.length;
  const commandNameChars = commandTokens.reduce((sum, token) => sum + toCommandNameLength(token.token), 0);
  const controlSymbolEscapes = commandTokens.filter((token) => token.isControlSymbol).length;

  const delimiterCharsCount = (source.match(/[{}\[\]()]/g) ?? []).length;
  const leftRightCount = commandTokens.filter(
    (token) => !token.isControlSymbol && (token.token === "left" || token.token === "right")
  ).length;
  const delimiterGroupTokens = delimiterCharsCount + leftRightCount;
  const maxGroupDepth = computeGroupDepth(source);

  const { scriptOperatorCount, maxScriptDepth } = computeScriptMetrics(source);
  const fracRootBinomCount = commandTokens.filter(
    (token) => !token.isControlSymbol && fracRootBinomCommands.has(token.token)
  ).length;
  const fracRootBinomDepth = computeFractionDepth(commandTokens, groupDepthByCommandStart);
  const largeOperatorCount = commandTokens.filter(
    (token) => !token.isControlSymbol && largeOperatorCommands.has(token.token)
  ).length;

  const relationFromCommands = commandTokens.filter(
    (token) => !token.isControlSymbol && relationCommands.has(token.token)
  ).length;
  const relationFromLiterals = [...source].filter((char) => relationLiteralPattern.test(char)).length;
  const relationOperatorCount = relationFromCommands + relationFromLiterals;

  const delimiterSizingCount = commandTokens.filter(
    (token) => !token.isControlSymbol && delimiterSizingCommands.has(token.token)
  ).length;
  const matrixAlignmentComplexity = computeMatrixAlignmentComplexity(source);
  const accentDecoratorCount = commandTokens.filter(
    (token) => !token.isControlSymbol && accentDecoratorCommands.has(token.token)
  ).length;

  let commandRarityLoad = 0;
  let unknownCommandCount = 0;
  let knownCommandCount = 0;
  for (const token of commandTokens) {
    commandRarityLoad += getCommandTierWeight(token.token, token.isControlSymbol);
    if (token.isControlSymbol) {
      continue;
    }
    if (knownCommandSet.has(token.token) || tier0Set.has(token.token) || tier1Set.has(token.token)) {
      knownCommandCount += 1;
    } else {
      unknownCommandCount += 1;
    }
  }

  return {
    nonWhitespaceChars,
    commandCount,
    commandNameChars,
    controlSymbolEscapes,
    delimiterGroupTokens,
    maxGroupDepth,
    scriptOperatorCount,
    maxScriptDepth,
    fracRootBinomCount,
    fracRootBinomDepth,
    largeOperatorCount,
    relationOperatorCount,
    delimiterSizingCount,
    matrixAlignmentComplexity,
    accentDecoratorCount,
    commandRarityLoad,
    unknownCommandCount,
    knownCommandCount
  };
}

export function computeComplexityScore(features: LatexComplexityFeatures): number {
  const normalizedWeightedScore =
    FEATURE_WEIGHTS.nonWhitespaceChars * clampUnit(features.nonWhitespaceChars, FEATURE_CAPS.nonWhitespaceChars) +
    FEATURE_WEIGHTS.commandCount * clampUnit(features.commandCount, FEATURE_CAPS.commandCount) +
    FEATURE_WEIGHTS.commandNameChars * clampUnit(features.commandNameChars, FEATURE_CAPS.commandNameChars) +
    FEATURE_WEIGHTS.controlSymbolEscapes * clampUnit(features.controlSymbolEscapes, FEATURE_CAPS.controlSymbolEscapes) +
    FEATURE_WEIGHTS.delimiterGroupTokens * clampUnit(features.delimiterGroupTokens, FEATURE_CAPS.delimiterGroupTokens) +
    FEATURE_WEIGHTS.maxGroupDepth * clampUnit(features.maxGroupDepth, FEATURE_CAPS.maxGroupDepth) +
    FEATURE_WEIGHTS.scriptOperatorCount * clampUnit(features.scriptOperatorCount, FEATURE_CAPS.scriptOperatorCount) +
    FEATURE_WEIGHTS.maxScriptDepth * clampUnit(features.maxScriptDepth, FEATURE_CAPS.maxScriptDepth) +
    FEATURE_WEIGHTS.fracRootBinomCount * clampUnit(features.fracRootBinomCount, FEATURE_CAPS.fracRootBinomCount) +
    FEATURE_WEIGHTS.fracRootBinomDepth * clampUnit(features.fracRootBinomDepth, FEATURE_CAPS.fracRootBinomDepth) +
    FEATURE_WEIGHTS.largeOperatorCount * clampUnit(features.largeOperatorCount, FEATURE_CAPS.largeOperatorCount) +
    FEATURE_WEIGHTS.relationOperatorCount * clampUnit(features.relationOperatorCount, FEATURE_CAPS.relationOperatorCount) +
    FEATURE_WEIGHTS.delimiterSizingCount * clampUnit(features.delimiterSizingCount, FEATURE_CAPS.delimiterSizingCount) +
    FEATURE_WEIGHTS.matrixAlignmentComplexity * clampUnit(features.matrixAlignmentComplexity, FEATURE_CAPS.matrixAlignmentComplexity) +
    FEATURE_WEIGHTS.accentDecoratorCount * clampUnit(features.accentDecoratorCount, FEATURE_CAPS.accentDecoratorCount) +
    FEATURE_WEIGHTS.commandRarityLoad * clampUnit(features.commandRarityLoad, FEATURE_CAPS.commandRarityLoad);

  const rounded = Math.round(normalizedWeightedScore);
  return Math.max(0, Math.min(100, rounded));
}

export function classifyComplexity(score: number): Difficulty {
  if (score <= EASY_MAX_SCORE) {
    return "beginner";
  }
  if (score <= MEDIUM_MAX_SCORE) {
    return "intermediate";
  }
  return "advanced";
}

export function analyzeLatexComplexity(latex: string): LatexComplexityResult {
  const features = extractComplexityFeatures(latex);
  const score = computeComplexityScore(features);
  return {
    score,
    band: classifyComplexity(score),
    features
  };
}
