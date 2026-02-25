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

  type StatsSide = "left" | "right";
  type StatKey = "accuracy" | "minPerFormula" | "charsPerMin" | "streak" | "attempts" | "elapsed";

  const RECENT_WINDOW = 7;
  let hoveredStatKey: StatKey | null = null;
  let hoveredSide: StatsSide | null = null;

  function handleCardHover(statKey: StatKey, side: StatsSide): void {
    if (status !== "running") {
      return;
    }
    hoveredStatKey = statKey;
    hoveredSide = side;
  }

  function clearCardHover(): void {
    hoveredStatKey = null;
    hoveredSide = null;
  }

  function isTotalPreview(
    statKey: StatKey,
    activeHoverKey: StatKey | null,
    sessionStatus: SessionStatus
  ): boolean {
    return sessionStatus !== "running" || activeHoverKey === statKey;
  }

  function isHoveredCard(
    statKey: StatKey,
    activeHoverKey: StatKey | null,
    sessionStatus: SessionStatus
  ): boolean {
    return sessionStatus === "running" && activeHoverKey === statKey;
  }

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
  $: currentAccuracy = stats.accuracy;
  $: currentMinPerFormula = computeMinPerFormula(stats.correct, stats.elapsedMs);
  $: currentCharsPerMin = stats.charsPerMin;
  $: currentStreakText = `${currentStreak} (best ${stats.bestStreak})`;
  $: currentAttempts = stats.attempts;
  $: currentCorrect = stats.correct;
  $: currentElapsed = formatElapsedDuration(stats.elapsedMs);
  $: leftScopeLabel = `Recent performance · last ${recentWindow.length || 0}`;
  $: rightScopeLabel = `${history.length} sessions · Lifetime totals`;
</script>

{#if isCurrentView}
  <div class="stats-scope-row stats-scope-row-running" aria-label="Statistics scopes">
    <span class="stats-scope-item">{hoveredSide === "left" ? leftScopeLabel : ""}</span>
    <span class="stats-scope-item">Current</span>
    <span class="stats-scope-item">{hoveredSide === "right" ? rightScopeLabel : ""}</span>
  </div>
{:else}
  <div class="stats-scope-row" aria-label="Statistics scopes">
    <span class="stats-scope-item">{leftScopeLabel}</span>
    <span class="stats-scope-item">{rightScopeLabel}</span>
  </div>
{/if}

<section
  class="stats-rail"
  role="group"
  aria-label="Session statistics cards"
  on:pointerleave={clearCardHover}
>
  <article
    class={`stat-card ${isHoveredCard("accuracy", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="accuracy"
    on:pointerenter={() => handleCardHover("accuracy", "left")}
  >
    <h3>Accuracy</h3>
    <p>{isTotalPreview("accuracy", hoveredStatKey, status) ? recentAccuracy : currentAccuracy}%</p>
  </article>

  <article
    class={`stat-card ${isHoveredCard("minPerFormula", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="minPerFormula"
    on:pointerenter={() => handleCardHover("minPerFormula", "left")}
  >
    <h3>Min/Formula</h3>
    <p>{isTotalPreview("minPerFormula", hoveredStatKey, status) ? recentMinPerFormula : currentMinPerFormula}</p>
  </article>

  <article
    class={`stat-card ${isHoveredCard("charsPerMin", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="charsPerMin"
    on:pointerenter={() => handleCardHover("charsPerMin", "left")}
  >
    <h3>Chars/Min</h3>
    <p>{isTotalPreview("charsPerMin", hoveredStatKey, status) ? recentCharsPerMin : currentCharsPerMin}</p>
  </article>

  <article
    class={`stat-card ${isHoveredCard("streak", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="streak"
    on:pointerenter={() => handleCardHover("streak", "right")}
  >
    <h3>{isTotalPreview("streak", hoveredStatKey, status) ? "Best Streak" : "Streak"}</h3>
    <p>{isTotalPreview("streak", hoveredStatKey, status) ? lifetimeBestStreak : currentStreakText}</p>
  </article>

  <article
    class={`stat-card ${isHoveredCard("attempts", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="attempts"
    on:pointerenter={() => handleCardHover("attempts", "right")}
  >
    <h3>Attempts</h3>
    <p>
      {isTotalPreview("attempts", hoveredStatKey, status) ? lifetimeAttempts : currentAttempts}
      <span class="attempts-correct">
        {isTotalPreview("attempts", hoveredStatKey, status) ? lifetimeCorrect : currentCorrect} correct
      </span>
    </p>
  </article>

  <article
    class={`stat-card ${isHoveredCard("elapsed", hoveredStatKey, status) ? "stat-card-preview" : ""}`}
    data-stat-key="elapsed"
    on:pointerenter={() => handleCardHover("elapsed", "right")}
  >
    <h3>Elapsed</h3>
    <p>{isTotalPreview("elapsed", hoveredStatKey, status) ? lifetimeElapsed : currentElapsed}</p>
  </article>
</section>
