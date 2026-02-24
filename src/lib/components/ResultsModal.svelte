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

  function getDifficultyParts(
    difficulties: SessionRecord["settings"]["difficulties"]
  ): Array<{ key: string; label: string; colorClass: string }> {
    const labels: Record<string, string> = {
      beginner: "easy",
      intermediate: "medium",
      advanced: "hard"
    };
    const colors: Record<string, string> = {
      beginner: "difficulty-inline-easy",
      intermediate: "difficulty-inline-medium",
      advanced: "difficulty-inline-hard"
    };

    return difficulties.map((difficulty) => ({
      key: difficulty,
      label: labels[difficulty] ?? difficulty,
      colorClass: colors[difficulty] ?? ""
    }));
  }

  function getDifficultyBreakdown(sessionRecord: SessionRecord): Array<{ key: string; label: string; solved: number; given: number }> {
    const order: Array<{ key: keyof SessionRecord["stats"]["byDifficulty"]; label: string }> = [
      { key: "beginner", label: "easy" },
      { key: "intermediate", label: "medium" },
      { key: "advanced", label: "hard" }
    ];

    if (sessionRecord.settings.mode === "timed") {
      return order
        .filter((entry) => sessionRecord.settings.difficulties.includes(entry.key))
        .map((entry) => ({
          ...entry,
          solved: sessionRecord.stats.byDifficulty[entry.key].solved,
          given: sessionRecord.stats.byDifficulty[entry.key].given
        }));
    }

    return order
      .map((entry) => ({
        ...entry,
        solved: sessionRecord.stats.byDifficulty[entry.key].solved,
        given: sessionRecord.stats.byDifficulty[entry.key].given
      }))
      .filter((entry) => entry.given > 0);
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
        {:else}
          <span class="session-pill">
            difficulty:
            <span class="difficulty-inline-group">
              {#each getDifficultyParts(session.settings.difficulties) as item, index (item.key)}
                <span class={`difficulty-inline ${item.colorClass}`}>{item.label}</span>
                {#if index < session.settings.difficulties.length - 1}
                  <span class="difficulty-inline-separator">|</span>
                {/if}
              {/each}
            </span>
          </span>
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

      {#if getDifficultyBreakdown(session).length > 0}
        <div class="difficulty-breakdown">
          <p class="difficulty-breakdown-title">By difficulty</p>
          <ul class="difficulty-breakdown-list">
            {#each getDifficultyBreakdown(session) as item (item.key)}
              <li>
                <span class="difficulty-breakdown-label">{item.label}</span>
                <span class="difficulty-breakdown-value">{item.solved}/{item.given} solved</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="modal-actions">
        <button type="button" class="btn subtle" on:click={() => dispatch("close")}>Close</button>
        <button type="button" class="btn strong" on:click={() => dispatch("restart")}>Restart Session</button>
      </div>
    </div>
  </div>
{/if}
