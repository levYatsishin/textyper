<script lang="ts">
  import type { BestScores, SessionRecord } from "../types";

  export let history: SessionRecord[] = [];
  export let bests: BestScores = {};

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatModeLabel(session: SessionRecord): string {
    return session.settings.mode === "practice"
      ? "zen"
      : `timed · ${session.settings.durationSec}s`;
  }

  function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatDifficulties(difficulties: SessionRecord["settings"]["difficulties"]): string {
    const labels: Record<string, string> = {
      beginner: "easy",
      intermediate: "medium",
      advanced: "hard"
    };
    return difficulties.map((difficulty) => labels[difficulty] ?? difficulty).join("+");
  }

  $: bestEntries = Object.entries(bests);
  $: recent = history.slice(0, 8);
</script>

<section class="history-panel">
  <details class="panel-card">
    <summary>Best scores</summary>
    {#if bestEntries.length === 0}
      <p class="muted">No sessions yet.</p>
    {:else}
      <ul class="history-list">
        {#each bestEntries as [, record]}
          <li class="history-item">
            <div class="history-main">
              <strong>{formatDate(record.endedAt)}</strong>
            </div>
            <div class="history-meta">
              mode: {formatModeLabel(record)} · difficulty: {formatDifficulties(record.settings.difficulties)}
              {#if record.settings.mode === "practice"}
                · time spent: {formatElapsed(record.stats.elapsedMs)}
              {/if}
            </div>
            <div class="history-meta history-meta-stats">
              correct: {record.stats.correct} · attempts: {record.stats.attempts} · accuracy: {record.stats.accuracy}% · formulas/min: {record.stats.formulasPerMin} · chars/min: {record.stats.charsPerMin} · best streak: {record.stats.bestStreak}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </details>

  <details class="panel-card">
    <summary>Recent sessions</summary>
    {#if recent.length === 0}
      <p class="muted">No sessions recorded.</p>
    {:else}
      <ul class="history-list">
        {#each recent as item}
          <li class="history-item">
            <div class="history-main">
              <strong>{formatDate(item.endedAt)}</strong>
            </div>
            <div class="history-meta">
              mode: {formatModeLabel(item)} · difficulty: {formatDifficulties(item.settings.difficulties)}
              {#if item.settings.mode === "practice"}
                · time spent: {formatElapsed(item.stats.elapsedMs)}
              {/if}
            </div>
            <div class="history-meta history-meta-stats">
              correct: {item.stats.correct} · attempts: {item.stats.attempts} · accuracy: {item.stats.accuracy}% · formulas/min: {item.stats.formulasPerMin} · chars/min: {item.stats.charsPerMin} · best streak: {item.stats.bestStreak}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</section>
