import { describe, expect, it } from "vitest";
import { parseObsidianSnippetSource } from "./parserObsidian";

describe("parseObsidianSnippetSource", () => {
  it("accepts snippets with mode flags and keeps options parsed", () => {
    const source = `[
      { trigger: "mk", replacement: "$$0$", options: "tA" },
      { trigger: "sq", replacement: "\\\\sqrt{$0}", options: "mA" }
    ]`;

    const parsed = parseObsidianSnippetSource(source, {});
    expect(parsed.snippets).toHaveLength(2);
    expect(parsed.snippets[0].options.auto).toBe(true);
    expect(parsed.issues.some((issue) => issue.message.includes("mode flags"))).toBe(true);
  });

  it("warns and skips visual snippets", () => {
    const source = `[
      { trigger: "U", replacement: "\\\\underbrace{${"${VISUAL}"}}", options: "mAv" },
      { trigger: "sr", replacement: "^{2}", options: "mA" }
    ]`;

    const parsed = parseObsidianSnippetSource(source, {});
    expect(parsed.snippets).toHaveLength(1);
    expect(parsed.snippets[0].triggerSource).toBe("sr");
    expect(parsed.issues.some((issue) => issue.message.includes("not executed"))).toBe(true);
  });

  it("expands snippet variables in trigger and replacement", () => {
    const source = `[
      { trigger: "(\\\\\${GREEK})", replacement: "\\\\$1", options: "rA" }
    ]`;
    const parsed = parseObsidianSnippetSource(source, {
      "${GREEK}": "alpha|beta"
    });

    expect(parsed.snippets).toHaveLength(1);
    expect(parsed.snippets[0].triggerSource).toContain("alpha|beta");
  });
});
