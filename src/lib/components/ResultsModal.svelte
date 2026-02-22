<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SessionRecord } from "../types";

  export let open = false;
  export let session: SessionRecord | null = null;

  const dispatch = createEventDispatcher<{ restart: void }>();

  function formatDate(value: number): string {
    return new Date(value).toLocaleString();
  }
</script>

{#if open && session}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h2>Session Complete</h2>
      <p class="session-date">{formatDate(session.endedAt)}</p>
      <ul class="result-list">
        <li>Correct: {session.stats.correct}</li>
        <li>Attempts: {session.stats.attempts}</li>
        <li>Accuracy: {session.stats.accuracy}%</li>
        <li>Formulas/Min: {session.stats.formulasPerMin}</li>
        <li>Chars/Min: {session.stats.charsPerMin}</li>
        <li>Best Streak: {session.stats.bestStreak}</li>
      </ul>
      <button type="button" class="btn strong" on:click={() => dispatch("restart")}>Restart Session</button>
    </div>
  </div>
{/if}
