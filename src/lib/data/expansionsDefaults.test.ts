import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPANSION_VARIABLES_SOURCE,
  DEFAULT_OBSIDIAN_SNIPPETS_SOURCE
} from "./expansionsDefaults";
import { parseObsidianSnippetSource } from "../services/expansions/parserObsidian";
import { parseSnippetVariablesSource } from "../services/expansions/variables";

describe("expansion defaults", () => {
  it("parse cleanly for trainer runtime", () => {
    const variablesParsed = parseSnippetVariablesSource(DEFAULT_EXPANSION_VARIABLES_SOURCE);
    expect(variablesParsed.issues).toHaveLength(0);

    const snippetsParsed = parseObsidianSnippetSource(
      DEFAULT_OBSIDIAN_SNIPPETS_SOURCE,
      variablesParsed.variables
    );

    expect(snippetsParsed.snippets.length).toBeGreaterThan(40);
    expect(snippetsParsed.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(snippetsParsed.issues.some((issue) => issue.message.includes("not executed"))).toBe(false);
  });
});
