import { describe, expect, it } from "vitest";
import { buildInstrumentedRender, extractHoverSnippet } from "./latexHoverMap";

describe("latexHoverMap", () => {
  it("extracts stable atoms for simple symbol input", () => {
    const result = buildInstrumentedRender("a+b");
    const snippets = Object.values(result.atomsById).map((atom) => atom.snippet);

    expect(result.html).toContain("data-ltx-id");
    expect(snippets).toContain("a");
    expect(snippets).toContain("+");
    expect(snippets).toContain("b");
  });

  it("captures command and script atoms", () => {
    const result = buildInstrumentedRender("\\alpha + x^{2} + a_{i}");
    const atoms = Object.values(result.atomsById);

    expect(atoms.some((atom) => atom.kind === "command" && atom.snippet === "\\alpha")).toBe(true);
    expect(atoms.some((atom) => atom.kind === "script" && atom.snippet === "^{2}")).toBe(true);
    expect(atoms.some((atom) => atom.kind === "script" && atom.snippet === "_{i}")).toBe(true);
  });

  it("keeps fractions renderable after instrumentation", () => {
    const result = buildInstrumentedRender("\\frac{a+b}{c}");

    expect(result.html).toContain("katex");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
    expect(Object.values(result.atomsById).some((atom) => atom.snippet === "\\frac{a+b}{c}")).toBe(true);
  });

  it("falls back gracefully for invalid latex", () => {
    const result = buildInstrumentedRender("\\frac{a}{");

    expect(Object.keys(result.atomsById)).toHaveLength(0);
    expect(result.html).toContain("formula-error");
  });

  it("returns snippets by atom id", () => {
    const result = buildInstrumentedRender("x+y");
    const firstAtom = Object.values(result.atomsById)[0];

    expect(extractHoverSnippet(firstAtom.id, result.atomsById)).toBe(firstAtom.snippet);
    expect(extractHoverSnippet("unknown", result.atomsById)).toBeNull();
  });
});
