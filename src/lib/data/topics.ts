import type { TopicDefinition, TopicId } from "../types";

export const TOPICS: TopicDefinition[] = [
  { id: "algebra", label: "algebra", order: 1 },
  { id: "geometry", label: "geometry", order: 2 },
  { id: "trigonometry", label: "trigonometry", order: 3 },
  { id: "calculus", label: "calculus", order: 4 },
  { id: "linear-algebra", label: "linear algebra", order: 5 },
  { id: "differential-equations", label: "differential equations", order: 6 },
  { id: "probability", label: "probability", order: 7 },
  { id: "statistics", label: "statistics", order: 8 },
  { id: "number-theory", label: "number theory", order: 9 },
  { id: "set-logic", label: "set logic", order: 10 },
  { id: "complex-analysis", label: "complex analysis", order: 11 },
  { id: "vector-calculus", label: "vector calculus", order: 12 },
  { id: "mathematical-physics", label: "mathematical physics", order: 13 },
  { id: "special-functions", label: "special functions", order: 14 },
  { id: "optimization", label: "optimization", order: 15 }
];

export const TOPIC_MAP: Record<TopicId, TopicDefinition> = TOPICS.reduce<Record<TopicId, TopicDefinition>>(
  (accumulator, topic) => {
    accumulator[topic.id] = topic;
    return accumulator;
  },
  {}
);

export const ALL_TOPIC_IDS: TopicId[] = TOPICS.map((topic) => topic.id);
