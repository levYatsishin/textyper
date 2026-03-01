import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPANSION_SETTINGS,
  DEFAULT_EXPANSION_VARIABLES_SOURCE,
  DEFAULT_OBSIDIAN_SNIPPETS_SOURCE
} from "../../data/expansionsDefaults";
import type { CompiledSnippet } from "../../types";
import { applySnippetExpansions } from "./engine";
import { parseObsidianSnippetSource } from "./parserObsidian";
import { parseSnippetVariablesSource } from "./variables";

function compileDefaultSnippets(): CompiledSnippet[] {
  const parsedVariables = parseSnippetVariablesSource(DEFAULT_EXPANSION_VARIABLES_SOURCE);
  const parsedSnippets = parseObsidianSnippetSource(
    DEFAULT_OBSIDIAN_SNIPPETS_SOURCE,
    parsedVariables.variables
  );
  return parsedSnippets.snippets;
}

function runAutoExpansion(input: string, snippets: CompiledSnippet[]): string {
  const mutation = applySnippetExpansions(
    {
      value: input,
      selectionStart: input.length,
      selectionEnd: input.length,
      snippets,
      wordDelimiters: DEFAULT_EXPANSION_SETTINGS.wordDelimiters
    },
    "auto",
    2
  );

  return mutation?.value ?? input;
}

describe("default snippet pack behavior", () => {
  const snippets = compileDefaultSnippets();

  it("keeps a large valid trainer-focused snippet set", () => {
    expect(snippets.length).toBeGreaterThanOrEqual(150);
  });

  it("expands high-frequency triggers to single-backslash commands", () => {
    const cases: Array<[string, RegExp]> = [
      ["sum", /^\\sum$/],
      ["prod", /^\\prod$/],
      ["int", /^\\int\b/],
      ["ooo", /^\\infty$/],
      ["->", /^\\to$/],
      [">=", /^\\geq$/],
      ["@b", /^\\beta$/],
      ["@p", /^\\pi$/],
      ["@g", /^\\gamma$/],
      ["@o", /^\\omega$/]
    ];

    for (const [trigger, expected] of cases) {
      const output = runAutoExpansion(trigger, snippets);
      expect(output).toMatch(expected);
      if (trigger === "int") {
        expect(output).toContain("\\, d");
      }
      expect(output).not.toMatch(/\\\\[A-Za-z]/);
    }
  });

  it("normalizes bare greek words without corrupting existing commands", () => {
    expect(runAutoExpansion(" beta", snippets)).toBe(" \\beta");
    expect(runAutoExpansion("(pi", snippets)).toBe("(\\pi");
    expect(runAutoExpansion("\\beta", snippets)).toBe("\\beta");
    expect(runAutoExpansion("@beta", snippets)).toBe("@\\beta");
  });

  it("does not break existing command words into partial commands", () => {
    expect(runAutoExpansion("\\beta", snippets)).not.toContain("\\b\\eta");
    expect(runAutoExpansion("\\sum", snippets)).not.toContain("\\s\\um");
    expect(runAutoExpansion("\\implies", snippets)).toBe("\\implies");
  });

  it("still applies regex helpers for indices and decorators", () => {
    expect(runAutoExpansion("x2", snippets)).toBe("x_{2}");
    expect(runAutoExpansion("vhat", snippets)).toBe("\\hat{v}");
    expect(runAutoExpansion("qdot", snippets)).toBe("\\dot{q}");
  });

  it("keeps integral shortcuts stable and non-intrusive", () => {
    expect(runAutoExpansion("lim", snippets)).toBe("\\lim_{n \\to \\infty} ");
    expect(runAutoExpansion("int", snippets)).toMatch(/^\\int/);
    expect(runAutoExpansion("iint", snippets)).toBe("\\iint");
    expect(runAutoExpansion("iiint", snippets)).toBe("\\iiint");
    expect(runAutoExpansion("oint", snippets)).toBe("\\oint");
    expect(runAutoExpansion("oinf", snippets).startsWith("\\int_{0}^{\\infty}")).toBe(true);
    expect(runAutoExpansion("infi", snippets).startsWith("\\int_{-\\infty}^{\\infty}")).toBe(true);
    expect(runAutoExpansion("dint", snippets).startsWith("\\int_{")).toBe(true);

    expect(runAutoExpansion("point", snippets)).toBe("point");
    expect(runAutoExpansion("print", snippets)).toBe("print");
  });

  it("keeps relation and trig helpers stable around existing commands", () => {
    expect(runAutoExpansion(" implies", snippets)).toBe(" \\implies");
    expect(runAutoExpansion("\\implies", snippets)).toBe("\\implies");
    expect(runAutoExpansion(" sin", snippets)).toBe(" \\sin");
    expect(runAutoExpansion("\\sin", snippets)).toBe("\\sin");
  });

  it("never injects a doubled command prefix for word-like auto triggers", () => {
    const wordLikeAuto = snippets.filter(
      (snippet) =>
        snippet.options.auto &&
        !snippet.options.regex &&
        typeof snippet.trigger === "string" &&
        /^[A-Za-z][A-Za-z0-9]*$/.test(snippet.trigger)
    );

    for (const snippet of wordLikeAuto) {
      const output = runAutoExpansion(snippet.trigger as string, snippets);
      expect(output, `trigger "${snippet.trigger}" produced doubled slash output`).not.toMatch(/\\\\[A-Za-z]/);
    }
  });
});
