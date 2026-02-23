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
});
