<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { computeMinPerFormula, formatElapsedDuration } from "../services/statsDisplay";
  import type { BestScores, SessionRecord } from "../types";

  export let history: SessionRecord[] = [];
  export let bests: BestScores = {};
  type ConfirmTarget = "bests" | "history" | null;
  let confirmTarget: ConfirmTarget = null;
  const dispatch = createEventDispatcher<{ clearHistory: void; clearBests: void }>();

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours24 = date.getHours();
    const meridiem = hours24 >= 12 ? "pm" : "am";
    const hours = String(hours24 % 12 || 12).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year}, ${hours}:${minutes} ${meridiem}`;
  }

  function formatModeLabel(session: SessionRecord): string {
    return session.settings.mode === "practice"
      ? "zen"
      : `timed · ${session.settings.durationSec}s`;
  }

  function getDisplayDifficulties(session: SessionRecord): SessionRecord["settings"]["difficulties"] {
    if (session.settings.mode !== "practice") {
      return session.settings.difficulties;
    }

    const runDifficulties = (["beginner", "intermediate", "advanced"] as const).filter(
      (difficulty) => session.stats.byDifficulty[difficulty].given > 0
    );

    return runDifficulties.length > 0
      ? (runDifficulties as SessionRecord["settings"]["difficulties"])
      : session.settings.difficulties;
  }

  function getDifficultyParts(
    difficulties: ReadonlyArray<SessionRecord["settings"]["difficulties"][number]>
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

  function getDifficultyBreakdown(
    sessionRecord: SessionRecord
  ): Array<{ key: string; label: string; solved: number; given: number; colorClass: string; progressPct: number }> {
    const order: Array<{ key: keyof SessionRecord["stats"]["byDifficulty"]; label: string }> = [
      { key: "beginner", label: "easy" },
      { key: "intermediate", label: "medium" },
      { key: "advanced", label: "hard" }
    ];
    const colorClassByKey: Record<keyof SessionRecord["stats"]["byDifficulty"], string> = {
      beginner: "difficulty-inline-easy",
      intermediate: "difficulty-inline-medium",
      advanced: "difficulty-inline-hard"
    };

    if (sessionRecord.settings.mode === "timed") {
      return order
        .filter((entry) => sessionRecord.settings.difficulties.includes(entry.key))
        .map((entry) => ({
          ...entry,
          solved: sessionRecord.stats.byDifficulty[entry.key].solved,
          given: sessionRecord.stats.byDifficulty[entry.key].given,
          colorClass: colorClassByKey[entry.key],
          progressPct:
            sessionRecord.stats.byDifficulty[entry.key].given > 0
              ? (sessionRecord.stats.byDifficulty[entry.key].solved / sessionRecord.stats.byDifficulty[entry.key].given) * 100
              : 0
        }));
    }

    return order
      .map((entry) => ({
        ...entry,
        solved: sessionRecord.stats.byDifficulty[entry.key].solved,
        given: sessionRecord.stats.byDifficulty[entry.key].given,
        colorClass: colorClassByKey[entry.key],
        progressPct:
          sessionRecord.stats.byDifficulty[entry.key].given > 0
            ? (sessionRecord.stats.byDifficulty[entry.key].solved / sessionRecord.stats.byDifficulty[entry.key].given) * 100
            : 0
      }))
      .filter((entry) => entry.given > 0);
  }

  $: bestEntries = Object.entries(bests);
  $: recent = history.slice(0, 8);

  function openClearConfirm(target: Exclude<ConfirmTarget, null>): void {
    confirmTarget = target;
  }

  function closeConfirm(): void {
    confirmTarget = null;
  }

  function confirmClear(): void {
    if (confirmTarget === "bests") {
      dispatch("clearBests");
    } else if (confirmTarget === "history") {
      dispatch("clearHistory");
    }
    confirmTarget = null;
  }
</script>

<section class="history-panel">
  <details class="panel-card">
    <summary>Best scores</summary>
    <button
      type="button"
      class="panel-card-delete"
      aria-label="Delete best scores"
      title="Delete best scores"
      disabled={bestEntries.length === 0}
      on:click|stopPropagation={() => openClearConfirm("bests")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6.5 6l1 14h9l1-14" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
    {#if bestEntries.length === 0}
      <p class="muted">No sessions yet.</p>
    {:else}
      <ul class="history-list">
        {#each bestEntries as [, record]}
          <li class="history-item">
            <details class="history-entry">
              <summary class="history-item-toggle">
                <div class="history-item-toggle-text">
                  <div class="history-main">
                    <strong>{formatDate(record.endedAt)}</strong>
                  </div>
                  <div class="history-meta history-meta-preview">
                    mode: {formatModeLabel(record)} · difficulty:
                    <span class="difficulty-inline-group">
                      {#each getDifficultyParts(getDisplayDifficulties(record)) as part, index (part.key)}
                        <span class={`difficulty-inline ${part.colorClass}`}>{part.label}</span>
                        {#if index < getDisplayDifficulties(record).length - 1}
                          <span class="difficulty-inline-separator">|</span>
                        {/if}
                      {/each}
                    </span>
                    {#if record.settings.mode === "practice"}
                      · time spent: {formatElapsedDuration(record.stats.elapsedMs)}
                    {/if}
                  </div>
                </div>
                <span class="history-item-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="history-details">
                <dl class="result-grid history-result-grid">
                  <div class="result-item">
                    <dt>Correct</dt>
                    <dd>{record.stats.correct}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Attempts</dt>
                    <dd>{record.stats.attempts}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Accuracy</dt>
                    <dd>{record.stats.accuracy}%</dd>
                  </div>
                  <div class="result-item">
                    <dt>Best Streak</dt>
                    <dd>{record.stats.bestStreak}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Min/Formula</dt>
                    <dd>{computeMinPerFormula(record.stats.correct, record.stats.elapsedMs)}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Chars/Min</dt>
                    <dd>{record.stats.charsPerMin}</dd>
                  </div>
                </dl>

                {#if getDifficultyBreakdown(record).length > 0}
                  <div class="difficulty-breakdown history-difficulty-breakdown">
                    <p class="difficulty-breakdown-title">By difficulty</p>
                    <ul class="difficulty-breakdown-list">
                      {#each getDifficultyBreakdown(record) as item (item.key)}
                        <li class="difficulty-breakdown-item">
                          <span class={`difficulty-breakdown-label ${item.colorClass}`}>{item.label}</span>
                          <div class="difficulty-progress-track" aria-hidden="true">
                            <span
                              class={`difficulty-progress-fill ${item.colorClass}`}
                              style={`width: ${item.progressPct}%`}
                            ></span>
                          </div>
                          <span class="difficulty-breakdown-value">{item.solved}/{item.given} solved</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </details>
          </li>
        {/each}
      </ul>
    {/if}
  </details>

  <details class="panel-card">
    <summary>Recent sessions</summary>
    <button
      type="button"
      class="panel-card-delete"
      aria-label="Delete recent sessions"
      title="Delete recent sessions"
      disabled={history.length === 0}
      on:click|stopPropagation={() => openClearConfirm("history")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6.5 6l1 14h9l1-14" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
    {#if recent.length === 0}
      <p class="muted">No sessions recorded.</p>
    {:else}
      <ul class="history-list">
        {#each recent as item}
          <li class="history-item">
            <details class="history-entry">
              <summary class="history-item-toggle">
                <div class="history-item-toggle-text">
                  <div class="history-main">
                    <strong>{formatDate(item.endedAt)}</strong>
                  </div>
                  <div class="history-meta history-meta-preview">
                    mode: {formatModeLabel(item)} · difficulty:
                    <span class="difficulty-inline-group">
                      {#each getDifficultyParts(getDisplayDifficulties(item)) as part, index (part.key)}
                        <span class={`difficulty-inline ${part.colorClass}`}>{part.label}</span>
                        {#if index < getDisplayDifficulties(item).length - 1}
                          <span class="difficulty-inline-separator">|</span>
                        {/if}
                      {/each}
                    </span>
                    {#if item.settings.mode === "practice"}
                      · time spent: {formatElapsedDuration(item.stats.elapsedMs)}
                    {/if}
                  </div>
                </div>
                <span class="history-item-chevron" aria-hidden="true">▾</span>
              </summary>
              <div class="history-details">
                <dl class="result-grid history-result-grid">
                  <div class="result-item">
                    <dt>Correct</dt>
                    <dd>{item.stats.correct}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Attempts</dt>
                    <dd>{item.stats.attempts}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Accuracy</dt>
                    <dd>{item.stats.accuracy}%</dd>
                  </div>
                  <div class="result-item">
                    <dt>Best Streak</dt>
                    <dd>{item.stats.bestStreak}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Min/Formula</dt>
                    <dd>{computeMinPerFormula(item.stats.correct, item.stats.elapsedMs)}</dd>
                  </div>
                  <div class="result-item">
                    <dt>Chars/Min</dt>
                    <dd>{item.stats.charsPerMin}</dd>
                  </div>
                </dl>

                {#if getDifficultyBreakdown(item).length > 0}
                  <div class="difficulty-breakdown history-difficulty-breakdown">
                    <p class="difficulty-breakdown-title">By difficulty</p>
                    <ul class="difficulty-breakdown-list">
                      {#each getDifficultyBreakdown(item) as breakdown (breakdown.key)}
                        <li class="difficulty-breakdown-item">
                          <span class={`difficulty-breakdown-label ${breakdown.colorClass}`}>{breakdown.label}</span>
                          <div class="difficulty-progress-track" aria-hidden="true">
                            <span
                              class={`difficulty-progress-fill ${breakdown.colorClass}`}
                              style={`width: ${breakdown.progressPct}%`}
                            ></span>
                          </div>
                          <span class="difficulty-breakdown-value">{breakdown.solved}/{breakdown.given} solved</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </details>
          </li>
        {/each}
      </ul>
    {/if}
  </details>

  {#if confirmTarget}
    <div class="confirm-overlay" role="dialog" aria-modal="true" on:click={closeConfirm}>
      <div class="confirm-card" on:click|stopPropagation>
        <h3 class="confirm-title">
          {confirmTarget === "bests" ? "Delete best scores?" : "Delete recent sessions?"}
        </h3>
        <p class="confirm-text">
          {confirmTarget === "bests"
            ? "This removes all best-score entries from this browser."
            : "This removes all recent session entries from this browser."}
        </p>
        <div class="confirm-actions">
          <button type="button" class="btn subtle" on:click={closeConfirm}>Cancel</button>
          <button type="button" class="btn subtle confirm-delete" on:click={confirmClear}>Delete</button>
        </div>
      </div>
    </div>
  {/if}
</section>
