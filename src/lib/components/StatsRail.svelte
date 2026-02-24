<script lang="ts">
  import { computeMinPerFormula, formatElapsedDuration, roundToTwo } from "../services/statsDisplay";
  import type { SessionRecord, SessionStats, SessionStatus } from "../types";

  export let history: SessionRecord[] = [];
  export let stats: SessionStats = {
    startedAt: 0,
    elapsedMs: 0,
    attempts: 0,
    correct: 0,
    accuracy: 0,
    formulasPerMin: 0,
    charsPerMin: 0,
    bestStreak: 0,
    byDifficulty: {
      beginner: { given: 0, solved: 0 },
      intermediate: { given: 0, solved: 0 },
      advanced: { given: 0, solved: 0 }
    }
  };
  export let currentStreak = 0;
  export let status: SessionStatus = "idle";

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
  $: isCurrentView = status === "running";
  $: displayAccuracy = isCurrentView ? stats.accuracy : recentAccuracy;
  $: displayMinPerFormula = isCurrentView
    ? computeMinPerFormula(stats.correct, stats.elapsedMs)
    : recentMinPerFormula;
  $: displayCharsPerMin = isCurrentView ? stats.charsPerMin : recentCharsPerMin;
  $: displayStreakText = isCurrentView ? `${currentStreak} (best ${stats.bestStreak})` : `${lifetimeBestStreak}`;
  $: displayAttempts = isCurrentView ? stats.attempts : lifetimeAttempts;
  $: displayCorrect = isCurrentView ? stats.correct : lifetimeCorrect;
  $: displayElapsed = isCurrentView ? formatElapsedDuration(stats.elapsedMs) : lifetimeElapsed;
</script>

{#if isCurrentView}
  <div class="stats-scope-row stats-scope-row-current" aria-label="Statistics scopes">
    <span class="stats-scope-item">Current</span>
  </div>
{:else}
  <div class="stats-scope-row" aria-label="Statistics scopes">
    <span class="stats-scope-item">Recent performance · last {recentWindow.length || 0}</span>
    <span class="stats-scope-item">{history.length} sessions · Lifetime totals</span>
  </div>
{/if}

<section class="stats-rail">
  <article class="stat-card">
    <h3>Accuracy</h3>
    <p>{displayAccuracy}%</p>
  </article>

  <article class="stat-card">
    <h3>Min/Formula</h3>
    <p>{displayMinPerFormula}</p>
  </article>

  <article class="stat-card">
    <h3>Chars/Min</h3>
    <p>{displayCharsPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>{isCurrentView ? "Streak" : "Best Streak"}</h3>
    <p>{displayStreakText}</p>
  </article>

  <article class="stat-card">
    <h3>Attempts</h3>
    <p>
      {displayAttempts}
      <span class="attempts-correct">{displayCorrect} correct</span>
    </p>
  </article>

  <article class="stat-card">
    <h3>Elapsed</h3>
    <p>{displayElapsed}</p>
  </article>
</section>
