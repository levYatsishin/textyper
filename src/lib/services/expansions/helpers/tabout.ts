import type { ExpansionMutation } from "../../../types";

interface TaboutInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  closingSymbols: string[];
}

export function applyTabout(input: TaboutInput): ExpansionMutation | null {
  const { value, selectionStart, selectionEnd, closingSymbols } = input;
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const currentChar = value[selectionStart];
  if (!currentChar || !closingSymbols.includes(currentChar)) {
    return null;
  }

  const nextCursor = selectionStart + 1;
  return {
    value,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    tabstops: null
  };
}
