import type { ExpansionMutation } from "../../../types";
import {
  getActiveTabstopRange,
  offsetTabstopState,
  resolveTabstops,
  shiftTabstopState
} from "../tabstops";

interface AutofractionInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  symbol: string;
  breakingChars: string;
  autoEnlargeEnabled?: boolean;
  autoEnlargeTriggers?: string[];
}

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}"
};

const CLOSE_TO_OPEN: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{"
};

const ENLARGE_OPEN: Record<string, string> = {
  "(": "\\left(",
  "[": "\\left[",
  "|": "\\left|"
};

const ENLARGE_CLOSE: Record<string, string> = {
  ")": "\\right)",
  "]": "\\right]",
  "|": "\\right|"
};

function hasDelimiterCommandBefore(value: string, index: number): boolean {
  const windowStart = Math.max(0, index - 10);
  const before = value.slice(windowStart, index);
  return /\\(?:left|right)\s*\\?$/.test(before);
}

function isWrappedByOuterParentheses(value: string): boolean {
  if (!(value.startsWith("(") && value.endsWith(")"))) {
    return false;
  }

  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0 && index < value.length - 1) {
        return false;
      }
    }

    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function findNumeratorStart(value: string, slashIndex: number, breakingChars: string): number {
  const breakSet = new Set([...breakingChars, " ", "\t", "\n", "\r"]);
  const stack: string[] = [];

  for (let index = slashIndex - 1; index >= 0; index -= 1) {
    const char = value[index];

    if (CLOSE_TO_OPEN[char]) {
      stack.push(char);
      continue;
    }

    if (OPEN_TO_CLOSE[char]) {
      const expectedClose = OPEN_TO_CLOSE[char];
      if (stack[stack.length - 1] === expectedClose) {
        stack.pop();
        continue;
      }
      if (stack.length === 0) {
        return index;
      }
    }

    if (stack.length === 0 && breakSet.has(char)) {
      return index + 1;
    }
  }

  return 0;
}

function hasUnmatchedLeadingOpenDelimiter(value: string): boolean {
  const openingChar = value[0];
  const closingChar = OPEN_TO_CLOSE[openingChar];
  if (!openingChar || !closingChar || openingChar === "|") {
    return false;
  }

  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const currentChar = value[index];
    if (currentChar === openingChar) {
      depth += 1;
    } else if (currentChar === closingChar) {
      depth -= 1;
    }
  }

  return depth > 0;
}

function shouldAutoEnlargeAroundFraction(input: AutofractionInput, symbol: string): boolean {
  if (!input.autoEnlargeEnabled) {
    return false;
  }
  const enabledTriggers = input.autoEnlargeTriggers ?? [];
  return enabledTriggers.some((trigger) => trigger === symbol);
}

function createFractionTabstops(symbol: string, numerator: string, offset: number) {
  const template = `${symbol}{${numerator}}{$1}$0`;
  const parsed = resolveTabstops(template);
  const numeratorRangeStart = `${symbol}{`.length;
  const numeratorRangeEnd = numeratorRangeStart + numerator.length;

  let tabstops = parsed.tabstops;
  if (tabstops) {
    const groups = [
      { index: 1, ranges: [{ start: numeratorRangeStart, end: numeratorRangeEnd }] },
      ...tabstops.groups.map((group) => ({
        index: group.index === 0 ? 0 : group.index + 1,
        ranges: group.ranges.map((range) => ({ ...range }))
      }))
    ];
    tabstops = {
      groups,
      activeGroupIndex: 0
    };
  }

  return {
    text: parsed.text,
    tabstops: offsetTabstopState(tabstops, offset)
  };
}

function applySurroundingAutoEnlarge(
  input: AutofractionInput,
  value: string,
  tabstops: ReturnType<typeof offsetTabstopState>,
  numeratorStart: number,
  selectionEnd: number,
  replacedLength: number,
  insertedLength: number
): { value: string; tabstops: ReturnType<typeof offsetTabstopState> } {
  if (numeratorStart <= 0 || selectionEnd >= input.value.length) {
    return { value, tabstops };
  }

  const openingIndex = numeratorStart - 1;
  const openingChar = input.value[openingIndex];
  const closingChar = input.value[selectionEnd];
  const expectedClosing = OPEN_TO_CLOSE[openingChar];
  if (!expectedClosing || expectedClosing !== closingChar) {
    return { value, tabstops };
  }

  const openingReplacement = ENLARGE_OPEN[openingChar];
  const closingReplacement = ENLARGE_CLOSE[closingChar];
  if (!openingReplacement || !closingReplacement) {
    return { value, tabstops };
  }

  if (hasDelimiterCommandBefore(value, openingIndex)) {
    return { value, tabstops };
  }

  const closeIndexAfterFraction = selectionEnd + (insertedLength - replacedLength);
  if (closeIndexAfterFraction < 0 || closeIndexAfterFraction >= value.length) {
    return { value, tabstops };
  }

  const withOpening = `${value.slice(0, openingIndex)}${openingReplacement}${value.slice(openingIndex + 1)}`;
  const openingDelta = openingReplacement.length - 1;
  const closeIndexAfterOpening = closeIndexAfterFraction + openingDelta;
  const withClosing = `${withOpening.slice(0, closeIndexAfterOpening)}${closingReplacement}${withOpening.slice(
    closeIndexAfterOpening + 1
  )}`;
  const closingDelta = closingReplacement.length - 1;

  let shiftedTabstops = tabstops;
  shiftedTabstops = shiftTabstopState(shiftedTabstops, openingIndex + 1, openingDelta);
  shiftedTabstops = shiftTabstopState(shiftedTabstops, closeIndexAfterOpening + 1, closingDelta);

  return {
    value: withClosing,
    tabstops: shiftedTabstops
  };
}

export function applyAutofraction(input: AutofractionInput): ExpansionMutation | null {
  const { value, selectionStart, selectionEnd, symbol, breakingChars } = input;
  if (selectionStart !== selectionEnd || selectionStart < 1) {
    return null;
  }

  const slashIndex = selectionStart - 1;
  if (value[slashIndex] !== "/") {
    return null;
  }

  if (slashIndex > 0 && value[slashIndex - 1] === "/") {
    return null;
  }

  let numeratorStart = findNumeratorStart(value, slashIndex, breakingChars);
  let numerator = value.slice(numeratorStart, slashIndex);
  if (!numerator.trim()) {
    return null;
  }

  if (hasUnmatchedLeadingOpenDelimiter(numerator)) {
    numeratorStart += 1;
    numerator = value.slice(numeratorStart, slashIndex);
  }

  if (isWrappedByOuterParentheses(numerator.trim())) {
    numerator = numerator.trim().slice(1, -1);
  }

  const fraction = createFractionTabstops(symbol, numerator, numeratorStart);
  const replacedLength = selectionEnd - numeratorStart;
  const insertedLength = fraction.text.length;
  let nextValue = `${value.slice(0, numeratorStart)}${fraction.text}${value.slice(selectionEnd)}`;
  let nextTabstops = fraction.tabstops;

  if (shouldAutoEnlargeAroundFraction(input, symbol)) {
    const enlarged = applySurroundingAutoEnlarge(
      input,
      nextValue,
      nextTabstops,
      numeratorStart,
      selectionEnd,
      replacedLength,
      insertedLength
    );
    nextValue = enlarged.value;
    nextTabstops = enlarged.tabstops;
  }

  const selection = getActiveTabstopRange(nextTabstops);
  const caret = numeratorStart + insertedLength;

  return {
    value: nextValue,
    selectionStart: selection?.start ?? caret,
    selectionEnd: selection?.end ?? caret,
    tabstops: nextTabstops
  };
}
