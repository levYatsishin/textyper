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

  const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: "mixed", label: "Mixed" },
    { value: "beginner", label: "Easy" },
    { value: "intermediate", label: "Medium" },
    { value: "advanced", label: "Hard" }
  ];

  const durationOptions: SessionSettings["durationSec"][] = [60, 120, 300];

  function selectDuration(value: SessionSettings["durationSec"]): void {
    dispatch("modeChange", "timed");
    dispatch("durationChange", value);
  }

  function selectZenMode(): void {
    dispatch("modeChange", "practice");
  }

  function difficultyClass(value: Difficulty): string {
    if (value === "beginner") {
      return "diff-easy";
    }
    if (value === "intermediate") {
      return "diff-medium";
    }
    if (value === "advanced") {
      return "diff-hard";
    }
    return "diff-mixed";
  }
</script>

<section class="control-bar">
  <div class="control-line">
    <div class="text-group" role="radiogroup" aria-label="Duration and Zen">
      {#each durationOptions as value}
        <button
          type="button"
          class="text-option"
          class:active-option={settings.mode === "timed" && settings.durationSec === value}
          on:click={() => selectDuration(value)}
        >
          {value}
        </button>
      {/each}
      <button type="button" class="text-option" class:active-option={settings.mode === "practice"} on:click={selectZenMode}>
        zen
      </button>
    </div>

    <span class="bar-divider" aria-hidden="true">|</span>

    <div class="text-group" role="radiogroup" aria-label="Difficulty">
      {#each difficultyOptions as option}
        <button
          type="button"
          class={`text-option difficulty-option ${difficultyClass(option.value)} ${settings.difficulty === option.value ? "active-option" : ""}`}
          on:click={() => dispatch("difficultyChange", option.value)}
        >
          {option.label.toLowerCase()}
        </button>
      {/each}
    </div>

    <span class="bar-divider" aria-hidden="true">|</span>

    <label class="text-toggle">
      <input type="checkbox" checked={settings.revealLatex} on:change={onRevealChange} />
      <span>show formula</span>
    </label>

    <span class="bar-divider" aria-hidden="true">|</span>

    <div class="text-group actions">
      {#if status === "running"}
        <button type="button" class="text-option" on:click={() => dispatch("end")}>end</button>
      {:else}
        <button type="button" class="text-option active-option" on:click={() => dispatch("start")}>
          {status === "ended" ? "start again" : "start"}
        </button>
      {/if}
      <button type="button" class="text-option active-option" on:click={() => dispatch("restart")}>restart</button>
    </div>
  </div>
</section>
