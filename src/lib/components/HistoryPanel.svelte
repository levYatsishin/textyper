<script lang="ts">
  import type { BestScores, SessionRecord } from "../types";

  export let history: SessionRecord[] = [];
  export let bests: BestScores = {};

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
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
        {#each bestEntries as [key, record]}
          <li>
            <strong>{key}</strong> · {record.stats.correct} correct · {record.stats.accuracy}% · {record.stats.formulasPerMin} fpm
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
            {formatDate(item.endedAt)} · {item.settings.mode}/{item.settings.difficulty} · {item.stats.correct}/{item.stats.attempts} · {item.stats.accuracy}%
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</section>
