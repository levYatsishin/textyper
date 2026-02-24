<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SessionRecord } from "../types";

  export let open = false;
  export let session: SessionRecord | null = null;

  const dispatch = createEventDispatcher<{ restart: void; close: void }>();

  function formatDate(value: number): string {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  function formatModeLabel(sessionRecord: SessionRecord): string {
    return sessionRecord.settings.mode === "practice"
      ? "zen"
      : `timed · ${sessionRecord.settings.durationSec}s`;
  }
</script>

{#if open && session}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h2>Session Complete</h2>
      <p class="session-date">{formatDate(session.endedAt)}</p>

      <div class="session-pills">
        <span class="session-pill">mode: {formatModeLabel(session)}</span>
        {#if session.settings.mode === "practice"}
          <span class="session-pill">time spent: {formatElapsed(session.stats.elapsedMs)}</span>
        {/if}
      </div>

      <dl class="result-grid">
        <div class="result-item">
          <dt>Correct</dt>
          <dd>{session.stats.correct}</dd>
        </div>
        <div class="result-item">
          <dt>Attempts</dt>
          <dd>{session.stats.attempts}</dd>
        </div>
        <div class="result-item">
          <dt>Accuracy</dt>
          <dd>{session.stats.accuracy}%</dd>
        </div>
        <div class="result-item">
          <dt>Best Streak</dt>
          <dd>{session.stats.bestStreak}</dd>
        </div>
        <div class="result-item">
          <dt>Formulas/Min</dt>
          <dd>{session.stats.formulasPerMin}</dd>
        </div>
        <div class="result-item">
          <dt>Chars/Min</dt>
          <dd>{session.stats.charsPerMin}</dd>
        </div>
      </dl>

      <div class="modal-actions">
        <button type="button" class="btn subtle" on:click={() => dispatch("close")}>Close</button>
        <button type="button" class="btn strong" on:click={() => dispatch("restart")}>Restart Session</button>
      </div>
    </div>
  </div>
{/if}
