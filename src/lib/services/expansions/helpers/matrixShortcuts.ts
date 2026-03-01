import type { ExpansionMutation } from "../../../types";

interface MatrixShortcutInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  key: "Tab" | "Enter";
  environments: string[];
}

function countMatches(input: string, pattern: RegExp): number {
  const matches = input.match(pattern);
  return matches ? matches.length : 0;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideMatrixEnvironment(value: string, cursor: number, environments: string[]): boolean {
  const beforeCursor = value.slice(0, cursor);
  return environments.some((environment) => {
    const escaped = escapeRegExp(environment);
    const beginPattern = new RegExp(`\\\\begin\\{${escaped}\\}`, "g");
    const endPattern = new RegExp(`\\\\end\\{${escaped}\\}`, "g");
    return countMatches(beforeCursor, beginPattern) > countMatches(beforeCursor, endPattern);
  });
}

function insertText(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string
): ExpansionMutation {
  const nextValue = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
  const cursor = selectionStart + insert.length;
  return {
    value: nextValue,
    selectionStart: cursor,
    selectionEnd: cursor,
    tabstops: null
  };
}

export function applyMatrixShortcuts(input: MatrixShortcutInput): ExpansionMutation | null {
  const { value, selectionStart, selectionEnd, key, environments } = input;
  if (!isInsideMatrixEnvironment(value, selectionStart, environments)) {
    return null;
  }

  if (key === "Tab" && selectionStart === selectionEnd) {
    return insertText(value, selectionStart, selectionEnd, " & ");
  }

  if (key === "Enter") {
    return insertText(value, selectionStart, selectionEnd, " \\\\\n");
  }

  return null;
}
