<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Difficulty, Mode, SessionSettings, SessionStatus } from "../types";

  export let settings: SessionSettings;
  export let status: SessionStatus;

  const dispatch = createEventDispatcher<{
    modeChange: Mode;
    difficultyToggle: Difficulty;
    durationChange: SessionSettings["durationSec"];
    revealToggle: boolean;
    start: void;
    restart: void;
    end: void;
  }>();

  function toggleReveal(): void {
    dispatch("revealToggle", !settings.revealLatex);
  }

  const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: "beginner", label: "Easy" },
    { value: "intermediate", label: "Medium" },
    { value: "advanced", label: "Hard" }
  ];

  const durationOptions: SessionSettings["durationSec"][] = [60, 120];

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
    return "";
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

    <div class="text-group" role="group" aria-label="Difficulties">
      {#each difficultyOptions as option}
        <button
          type="button"
          class={`text-option difficulty-option ${difficultyClass(option.value)} ${settings.difficulties.includes(option.value) ? "active-option" : ""}`}
          aria-pressed={settings.difficulties.includes(option.value)}
          on:click={() => dispatch("difficultyToggle", option.value)}
        >
          {option.label.toLowerCase()}
        </button>
      {/each}
    </div>

    <span class="bar-divider" aria-hidden="true">|</span>

    <button type="button" class="text-option text-toggle" class:active-toggle={settings.revealLatex} on:click={toggleReveal}>
      show formula
    </button>

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
