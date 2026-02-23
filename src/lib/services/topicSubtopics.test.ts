import { describe, expect, it } from "vitest";
import { getTopicScopedSubtopics } from "./topicSubtopics";
import type { Expression } from "../types";

function createExpression(overrides: Partial<Expression>): Expression {
  return {
    id: "expr-test",
    latex: "\\neg (A \\vee B) \\equiv (\\neg A) \\wedge (\\neg B)",
    difficulty: "beginner",
    complexityScore: 10,
    complexityBand: "beginner",
    name: "Logic identity",
    topics: ["real-analysis", "set-logic"],
    subtopics: ["modular arithmetic", "logic rules"],
    ...overrides
  };
}

describe("getTopicScopedSubtopics", () => {
  it("normalizes real-analysis subtopics to canonical categories", () => {
    const expression = createExpression({});
    expect(getTopicScopedSubtopics(expression, "real-analysis")).toEqual(["fundamentals"]);
  });

  it("keeps canonical real-analysis subtopics when present", () => {
    const expression = createExpression({
      latex: "\\int_0^1 f_n(x)\\,dx \\to \\int_0^1 f(x)\\,dx",
      subtopics: ["integrals", "convergence modes"]
    });

    expect(getTopicScopedSubtopics(expression, "real-analysis")).toEqual(["integrals", "convergence modes"]);
  });

  it("returns original subtopics for non real-analysis topics", () => {
    const expression = createExpression({
      topics: ["number-theory"],
      subtopics: ["modular arithmetic"]
    });

    expect(getTopicScopedSubtopics(expression, "number-theory")).toEqual(["modular arithmetic"]);
  });
});
