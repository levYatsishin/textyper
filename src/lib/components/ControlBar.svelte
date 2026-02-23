<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import type { Difficulty, Mode, SessionSettings, SessionStatus, TopicDefinition, TopicId } from "../types";

  export let settings: SessionSettings;
  export let status: SessionStatus;
  export let topics: TopicDefinition[] = [];
  export let topicCounts: Record<TopicId, number> = {};

  const dispatch = createEventDispatcher<{
    modeChange: Mode;
    difficultyToggle: Difficulty;
    durationChange: SessionSettings["durationSec"];
    revealToggle: boolean;
    topicToggle: TopicId;
    topicSelectAll: void;
    start: void;
    restart: void;
    end: void;
  }>();
  let topicsButtonElement: HTMLButtonElement | null = null;
  let topicsMenuElement: HTMLDivElement | null = null;
  let topicsMenuOpen = false;
  let topicSearch = "";

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

  function toggleTopicsMenu(): void {
    topicsMenuOpen = !topicsMenuOpen;
    if (!topicsMenuOpen) {
      topicSearch = "";
    }
  }

  function closeTopicsMenu(): void {
    topicsMenuOpen = false;
    topicSearch = "";
  }

  function handleTopicToggle(topicId: TopicId): void {
    dispatch("topicToggle", topicId);
  }

  function handleDocumentMouseDown(event: MouseEvent): void {
    if (!topicsMenuOpen) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    const clickedToggle = !!topicsButtonElement?.contains(target);
    const clickedMenu = !!topicsMenuElement?.contains(target);
    if (!clickedToggle && !clickedMenu) {
      closeTopicsMenu();
    }
  }

  function handleWindowKeyDown(event: KeyboardEvent): void {
    if (topicsMenuOpen && event.key === "Escape") {
      closeTopicsMenu();
    }
  }

  function isLastSelectedTopic(topicId: TopicId): boolean {
    return settings.selectedTopicIds.length === 1 && settings.selectedTopicIds.includes(topicId);
  }

  onMount(() => {
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
  });

  onDestroy(() => {
    document.removeEventListener("mousedown", handleDocumentMouseDown);
    window.removeEventListener("keydown", handleWindowKeyDown);
  });

  $: normalizedTopicSearch = topicSearch.trim().toLowerCase();
  $: visibleTopics = topics.filter((topic) => {
    if (!normalizedTopicSearch) {
      return true;
    }
    return topic.label.toLowerCase().includes(normalizedTopicSearch) || topic.id.includes(normalizedTopicSearch);
  });
  $: allTopicsSelected = settings.selectedTopicIds.length === topics.length;
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

    <span class="bar-divider" aria-hidden="true">|</span>

    <div class="topics-anchor">
      <button
        type="button"
        class="text-option"
        class:active-option={topicsMenuOpen}
        bind:this={topicsButtonElement}
        on:click={toggleTopicsMenu}
      >
        topics
      </button>

      {#if topicsMenuOpen}
        <div class="topics-menu" bind:this={topicsMenuElement}>
          <div class="topics-menu-header">
            <input class="topics-search" type="text" bind:value={topicSearch} placeholder="search topics..." />
            <button
              type="button"
              class="text-option"
              on:click={() => dispatch("topicSelectAll")}
              disabled={allTopicsSelected}
            >
              all
            </button>
          </div>

          <div class="topics-menu-list">
            {#if visibleTopics.length === 0}
              <p class="topics-empty">no topics</p>
            {:else}
              {#each visibleTopics as topic}
                <button
                  type="button"
                  class={`topic-row text-option ${settings.selectedTopicIds.includes(topic.id) ? "active-option" : ""}`}
                  on:click={() => handleTopicToggle(topic.id)}
                  disabled={isLastSelectedTopic(topic.id)}
                >
                  <span>{topic.label}</span>
                  <span class="topic-count">{topicCounts[topic.id] ?? 0}</span>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
