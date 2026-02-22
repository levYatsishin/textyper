<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Difficulty, Mode, SessionSettings, SessionStatus } from "../types";

  export let settings: SessionSettings;
  export let status: SessionStatus;

  const dispatch = createEventDispatcher<{
    modeChange: Mode;
    difficultyChange: Difficulty;
    durationChange: SessionSettings["durationSec"];
    revealToggle: boolean;
    start: void;
    restart: void;
    end: void;
  }>();

  function onRevealChange(event: Event): void {
    dispatch("revealToggle", (event.currentTarget as HTMLInputElement).checked);
  }

  const modeOptions: Array<{ value: Mode; label: string }> = [
    { value: "practice", label: "Practice" },
    { value: "timed", label: "Timed" }
  ];

  const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: "mixed", label: "Mixed" },
    { value: "beginner", label: "Easy" },
    { value: "intermediate", label: "Medium" },
    { value: "advanced", label: "Hard" }
  ];

  const durationOptions: SessionSettings["durationSec"][] = [60, 120, 300];
</script>

<section class="control-bar">
  <div class="control-group">
    <p class="group-label">Mode</p>
    <div class="pill-group" role="radiogroup" aria-label="Mode">
      {#each modeOptions as option}
        <button
          type="button"
          class="chip"
          class:active-chip={settings.mode === option.value}
          on:click={() => dispatch("modeChange", option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <p class="group-label">Difficulty</p>
    <div class="pill-group" role="radiogroup" aria-label="Difficulty">
      {#each difficultyOptions as option}
        <button
          type="button"
          class="chip"
          class:active-chip={settings.difficulty === option.value}
          on:click={() => dispatch("difficultyChange", option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group duration-group" class:hidden={settings.mode !== "timed"}>
    <p class="group-label">Duration</p>
    <div class="pill-group" role="radiogroup" aria-label="Duration">
      {#each durationOptions as value}
        <button
          type="button"
          class="chip"
          class:active-chip={settings.durationSec === value}
          on:click={() => dispatch("durationChange", value)}
          disabled={settings.mode !== "timed"}
        >
          {value}
        </button>
      {/each}
    </div>
  </div>

  <label class="switch-chip">
    <input type="checkbox" checked={settings.revealLatex} on:change={onRevealChange} />
    <span class="switch-dot" aria-hidden="true"></span>
    <span>Show formula behind it</span>
  </label>

  <div class="action-buttons">
    {#if status === "running"}
      <button type="button" class="btn subtle" on:click={() => dispatch("end")}>End</button>
    {:else}
      <button type="button" class="btn strong" on:click={() => dispatch("start")}>
        {status === "ended" ? "Start Again" : "Start"}
      </button>
    {/if}
    <button type="button" class="btn" on:click={() => dispatch("restart")}>Restart</button>
  </div>
</section>
