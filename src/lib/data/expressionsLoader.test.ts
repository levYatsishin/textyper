import { describe, expect, it } from "vitest";
import { loadExpressionsFromJson } from "./expressionsLoader";

const validPayload = {
  version: "v1",
  generatedAt: "2026-02-23T00:00:00.000Z",
  expressions: [
    {
      id: "expr-test-1",
      latex: "a+b",
      difficulty: "beginner",
      complexityScore: 10,
      complexityBand: "beginner",
      name: "Simple sum",
      topics: ["algebra"],
      subtopics: ["fundamentals"]
    }
  ]
};

describe("expressionsLoader", () => {
  it("loads valid JSON payload", () => {
    const expressions = loadExpressionsFromJson(validPayload);
    expect(expressions).toHaveLength(1);
    expect(expressions[0].id).toBe("expr-test-1");
  });

  it("rejects invalid difficulty", () => {
    const payload = {
      ...validPayload,
      expressions: [{ ...validPayload.expressions[0], difficulty: "easy" }]
    };
    expect(() => loadExpressionsFromJson(payload)).toThrow(/difficulty/);
  });

  it("rejects complexity scores outside range", () => {
    const payload = {
      ...validPayload,
      expressions: [{ ...validPayload.expressions[0], complexityScore: 120 }]
    };
    expect(() => loadExpressionsFromJson(payload)).toThrow(/complexityScore/);
  });

  it("rejects unknown topic ids", () => {
    const payload = {
      ...validPayload,
      expressions: [{ ...validPayload.expressions[0], topics: ["not-a-topic"] }]
    };
    expect(() => loadExpressionsFromJson(payload)).toThrow(/unknown topic ids/);
  });

  it("rejects duplicate ids", () => {
    const duplicate = { ...validPayload.expressions[0] };
    const payload = {
      ...validPayload,
      expressions: [validPayload.expressions[0], duplicate]
    };
    expect(() => loadExpressionsFromJson(payload)).toThrow(/Duplicate expression id/);
  });

  it("rejects mismatch between difficulty and complexityBand", () => {
    const payload = {
      ...validPayload,
      expressions: [{ ...validPayload.expressions[0], complexityBand: "advanced" }]
    };
    expect(() => loadExpressionsFromJson(payload)).toThrow(/must equal complexityBand/);
  });
});
