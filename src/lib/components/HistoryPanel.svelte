<script lang="ts">
  import type { BestScores, SessionRecord } from "../types";

  export let history: SessionRecord[] = [];
  export let bests: BestScores = {};

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
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
      <ul>
        {#each bestEntries as [, record]}
          <li>
            <strong>{record.settings.mode}/{formatDifficulties(record.settings.difficulties)}</strong> · {record.stats.correct} correct · {record.stats.accuracy}% · {record.stats.formulasPerMin} fpm
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
      <ul>
        {#each recent as item}
          <li>
            {formatDate(item.endedAt)} · {item.settings.mode}/{formatDifficulties(item.settings.difficulties)} · {item.stats.correct}/{item.stats.attempts} · {item.stats.accuracy}%
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</section>
