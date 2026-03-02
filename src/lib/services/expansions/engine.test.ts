import { describe, expect, it } from "vitest";
import type { CompiledSnippet } from "../../types";
import { applySnippetExpansions } from "./engine";

function createSnippet(partial: Partial<CompiledSnippet>): CompiledSnippet {
  return {
    id: "snippet",
    trigger: "",
    triggerSource: "",
    replacement: "",
    options: {
      auto: false,
      regex: false,
      visual: false,
      wordBoundary: false,
      modes: {
        text: false,
        math: false,
        blockMath: false,
        inlineMath: false,
        code: false
      }
    },
    priority: 0,
    description: "",
    triggerKey: null,
    ...partial
  };
}

describe("snippet expansion engine", () => {
  it("runs auto snippets on input", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "auto-square",
        trigger: "sr",
        triggerSource: "sr",
        replacement: "^{2}",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const result = applySnippetExpansions(
      {
        value: "xsr",
        selectionStart: 3,
        selectionEnd: 3,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );

    expect(result).toBeTruthy();
    expect(result?.value).toBe("x^{2}");
  });

  it("runs manual snippets on tab only", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "manual-sum",
        trigger: "sum",
        triggerSource: "sum",
        replacement: "\\sum_{${1:i}=1}^{n} $0",
        options: {
          auto: false,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const autoResult = applySnippetExpansions(
      {
        value: "sum",
        selectionStart: 3,
        selectionEnd: 3,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );
    expect(autoResult).toBeNull();

    const manualResult = applySnippetExpansions(
      {
        value: "sum",
        selectionStart: 3,
        selectionEnd: 3,
        snippets,
        wordDelimiters: " ,.;"
      },
      "manual"
    );
    expect(manualResult?.value).toContain("\\sum");
    expect(manualResult?.tabstops).toBeTruthy();
  });

  it("supports regex captures in replacement", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "regex-subscript",
        trigger: /(?:([A-Za-z])(\d))$/,
        triggerSource: "([A-Za-z])(\\d)",
        replacement: "[[0]]_{[[1]]}",
        options: {
          auto: true,
          regex: true,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const result = applySnippetExpansions(
      {
        value: "x2",
        selectionStart: 2,
        selectionEnd: 2,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );

    expect(result?.value).toBe("x_{2}");
  });

  it("respects word-boundary snippets", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "word-to",
        trigger: "to",
        triggerSource: "to",
        replacement: "\\to",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: true,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const invalid = applySnippetExpansions(
      {
        value: "atom",
        selectionStart: 4,
        selectionEnd: 4,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );
    expect(invalid).toBeNull();

    const valid = applySnippetExpansions(
      {
        value: " to",
        selectionStart: 3,
        selectionEnd: 3,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );
    expect(valid?.value).toBe(" \\to");
  });

  it("does not re-expand word triggers inside existing commands", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "auto-sum",
        trigger: "sum",
        triggerSource: "sum",
        replacement: "\\sum",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const result = applySnippetExpansions(
      {
        value: "\\sum",
        selectionStart: 4,
        selectionEnd: 4,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto"
    );

    expect(result).toBeNull();
  });

  it("avoids self-retrigger loops across auto passes", () => {
    const snippets: CompiledSnippet[] = [
      createSnippet({
        id: "auto-escaped-set",
        trigger: "\\{",
        triggerSource: "\\{",
        replacement: "\\{$1\\}$0",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const result = applySnippetExpansions(
      {
        value: "\\{",
        selectionStart: 2,
        selectionEnd: 2,
        snippets,
        wordDelimiters: " ,.;"
      },
      "auto",
      2
    );

    expect(result?.value).toBe("\\{\\}");
  });
});
