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
    topics: ["set-logic"],
    subtopics: ["logic rules"],
    ...overrides
  };
}

describe("getTopicScopedSubtopics", () => {
  it("returns normalized subtopics for any topic", () => {
    const expression = createExpression({
      subtopics: ["modular arithmetic", "logic rules", "logic rules", " "]
    });

    expect(getTopicScopedSubtopics(expression, "set-logic")).toEqual(["modular arithmetic", "logic rules"]);
  });

  it("falls back to fundamentals when no subtopics exist", () => {
    const expression = createExpression({ subtopics: [] });
    expect(getTopicScopedSubtopics(expression, "algebra")).toEqual(["fundamentals"]);
  });
});
