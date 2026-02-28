import type { ExpansionMutation } from "../../../types";
import { getActiveTabstopRange, offsetTabstopState, resolveTabstops } from "../tabstops";

interface AutofractionInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  symbol: string;
  breakingChars: string;
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

export function applyAutofraction(input: AutofractionInput): ExpansionMutation | null {
  const { value, selectionStart, selectionEnd, symbol, breakingChars } = input;
  if (selectionStart !== selectionEnd || selectionStart < 1) {
    return null;
  }

  const slashIndex = selectionStart - 1;
  if (value[slashIndex] !== "/") {
    return null;
  }

  const numeratorStart = findNumeratorStart(value, slashIndex, breakingChars);
  let numerator = value.slice(numeratorStart, slashIndex);
  if (!numerator.trim()) {
    return null;
  }

  if (isWrappedByOuterParentheses(numerator.trim())) {
    numerator = numerator.trim().slice(1, -1);
  }

  const template = `${symbol}{${numerator}}{$1}$0`;
  const parsed = resolveTabstops(template);
  const tabstops = offsetTabstopState(parsed.tabstops, numeratorStart);
  const nextValue = `${value.slice(0, numeratorStart)}${parsed.text}${value.slice(selectionEnd)}`;
  const selection = getActiveTabstopRange(tabstops);
  const caret = numeratorStart + parsed.text.length;

  return {
    value: nextValue,
    selectionStart: selection?.start ?? caret,
    selectionEnd: selection?.end ?? caret,
    tabstops
  };
}
