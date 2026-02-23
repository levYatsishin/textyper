import { EXPRESSIONS } from "../../src/lib/data/expressions";

type DifficultyBand = "beginner" | "intermediate" | "advanced";

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index] ?? 0;
}

const scoreValues = EXPRESSIONS.map((expression) => expression.complexityScore).sort((left, right) => left - right);
const counts: Record<DifficultyBand, number> = {
  beginner: 0,
  intermediate: 0,
  advanced: 0
};

for (const expression of EXPRESSIONS) {
  counts[expression.difficulty] += 1;
}

const total = EXPRESSIONS.length;
const hardRatio = total === 0 ? 0 : counts.advanced / total;

console.log("Complexity distribution");
console.log("total:", total);
console.log("counts:", counts);
console.log("ratios:", {
  beginner: total === 0 ? 0 : Number((counts.beginner / total).toFixed(3)),
  intermediate: total === 0 ? 0 : Number((counts.intermediate / total).toFixed(3)),
  advanced: total === 0 ? 0 : Number(hardRatio.toFixed(3))
});
console.log("min/max:", {
  min: scoreValues[0] ?? 0,
  max: scoreValues[scoreValues.length - 1] ?? 0
});
console.log("percentiles:", {
  p10: percentile(scoreValues, 10),
  p50: percentile(scoreValues, 50),
  p90: percentile(scoreValues, 90)
});
