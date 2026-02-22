<script lang="ts">
  import type { Mode, SessionStats, SessionStatus } from "../types";

  export let stats: SessionStats;
  export let currentStreak = 0;
  export let mode: Mode;
  export let remainingMs: number | null = null;
  export let status: SessionStatus;

  $: remainingSeconds = remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
</script>

<section class="stats-rail">
  <article class="stat-card">
    <h3>Accuracy</h3>
    <p>{stats.accuracy}%</p>
  </article>

  <article class="stat-card">
    <h3>Formulas/Min</h3>
    <p>{stats.formulasPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>Chars/Min</h3>
    <p>{stats.charsPerMin}</p>
  </article>

  <article class="stat-card">
    <h3>Streak</h3>
    <p>{currentStreak} (best {stats.bestStreak})</p>
  </article>

  <article class="stat-card">
    <h3>Attempts</h3>
    <p>{stats.attempts}</p>
  </article>

  <article class="stat-card">
    <h3>{mode === "timed" ? "Time Left" : "Elapsed"}</h3>
    <p>
      {#if mode === "timed"}
        {remainingSeconds ?? 0}s
      {:else}
        {Math.floor(stats.elapsedMs / 1000)}s
      {/if}
      {#if status === "ended"}
        · ended
      {/if}
    </p>
  </article>
</section>
