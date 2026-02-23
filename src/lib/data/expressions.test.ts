import { describe, expect, it } from "vitest";
import { EXPRESSIONS } from "./expressions";
import { ALL_TOPIC_IDS } from "./topics";

describe("expressions dataset", () => {
  it("includes name, topics, and subtopics per formula", () => {
    for (const expression of EXPRESSIONS) {
      expect(expression.name.trim().length).toBeGreaterThan(0);
      expect(expression.topics.length).toBeGreaterThan(0);
      expect(expression.subtopics.length).toBeGreaterThan(0);
    }
  });

  it("uses only known topic ids", () => {
    const allowed = new Set(ALL_TOPIC_IDS);
    for (const expression of EXPRESSIONS) {
      for (const topicId of expression.topics) {
        expect(allowed.has(topicId)).toBe(true);
      }
    }
  });

  it("stores computed complexity score and band", () => {
    for (const expression of EXPRESSIONS) {
      expect(expression.complexityScore).toBeGreaterThanOrEqual(0);
      expect(expression.complexityScore).toBeLessThanOrEqual(100);
      expect(expression.complexityBand).toBeDefined();
      expect(expression.difficulty).toBe(expression.complexityBand);
    }
  });

  it("keeps unknown command ratio below threshold", () => {
    let totalCommandCount = 0;
    let unknownCommandCount = 0;

    for (const expression of EXPRESSIONS) {
      if (!expression.complexityFeatures) {
        continue;
      }
      totalCommandCount += expression.complexityFeatures.commandCount;
      unknownCommandCount += expression.complexityFeatures.unknownCommandCount;
    }

    const unknownRatio = totalCommandCount === 0 ? 0 : unknownCommandCount / totalCommandCount;
    expect(unknownRatio).toBeLessThan(0.08);
  });

  it("keeps hard band within broad sanity range", () => {
    const hardCount = EXPRESSIONS.filter((expression) => expression.difficulty === "advanced").length;
    const hardRatio = hardCount / EXPRESSIONS.length;

    expect(hardRatio).toBeGreaterThanOrEqual(0.12);
    expect(hardRatio).toBeLessThanOrEqual(0.30);
  });
});
