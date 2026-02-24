<script lang="ts">
  import type { Mode, SessionRecord, SessionStats, SessionStatus } from "../types";

  export let stats: SessionStats;
  export let currentStreak = 0;
  export let mode: Mode;
  export let remainingMs: number | null = null;
  export let status: SessionStatus;
  export let history: SessionRecord[] = [];

  type StatsView = "current" | "total";
  interface AggregateStats {
    accuracy: number;
    formulasPerMin: number;
    charsPerMin: number;
    correct: number;
    bestStreak: number;
    attempts: number;
    elapsedMs: number;
  }

  const MEAN_WINDOW = 5;
  let statsView: StatsView = "current";

  function roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  function computeAggregateStats(records: SessionRecord[]): AggregateStats {
    if (records.length === 0) {
      return {
        accuracy: 0,
        formulasPerMin: 0,
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
      formulasPerMin: totals.elapsedMs > 0 ? roundToTwo(totals.correct / (totals.elapsedMs / 60000)) : 0,
      charsPerMin: totals.elapsedMs > 0 ? roundToTwo(totals.inferredChars / (totals.elapsedMs / 60000)) : 0,
      correct: totals.correct,
      bestStreak: totals.bestStreak,
      attempts: totals.attempts,
      elapsedMs: totals.elapsedMs
    };
  }

  function setView(view: StatsView): void {
    if (view === "total" && totalWindow.length === 0) {
      return;
    }
    statsView = view;
  }

  $: remainingSeconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  $: totalWindow = history.slice(0, MEAN_WINDOW);
  $: aggregateStats = computeAggregateStats(totalWindow);
  $: if (totalWindow.length === 0 && statsView === "total") {
    statsView = "current";
  }
  $: isTotalView = statsView === "total" && totalWindow.length > 0;
  $: displayAccuracy = isTotalView ? aggregateStats.accuracy : stats.accuracy;
  $: displayFormulasPerMin = isTotalView ? aggregateStats.formulasPerMin : stats.formulasPerMin;
  $: displayCharsPerMin = isTotalView ? aggregateStats.charsPerMin : stats.charsPerMin;
  $: displayBestStreak = isTotalView ? aggregateStats.bestStreak : stats.bestStreak;
  $: displayAttempts = isTotalView ? aggregateStats.attempts : stats.attempts;
  $: displayCorrect = isTotalView ? aggregateStats.correct : stats.correct;
  $: timeTitle = mode === "timed" && !isTotalView ? "Time Left" : "Elapsed";
  $: timeValue = isTotalView
    ? `${Math.max(0, Math.floor(aggregateStats.elapsedMs / 1000))}s`
    : mode === "timed"
      ? `${remainingSeconds ?? 0}s`
      : `${Math.floor(stats.elapsedMs / 1000)}s`;
</script>

<div class="stats-view-toggle" role="group" aria-label="Statistics view">
  <button
    type="button"
    class="text-option stats-view-option"
    class:active-option={!isTotalView}
    on:click={() => setView("current")}
  >
    current
  </button>
  <span class="bar-divider" aria-hidden="true">|</span>
  <button
    type="button"
    class="text-option stats-view-option"
    class:active-option={isTotalView}
    disabled={totalWindow.length === 0}
    on:click={() => setView("total")}
  >
    total
  </button>
  {#if isTotalView}
    <span class="stats-view-hint">last {totalWindow.length}</span>
  {/if}
</div>

<section class="stats-rail">
  <article class="stat-card">
    <h3>Accuracy</h3>
    <p>{displayAccuracy}%</p>
  </article>

  <article class="stat-card">
    <h3>Formulas/Min</h3>
    <p>{displayFormulasPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>Chars/Min</h3>
    <p>{displayCharsPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>{isTotalView ? "Best Streak" : "Streak"}</h3>
    <p>
      {#if isTotalView}
        {displayBestStreak}
      {:else}
        {currentStreak} (best {displayBestStreak})
      {/if}
    </p>
  </article>

  <article class="stat-card">
    <h3>Attempts</h3>
    <p>
      {displayAttempts}
      <span class="attempts-correct">{displayCorrect} correct</span>
    </p>
  </article>

  <article class="stat-card">
    <h3>{timeTitle}</h3>
    <p>
      {timeValue}
      {#if status === "ended" && !isTotalView}
        · ended
      {/if}
    </p>
  </article>
</section>
