<script lang="ts">
  import { computeMinPerFormula, formatElapsedDuration, roundToTwo } from "../services/statsDisplay";
  import type { SessionRecord } from "../types";

  export let history: SessionRecord[] = [];

  interface AggregateStats {
    accuracy: number;
    charsPerMin: number;
    correct: number;
    bestStreak: number;
    attempts: number;
    elapsedMs: number;
  }

  const RECENT_WINDOW = 7;

  function computeAggregateStats(records: SessionRecord[]): AggregateStats {
    if (records.length === 0) {
      return {
        accuracy: 0,
        charsPerMin: 0,
        correct: 0,
        bestStreak: 0,
        attempts: 0,
        elapsedMs: 0
      };
    }

    const totals = records.reduce(
      (accumulator, record) => ({
        correct: accumulator.correct + record.stats.correct,
        inferredChars:
          accumulator.inferredChars + record.stats.charsPerMin * (record.stats.elapsedMs / 60000),
        bestStreak: Math.max(accumulator.bestStreak, record.stats.bestStreak),
        attempts: accumulator.attempts + record.stats.attempts,
        elapsedMs: accumulator.elapsedMs + record.stats.elapsedMs
      }),
      {
        correct: 0,
        inferredChars: 0,
        bestStreak: 0,
        attempts: 0,
        elapsedMs: 0
      }
    );

    return {
      accuracy: totals.attempts > 0 ? roundToTwo((totals.correct / totals.attempts) * 100) : 0,
      charsPerMin: totals.elapsedMs > 0 ? roundToTwo(totals.inferredChars / (totals.elapsedMs / 60000)) : 0,
      correct: totals.correct,
      bestStreak: totals.bestStreak,
      attempts: totals.attempts,
      elapsedMs: totals.elapsedMs
    };
  }

  $: recentWindow = history.slice(0, RECENT_WINDOW);
  $: recentStats = computeAggregateStats(recentWindow);
  $: lifetimeStats = computeAggregateStats(history);
  $: recentAccuracy = recentStats.accuracy;
  $: recentMinPerFormula = computeMinPerFormula(recentStats.correct, recentStats.elapsedMs);
  $: recentCharsPerMin = recentStats.charsPerMin;
  $: lifetimeBestStreak = lifetimeStats.bestStreak;
  $: lifetimeAttempts = lifetimeStats.attempts;
  $: lifetimeCorrect = lifetimeStats.correct;
  $: lifetimeElapsed = formatElapsedDuration(lifetimeStats.elapsedMs);
</script>

<div class="stats-scope-row" aria-label="Statistics scopes">
  <span class="stats-scope-item">Recent performance · last {recentWindow.length || 0}</span>
  <span class="stats-scope-item">{history.length} sessions · Lifetime totals</span>
</div>

<section class="stats-rail">
  <article class="stat-card">
    <h3>Accuracy</h3>
    <p>{recentAccuracy}%</p>
  </article>

  <article class="stat-card">
    <h3>Min/Formula</h3>
    <p>{recentMinPerFormula}</p>
  </article>

  <article class="stat-card">
    <h3>Chars/Min</h3>
    <p>{recentCharsPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>Best Streak</h3>
    <p>{lifetimeBestStreak}</p>
  </article>

  <article class="stat-card">
    <h3>Attempts</h3>
    <p>
      {lifetimeAttempts}
      <span class="attempts-correct">{lifetimeCorrect} correct</span>
    </p>
  </article>

  <article class="stat-card">
    <h3>Elapsed</h3>
    <p>{lifetimeElapsed}</p>
  </article>
</section>
