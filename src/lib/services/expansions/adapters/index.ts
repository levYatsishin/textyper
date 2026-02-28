import type { SnippetParseResult } from "../../../types";

export type SnippetAdapterId = "obsidian" | "luasnip" | "nvim-snippy" | "mini-snippets" | "ultisnips";

export interface SnippetAdapter {
  id: SnippetAdapterId;
  parse(source: string, variablesSource: string): SnippetParseResult;
}

export const EXPANSION_ADAPTER_PLACEHOLDERS: Record<Exclude<SnippetAdapterId, "obsidian">, null> = {
  luasnip: null,
  "nvim-snippy": null,
  "mini-snippets": null,
  ultisnips: null
};
