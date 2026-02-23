import { describe, expect, it } from "vitest";
import { EXPRESSIONS } from "../data/expressions";
import {
  analyzeLatexComplexity,
  classifyComplexity,
  extractComplexityFeatures,
  getCommandTierWeight,
  tokenizeLatex
} from "./complexity";

describe("complexity service", () => {
  it("is whitespace invariant for score", () => {
    const compact = analyzeLatexComplexity("a+b");
    const spaced = analyzeLatexComplexity("a + b");

    expect(compact.features.nonWhitespaceChars).toBe(spaced.features.nonWhitespaceChars);
    expect(compact.score).toBe(spaced.score);
  });

  it("tokenizes command names and control symbol escapes", () => {
    const tokens = tokenizeLatex("\\alpha + \\% + \\operatorname{Res}");

    expect(tokens.some((token) => token.token === "alpha" && !token.isControlSymbol)).toBe(true);
    expect(tokens.some((token) => token.token === "%" && token.isControlSymbol)).toBe(true);
    expect(tokens.some((token) => token.token === "operatorname" && !token.isControlSymbol)).toBe(true);
  });

  it("extracts nested depth features", () => {
    const features = extractComplexityFeatures("x^{a_{b^c}} + \\frac{1}{\\frac{1}{2}}");

    expect(features.maxGroupDepth).toBeGreaterThanOrEqual(2);
    expect(features.maxScriptDepth).toBeGreaterThanOrEqual(2);
    expect(features.fracRootBinomDepth).toBeGreaterThanOrEqual(2);
  });

  it("uses tiered rarity weights", () => {
    expect(getCommandTierWeight("frac")).toBe(0.4);
    expect(getCommandTierWeight("mathscr")).toBe(1);
    expect(getCommandTierWeight("stackrel")).toBe(1.9);
    expect(getCommandTierWeight("totallyunknowncommand")).toBe(2.8);
    expect(getCommandTierWeight("frac")).toBeLessThan(getCommandTierWeight("mathscr"));
    expect(getCommandTierWeight("mathscr")).toBeLessThan(getCommandTierWeight("stackrel"));
    expect(getCommandTierWeight("stackrel")).toBeLessThan(getCommandTierWeight("totallyunknowncommand"));
  });

  it("increases score with deeper fraction nesting", () => {
    const base = analyzeLatexComplexity("\\frac{1}{2}");
    const nested = analyzeLatexComplexity("\\frac{1}{\\frac{1}{2}}");

    expect(nested.score).toBeGreaterThan(base.score);
  });

  it("increases score when adding rare commands", () => {
    const common = analyzeLatexComplexity("x+y");
    const rare = analyzeLatexComplexity("x + \\totallyunknowncommand{y}");

    expect(rare.score).toBeGreaterThan(common.score);
  });

  it("maps threshold boundaries correctly", () => {
    expect(classifyComplexity(32)).toBe("beginner");
    expect(classifyComplexity(33)).toBe("intermediate");
    expect(classifyComplexity(49)).toBe("intermediate");
    expect(classifyComplexity(50)).toBe("advanced");
  });

  it("spreads scores high enough on current corpus", () => {
    const maxScore = Math.max(...EXPRESSIONS.map((expression) => expression.complexityScore));
    expect(maxScore).toBeGreaterThanOrEqual(70);
  });
});
