import { describe, expect, it } from "vitest";
import { compareLatex, normalizeLatex } from "./matcher";

describe("matcher", () => {
  it("normalizes whitespace-only differences", () => {
    expect(normalizeLatex("  x +  y \n")).toBe("x+y");
  });

  it("normalizes optional script braces for single-token subscripts/superscripts", () => {
    expect(normalizeLatex("\\mathbf{p}_n=\\nabla f(\\mathbf{a_n})")).toBe(
      normalizeLatex("\\mathbf{p}_{n}=\\nabla f(\\mathbf{a_{n}})")
    );
    expect(normalizeLatex("x^\\alpha")).toBe(normalizeLatex("x^{\\alpha}"));
    expect(normalizeLatex("x_\\%")).toBe(normalizeLatex("x_{\\%}"));
    expect(normalizeLatex("x^2")).toBe(normalizeLatex("x^{2}"));
  });

  it("matches exact normalized strings immediately", async () => {
    const result = await compareLatex("x + y", "x+y");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
    expect(result.mismatchRatio).toBe(0);
  });

  it("treats _n and _{n} as exact equivalents", async () => {
    const result = await compareLatex("\\frac{h}{2}(b_1+b_2)", "\\frac{h}{2}(b_{1}+b_{2})");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
  });

  it("treats grouped and ungrouped script forms as exact for reported cases", async () => {
    const result = await compareLatex("\\mathbf{p}_n = \\nabla f(\\mathbf{a_n})", "\\mathbf{p}_{n}=\\nabla f(\\mathbf{a_{n}})");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
  });

  it("preserves command boundaries when whitespace is removed", async () => {
    const result = await compareLatex("\\int_{0}^{\\infty} e^{-x^2} dx", "\\int_0^\\infty e^{-x^2} dx");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
  });

  it("ignores spacing-only latex commands", async () => {
    const result = await compareLatex("f_n \\to f\\,\\text{in}\\quad L^1", "f_n\\to f\\text{in}L^1");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
  });

  it("normalizes core alias commands deterministically", async () => {
    const aliasResult = await compareLatex("x\\to y,\\ a\\le b,\\ c\\ge d", "x\\rightarrow y,\\ a\\leq b,\\ c\\geq d");
    expect(aliasResult.isMatch).toBe(true);
    expect(aliasResult.strategy).toBe("exact");
  });

  it("keeps \\left and \\right strict in canonical form", () => {
    expect(normalizeLatex("\\left(\\frac{1}{x}\\right)")).not.toBe(normalizeLatex("(\\frac{1}{x})"));
  });

  it("uses render comparator for semantically similar latex", async () => {
    const result = await compareLatex("\\frac{1}{2}", "\\dfrac{1}{2}", {
      tolerance: 0.02,
      renderComparator: async () => 0.01
    });
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("render");
  });

  it("marks non-matching formulas as incorrect", async () => {
    const result = await compareLatex("\\frac{1}{2}", "\\frac{3}{4}", {
      tolerance: 0.01,
      renderComparator: async () => 0.2
    });
    expect(result.isMatch).toBe(false);
    expect(result.strategy).toBe("render");
  });

  it("fails gracefully when comparator errors", async () => {
    const result = await compareLatex("x^2", "x^3", {
      renderComparator: async () => {
        throw new Error("invalid latex");
      }
    });
    expect(result.isMatch).toBe(false);
    expect(result.strategy).toBe("fail");
  });
});
