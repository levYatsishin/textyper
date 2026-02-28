import type { CompiledSnippet, ExpansionMutation } from "../../types";
import { getActiveTabstopRange, offsetTabstopState, resolveTabstops } from "./tabstops";

interface SnippetMatch {
  snippet: CompiledSnippet;
  start: number;
  end: number;
  captures: string[];
}

interface ExpansionInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  snippets: CompiledSnippet[];
  wordDelimiters: string;
}

function isWordLikeTrigger(trigger: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(trigger);
}

function isBoundaryCharacter(char: string | undefined, wordDelimiters: string): boolean {
  if (!char) {
    return true;
  }
  if (/\s/.test(char)) {
    return true;
  }
  return wordDelimiters.includes(char);
}

function hasWordBoundary(
  value: string,
  start: number,
  end: number,
  wordDelimiters: string
): boolean {
  const before = value[start - 1];
  const after = value[end];
  return isBoundaryCharacter(before, wordDelimiters) && isBoundaryCharacter(after, wordDelimiters);
}

function replaceRegexCaptures(template: string, captures: string[]): string {
  let output = template;
  captures.forEach((capture, index) => {
    output = output.split(`[[${index}]]`).join(capture ?? "");
  });
  return output;
}

function findSnippetMatch(
  input: ExpansionInput,
  runMode: "auto" | "manual"
): SnippetMatch | null {
  const { value, selectionStart, selectionEnd, snippets, wordDelimiters } = input;
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const beforeCursor = value.slice(0, selectionStart);
  const ordered = snippets.filter((snippet) => (runMode === "auto" ? snippet.options.auto : !snippet.options.auto));
  for (const snippet of ordered) {
    if (snippet.options.regex) {
      const trigger = snippet.trigger as RegExp;
      trigger.lastIndex = 0;
      const match = trigger.exec(beforeCursor);
      if (!match || match.index < 0) {
        continue;
      }

      const start = selectionStart - match[0].length;
      const end = selectionStart;
      if (snippet.options.wordBoundary && !hasWordBoundary(value, start, end, wordDelimiters)) {
        continue;
      }

      return {
        snippet,
        start,
        end,
        captures: match.slice(1)
      };
    }

    const trigger = snippet.trigger as string;
    if (!beforeCursor.endsWith(trigger)) {
      continue;
    }
    const start = selectionStart - trigger.length;
    const end = selectionStart;
    const preceding = value[start - 1];

    if (preceding === "\\" && isWordLikeTrigger(trigger)) {
      continue;
    }

    if (snippet.options.wordBoundary && !hasWordBoundary(value, start, end, wordDelimiters)) {
      continue;
    }

    return {
      snippet,
      start,
      end,
      captures: []
    };
  }

  return null;
}

function applySnippetMatch(input: ExpansionInput, match: SnippetMatch): ExpansionMutation {
  const { value, selectionEnd } = input;
  const rawReplacement = match.captures.length
    ? replaceRegexCaptures(match.snippet.replacement, match.captures)
    : match.snippet.replacement;
  const parsed = resolveTabstops(rawReplacement);
  const tabstops = offsetTabstopState(parsed.tabstops, match.start);
  const nextValue = `${value.slice(0, match.start)}${parsed.text}${value.slice(selectionEnd)}`;
  const selection = getActiveTabstopRange(tabstops);
  const defaultCursor = match.start + parsed.text.length;

  return {
    value: nextValue,
    selectionStart: selection?.start ?? defaultCursor,
    selectionEnd: selection?.end ?? defaultCursor,
    tabstops
  };
}

export function applySnippetExpansions(
  input: ExpansionInput,
  runMode: "auto" | "manual",
  maxPasses = 1
): ExpansionMutation | null {
  let mutationInput = { ...input };
  let mutation: ExpansionMutation | null = null;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const match = findSnippetMatch(mutationInput, runMode);
    if (!match) {
      break;
    }

    mutation = applySnippetMatch(mutationInput, match);
    mutationInput = {
      ...mutationInput,
      value: mutation.value,
      selectionStart: mutation.selectionStart,
      selectionEnd: mutation.selectionEnd
    };

    if (runMode === "manual") {
      break;
    }
  }

  return mutation;
}
