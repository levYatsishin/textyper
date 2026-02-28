import type { ExpansionMutation } from "../../../types";

interface AutoBracketsInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  key: string;
  autoEnlargeEnabled: boolean;
  autoEnlargeTriggers: string[];
}

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "|": "|"
};

const CLOSE_TO_OPEN: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
  "|": "|"
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

function isEscaped(value: string, index: number): boolean {
  let backslashCount = 0;
  for (let current = index - 1; current >= 0; current -= 1) {
    if (value[current] !== "\\") {
      break;
    }
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function hasDelimiterCommandBefore(value: string, index: number): boolean {
  const windowStart = Math.max(0, index - 10);
  const before = value.slice(windowStart, index);
  return /\\(?:left|right)\s*\\?$/.test(before);
}

function findMatchingOpeningIndex(value: string, closingIndex: number, closingChar: string): number {
  const openingChar = CLOSE_TO_OPEN[closingChar];
  if (!openingChar) {
    return -1;
  }

  if (closingChar === "|") {
    for (let index = closingIndex - 1; index >= 0; index -= 1) {
      if (value[index] !== "|" || isEscaped(value, index)) {
        continue;
      }
      return index;
    }
    return -1;
  }

  let depth = 0;
  for (let index = closingIndex - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (isEscaped(value, index)) {
      continue;
    }

    if (char === closingChar) {
      depth += 1;
      continue;
    }

    if (char === openingChar) {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }

  return -1;
}

function tryAutoEnlarge(
  value: string,
  cursorIndex: number,
  closingChar: string,
  autoEnlargeTriggers: string[]
): ExpansionMutation | null {
  const openingReplacement = ENLARGE_OPEN[CLOSE_TO_OPEN[closingChar] ?? ""];
  const closingReplacement = ENLARGE_CLOSE[closingChar];
  if (!openingReplacement || !closingReplacement) {
    return null;
  }

  const openingIndex = findMatchingOpeningIndex(value, cursorIndex, closingChar);
  if (openingIndex < 0) {
    return null;
  }

  if (hasDelimiterCommandBefore(value, openingIndex) || hasDelimiterCommandBefore(value, cursorIndex)) {
    return null;
  }

  const content = value.slice(openingIndex + 1, cursorIndex);
  if (!content.trim()) {
    return null;
  }

  if (content.includes("\\left") || content.includes("\\right")) {
    return null;
  }

  const containsTrigger = autoEnlargeTriggers.some((trigger) => content.includes(trigger));
  if (!containsTrigger) {
    return null;
  }

  const nextValue = `${value.slice(0, openingIndex)}${openingReplacement}${content}${closingReplacement}${value.slice(
    cursorIndex + 1
  )}`;
  const nextCursor = openingIndex + openingReplacement.length + content.length + closingReplacement.length;

  return {
    value: nextValue,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    tabstops: null
  };
}

interface PassiveAutoEnlargeInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  autoEnlargeEnabled: boolean;
  autoEnlargeTriggers: string[];
}

export function applyPassiveAutoEnlarge(input: PassiveAutoEnlargeInput): ExpansionMutation | null {
  if (!input.autoEnlargeEnabled || input.selectionStart !== input.selectionEnd) {
    return null;
  }

  const closingChar = input.value[input.selectionStart];
  if (!closingChar || !ENLARGE_CLOSE[closingChar]) {
    return null;
  }

  return tryAutoEnlarge(input.value, input.selectionStart, closingChar, input.autoEnlargeTriggers);
}

function handleOpeningBracket(input: AutoBracketsInput): ExpansionMutation | null {
  const closingChar = OPEN_TO_CLOSE[input.key];
  if (!closingChar) {
    return null;
  }

  if (hasDelimiterCommandBefore(input.value, input.selectionStart)) {
    return null;
  }

  const selected = input.value.slice(input.selectionStart, input.selectionEnd);
  const nextValue = `${input.value.slice(0, input.selectionStart)}${input.key}${selected}${closingChar}${input.value.slice(
    input.selectionEnd
  )}`;
  const nextSelectionStart = input.selectionStart + 1;
  const nextSelectionEnd = nextSelectionStart + selected.length;

  return {
    value: nextValue,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd,
    tabstops: null
  };
}

function handleClosingBracket(input: AutoBracketsInput): ExpansionMutation | null {
  if (input.selectionStart !== input.selectionEnd) {
    return null;
  }

  if (input.value[input.selectionStart] !== input.key) {
    return null;
  }

  if (input.autoEnlargeEnabled) {
    const enlarged = tryAutoEnlarge(input.value, input.selectionStart, input.key, input.autoEnlargeTriggers);
    if (enlarged) {
      return enlarged;
    }
  }

  const nextCursor = input.selectionStart + 1;
  return {
    value: input.value,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    tabstops: null
  };
}

export function applyAutoBrackets(input: AutoBracketsInput): ExpansionMutation | null {
  if (input.selectionStart < 0 || input.selectionEnd < input.selectionStart) {
    return null;
  }

  if (OPEN_TO_CLOSE[input.key]) {
    return handleOpeningBracket(input);
  }

  if (CLOSE_TO_OPEN[input.key]) {
    return handleClosingBracket(input);
  }

  return null;
}
