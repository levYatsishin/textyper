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

  it("captures command and scripted cluster atoms", () => {
    const result = buildInstrumentedRender("\\alpha + x^{2} + a_{i}");
    const atoms = Object.values(result.atomsById);

    expect(atoms.some((atom) => atom.kind === "command" && atom.snippet === "\\alpha")).toBe(true);
    expect(atoms.some((atom) => atom.kind === "script" && atom.snippet === "x^{2}")).toBe(true);
    expect(atoms.some((atom) => atom.kind === "script" && atom.snippet === "a_{i}")).toBe(true);
    expect(atoms.some((atom) => atom.snippet.startsWith("^") || atom.snippet.startsWith("_"))).toBe(false);
  });

  it("keeps fractions renderable after instrumentation", () => {
    const result = buildInstrumentedRender("\\frac{a+b}{c}");

    expect(result.html).toContain("katex");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
    expect(Object.values(result.atomsById).some((atom) => atom.snippet === "\\frac{a+b}{c}")).toBe(true);
  });

  it("renders formulas with left/right delimiters without disabling hover", () => {
    const result = buildInstrumentedRender("\\lim_{x \\to \\infty} \\left (1 + \\frac{1}{x} \\right)^x = e");

    expect(result.html).toContain("katex");
    expect(result.html).toContain("data-ltx-id");
    expect(result.html).not.toContain("formula-error");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
  });

  it("keeps styled command snippets as single hover atoms", () => {
    const result = buildInstrumentedRender("\\operatorname{Conv}_h(z)=\\Delta \\mathbf{x}=r\\mathbf{v}");
    const snippets = Object.values(result.atomsById).map((atom) => atom.snippet);

    expect(snippets.some((snippet) => snippet.includes("\\operatorname{Conv}"))).toBe(true);
    expect(snippets).toContain("\\mathbf{v}");
  });

  it("supports align environment with hover ids", () => {
    const result = buildInstrumentedRender(
      "\\begin{align} x &= \\frac{1 - s^2}{1 + s^2} \\\\[5pt] y &= \\frac{2s}{1 + s^2} \\end{align}"
    );

    expect(result.html).toContain("katex");
    expect(result.html).toContain("data-ltx-id");
    expect(result.html).not.toContain("formula-error");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
  });

  it("supports limits with dense scripts", () => {
    const result = buildInstrumentedRender(
      "0=\\nabla_{x}L(x^{*},\\lambda^{*})=\\nabla f(x^{*})-\\sum \\limits_{i\\in A(x^{*})}\\lambda_{i}^{*}\\nabla c_{i}(x^{*})"
    );

    expect(result.html).toContain("katex");
    expect(result.html).toContain("data-ltx-id");
    expect(result.html).not.toContain("formula-error");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
    expect(Object.values(result.atomsById).some((atom) => atom.kind === "script" && atom.snippet.includes("x^{*}"))).toBe(
      true
    );
    expect(
      Object.values(result.atomsById).some((atom) => atom.kind === "script" && atom.snippet.includes("\\lambda_{i}^{*}"))
    ).toBe(true);
  });

  it("supports matrix environments", () => {
    const result = buildInstrumentedRender("A^{-1}=\\frac{1}{\\det A}\\times \\begin{pmatrix}d & -b \\\\ -c & a\\end{pmatrix}");

    expect(result.html).toContain("katex");
    expect(result.html).toContain("data-ltx-id");
    expect(result.html).not.toContain("formula-error");
    expect(Object.keys(result.atomsById).length).toBeGreaterThan(0);
  });

  it("keeps large operators hoverable with scripts and limits", () => {
    const result = buildInstrumentedRender("\\int_{0}^{\\infty} e^{-x^2} dx + \\sum \\limits_{n=1}^{\\infty} a_n");
    const snippets = Object.values(result.atomsById).map((atom) => atom.snippet);

    expect(result.html).toContain("data-ltx-id");
    expect(snippets.some((snippet) => snippet.startsWith("\\int_"))).toBe(true);
    expect(snippets.some((snippet) => snippet.startsWith("\\sum"))).toBe(true);
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
