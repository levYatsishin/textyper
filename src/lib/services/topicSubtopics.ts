import type { Expression, TopicId } from "../types";

const FALLBACK_SUBTOPIC = "fundamentals";

function normalizeRawSubtopics(expression: Expression): string[] {
  if (!Array.isArray(expression.subtopics) || expression.subtopics.length === 0) {
    return [FALLBACK_SUBTOPIC];
  }

  const normalized = [...new Set(expression.subtopics.filter((subtopic) => subtopic.trim().length > 0))];
  return normalized.length > 0 ? normalized : [FALLBACK_SUBTOPIC];
}

export function getTopicScopedSubtopics(expression: Expression, _topicId: TopicId): string[] {
  return normalizeRawSubtopics(expression);
}
