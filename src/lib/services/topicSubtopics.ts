import type { Expression, TopicId } from "../types";

const FALLBACK_SUBTOPIC = "fundamentals";
const REAL_ANALYSIS_TOPIC_ID = "real-analysis";
const REAL_ANALYSIS_SUBTOPICS = [
  "measure integration",
  "convergence modes",
  "functional sequences",
  "integrals",
  "derivatives",
  "limits",
  "series",
  FALLBACK_SUBTOPIC
] as const;

function normalizeRawSubtopics(expression: Expression): string[] {
  if (!Array.isArray(expression.subtopics) || expression.subtopics.length === 0) {
    return [FALLBACK_SUBTOPIC];
  }
  return [...new Set(expression.subtopics.filter((subtopic) => subtopic.trim().length > 0))];
}

function resolveRealAnalysisSubtopics(expression: Expression): string[] {
  const rawSubtopics = normalizeRawSubtopics(expression);
  const canonicalSet = new Set<string>(REAL_ANALYSIS_SUBTOPICS);
  const canonicalMatches = rawSubtopics.filter((subtopic) => canonicalSet.has(subtopic));
  if (canonicalMatches.length > 0) {
    return canonicalMatches;
  }

  const searchable = `${expression.name} ${expression.latex} ${rawSubtopics.join(" ")}`.toLowerCase();
  const inferred = new Set<string>();

  if (
    searchable.includes("measure") ||
    searchable.includes("lebesgue") ||
    searchable.includes("d\\mu") ||
    searchable.includes("\\mu")
  ) {
    inferred.add("measure integration");
  }

  if (
    searchable.includes("converg") ||
    searchable.includes("limsup") ||
    searchable.includes("liminf") ||
    searchable.includes("dominated") ||
    searchable.includes("fatou") ||
    searchable.includes("cauchy")
  ) {
    inferred.add("convergence modes");
  }

  if (searchable.includes("f_n") || searchable.includes("function sequence") || searchable.includes("pointwise")) {
    inferred.add("functional sequences");
  }

  if (searchable.includes("\\sum") || searchable.includes("series")) {
    inferred.add("series");
  }

  if (searchable.includes("\\int") || searchable.includes("integral")) {
    inferred.add("integrals");
  }

  if (searchable.includes("\\frac{d}{dx}") || searchable.includes("\\partial") || searchable.includes("derivative")) {
    inferred.add("derivatives");
  }

  if (searchable.includes("\\lim") || searchable.includes("limit")) {
    inferred.add("limits");
  }

  if (inferred.size === 0) {
    inferred.add(FALLBACK_SUBTOPIC);
  }

  return [...inferred];
}

export function getTopicScopedSubtopics(expression: Expression, topicId: TopicId): string[] {
  if (topicId === REAL_ANALYSIS_TOPIC_ID) {
    return resolveRealAnalysisSubtopics(expression);
  }
  return normalizeRawSubtopics(expression);
}
