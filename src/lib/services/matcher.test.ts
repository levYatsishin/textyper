import { describe, expect, it } from "vitest";
import { compareLatex, normalizeLatex } from "./matcher";

describe("matcher", () => {
  it("normalizes whitespace-only differences", () => {
    expect(normalizeLatex("  x +  y \n")).toBe("x+y");
  });

  it("matches exact normalized strings immediately", async () => {
    const result = await compareLatex("x + y", "x+y");
    expect(result.isMatch).toBe(true);
    expect(result.strategy).toBe("exact");
    expect(result.mismatchRatio).toBe(0);
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
