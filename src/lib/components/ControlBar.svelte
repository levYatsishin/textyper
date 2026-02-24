<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import type { Difficulty, Mode, SessionSettings, SessionStatus, TopicDefinition, TopicId } from "../types";

  export let settings: SessionSettings;
  export let status: SessionStatus = "running";
  export let topics: TopicDefinition[] = [];
  export let topicCounts: Record<TopicId, number> = {};
  export let topicSubtopicStats: Record<TopicId, Array<{ label: string; count: number }>> = {};

  const dispatch = createEventDispatcher<{
    modeChange: Mode;
    difficultyToggle: Difficulty;
    durationChange: SessionSettings["durationSec"];
    revealToggle: boolean;
    start: void;
    restart: void;
    end: void;
    topicToggle: TopicId;
    subtopicToggle: { topicId: TopicId; subtopic: string };
    topicSelectAll: void;
  }>();
  let topicsButtonElement: HTMLButtonElement | null = null;
  let topicsMenuElement: HTMLDivElement | null = null;
  let topicsMenuOpen = false;
  let topicSearch = "";
  let expandedTopicIds: TopicId[] = [];

  function toggleReveal(): void {
    dispatch("revealToggle", !settings.revealLatex);
  }

  function handleStart(): void {
    dispatch("start");
  }

  function handleRestart(): void {
    dispatch("restart");
  }

  function handleEnd(): void {
    dispatch("end");
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
      expandedTopicIds = [];
    }
  }

  function closeTopicsMenu(): void {
    topicsMenuOpen = false;
    topicSearch = "";
    expandedTopicIds = [];
  }

  function handleTopicToggle(topicId: TopicId): void {
    dispatch("topicToggle", topicId);
  }

  function handleSubtopicToggle(topicId: TopicId, subtopic: string): void {
    dispatch("subtopicToggle", { topicId, subtopic });
  }

  function isSubtopicSelected(topicId: TopicId, subtopic: string): boolean {
    return (settings.selectedSubtopicsByTopic[topicId] ?? []).includes(subtopic);
  }

  function toggleTopicExpanded(topicId: TopicId): void {
    if (expandedTopicIds.includes(topicId)) {
      expandedTopicIds = expandedTopicIds.filter((value) => value !== topicId);
      return;
    }
    expandedTopicIds = [...expandedTopicIds, topicId];
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

  function topicMatchesSearch(topic: TopicDefinition, query: string): boolean {
    if (!query) {
      return true;
    }
    return topic.label.toLowerCase().includes(query) || topic.id.includes(query);
  }

  function getVisibleSubtopics(topic: TopicDefinition, query: string): Array<{ label: string; count: number }> {
    const subtopics = topicSubtopicStats[topic.id] ?? [];
    if (!query || topicMatchesSearch(topic, query)) {
      return subtopics;
    }
    return subtopics.filter((item) => item.label.toLowerCase().includes(query));
  }

  function hasSubtopicSearchHit(topic: TopicDefinition, query: string): boolean {
    if (!query || topicMatchesSearch(topic, query)) {
      return false;
    }
    return getVisibleSubtopics(topic, query).length > 0;
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
  $: activeDifficultyOptions = difficultyOptions.filter((option) => settings.difficulties.includes(option.value));
  $: visibleTopics = topics.filter((topic) => {
    if (!normalizedTopicSearch) {
      return true;
    }
    if (topicMatchesSearch(topic, normalizedTopicSearch)) {
      return true;
    }
    return getVisibleSubtopics(topic, normalizedTopicSearch).length > 0;
  });
  $: autoExpandedTopicIds = normalizedTopicSearch
    ? visibleTopics
      .filter((topic) => hasSubtopicSearchHit(topic, normalizedTopicSearch))
      .map((topic) => topic.id)
    : [];
  $: openTopicIdSet = new Set([...expandedTopicIds, ...autoExpandedTopicIds]);
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

    <div class="text-group" role="group" aria-label="Session controls">
      {#if status === "running"}
        <button type="button" class="text-option" on:click={handleEnd}>end</button>
      {:else}
        <button type="button" class="text-option active-option" on:click={handleStart}>start</button>
      {/if}
      <button type="button" class="text-option active-option" on:click={handleRestart}>restart</button>
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
            <div class="topics-active-difficulties" aria-hidden="true">
              {#each activeDifficultyOptions as option, index}
                <span class={`topics-difficulty ${difficultyClass(option.value)}`}>{option.label.toLowerCase()}</span>
                {#if index < activeDifficultyOptions.length - 1}
                  <span class="topics-diff-divider">|</span>
                {/if}
              {/each}
            </div>

            <div class="topics-search-row">
              <input class="topics-search" type="text" bind:value={topicSearch} placeholder="search topics..." />
              <button
                type="button"
                class="text-option"
                on:click={() => dispatch("topicSelectAll")}
              >
                all
              </button>
            </div>
          </div>

          <div class="topics-menu-list">
            {#if visibleTopics.length === 0}
              <p class="topics-empty">no topics</p>
            {:else}
              {#each visibleTopics as topic (topic.id)}
                <div class="topic-item">
                  <div class="topic-row-line">
                    <button
                      type="button"
                      class="topic-expand text-option"
                      aria-label={openTopicIdSet.has(topic.id) ? `Collapse ${topic.label}` : `Expand ${topic.label}`}
                      aria-expanded={openTopicIdSet.has(topic.id)}
                      on:click={() => toggleTopicExpanded(topic.id)}
                    >
                      {openTopicIdSet.has(topic.id) ? "▾" : "▸"}
                    </button>

                    <button
                      type="button"
                      class="topic-row text-option"
                      class:active-option={settings.selectedTopicIds.includes(topic.id)}
                      on:click={() => handleTopicToggle(topic.id)}
                      aria-disabled={isLastSelectedTopic(topic.id)}
                      aria-pressed={settings.selectedTopicIds.includes(topic.id)}
                    >
                      <span>{topic.label}</span>
                      <span class="topic-count">{topicCounts[topic.id] ?? 0}</span>
                    </button>
                  </div>

                  {#if openTopicIdSet.has(topic.id) && getVisibleSubtopics(topic, normalizedTopicSearch).length > 0}
                    <div class="topic-sublist" role="group" aria-label={`${topic.label} subtopics`}>
                      {#each getVisibleSubtopics(topic, normalizedTopicSearch) as subtopic (subtopic.label)}
                        <button
                          type="button"
                          class="subtopic-row text-option"
                          class:active-option={isSubtopicSelected(topic.id, subtopic.label)}
                          on:click={() => handleSubtopicToggle(topic.id, subtopic.label)}
                          aria-pressed={isSubtopicSelected(topic.id, subtopic.label)}
                        >
                          <span>{subtopic.label}</span>
                          <span class="topic-count">{subtopic.count}</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
