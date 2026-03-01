<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { get } from "svelte/store";
  import ControlBar from "./lib/components/ControlBar.svelte";
  import {
    DEFAULT_EXPANSION_SETTINGS,
    DEFAULT_EXPANSION_VARIABLES_SOURCE,
    DEFAULT_OBSIDIAN_SNIPPETS_SOURCE
  } from "./lib/data/expansionsDefaults";
  import FormulaStage from "./lib/components/FormulaStage.svelte";
  import HistoryPanel from "./lib/components/HistoryPanel.svelte";
  import InputLane from "./lib/components/InputLane.svelte";
  import ResultsModal from "./lib/components/ResultsModal.svelte";
  import StatsRail from "./lib/components/StatsRail.svelte";
  import { EXPRESSIONS } from "./lib/data/expressions";
  import { parseObsidianSnippetSource } from "./lib/services/expansions/parserObsidian";
  import { parseSnippetVariablesSource } from "./lib/services/expansions/variables";
  import {
    loadExpansionSettings,
    loadExpansionSnippetSource,
    loadExpansionVariablesSource,
    saveExpansionSettings,
    saveExpansionSnippetSource,
    saveExpansionVariablesSource
  } from "./lib/services/persistence";
  import { TOPICS } from "./lib/data/topics";
  import { getTopicScopedSubtopics } from "./lib/services/topicSubtopics";
  import { createGameStore, POOL_RESTART_LOCK_MS } from "./lib/stores/gameStore";
  import type {
    CompiledSnippet,
    Difficulty,
    ExpansionSettings,
    Mode,
    SessionSettings,
    SnippetParseIssue,
    SnippetVariables,
    TopicId
  } from "./lib/types";

  interface TopicSubtopicStat {
    label: string;
    count: number;
  }

  interface SubtopicTogglePayload {
    topicId: TopicId;
    subtopic: string;
  }

  type BooleanHelperKey =
    | "autofractionEnabled"
    | "taboutEnabled"
    | "matrixShortcutsEnabled"
    | "autoBracketPairingEnabled"
    | "autoEnlargeBracketsEnabled";
  type ExpansionCompileState = "idle" | "loading" | "ready";

  type TopicSubtopicStats = Record<TopicId, TopicSubtopicStat[]>;
  type ThemeMode = "dark" | "light";
  const THEME_STORAGE_KEY = "mathTyper.theme.v1";

  function cloneExpansionSettings(settings: ExpansionSettings): ExpansionSettings {
    return {
      ...settings,
      helpers: {
        ...settings.helpers,
        matrixShortcutEnvironments: [...settings.helpers.matrixShortcutEnvironments],
        taboutClosingSymbols: [...settings.helpers.taboutClosingSymbols],
        autoEnlargeTriggers: [...settings.helpers.autoEnlargeTriggers]
      }
    };
  }

  function getAllSubtopicsByTopic(): Record<TopicId, string[]> {
    const byTopic = TOPICS.reduce<Record<TopicId, Set<string>>>((accumulator, topic) => {
      accumulator[topic.id] = new Set<string>();
      return accumulator;
    }, {} as Record<TopicId, Set<string>>);

    for (const expression of EXPRESSIONS) {
      for (const topicId of expression.topics) {
        const set = byTopic[topicId];
        if (!set) {
          continue;
        }
        for (const subtopic of getTopicScopedSubtopics(expression, topicId)) {
          set.add(subtopic);
        }
      }
    }

    return TOPICS.reduce<Record<TopicId, string[]>>((accumulator, topic) => {
      accumulator[topic.id] = [...byTopic[topic.id]].sort((left, right) => left.localeCompare(right));
      return accumulator;
    }, {} as Record<TopicId, string[]>);
  }

  const game = createGameStore(EXPRESSIONS);
  const allSubtopicsByTopic = getAllSubtopicsByTopic();
  let themeMode: ThemeMode = "dark";
  let poolRestartFlashVisible = false;
  let poolRestartFlashTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPoolRestartedAt: number | null = null;
  let poolRestartFallbackLatex = "";
  let inputFocusNonce = 0;
  let expansionMenuOpen = false;
  let expansionButtonElement: HTMLButtonElement | null = null;
  let expansionMenuElement: HTMLDivElement | null = null;
  let expansionSettings = cloneExpansionSettings(DEFAULT_EXPANSION_SETTINGS);
  let expansionSnippetsSource = DEFAULT_OBSIDIAN_SNIPPETS_SOURCE;
  let expansionVariablesSource = DEFAULT_EXPANSION_VARIABLES_SOURCE;
  let expansionCompiledSnippets: CompiledSnippet[] = [];
  let expansionVariables: SnippetVariables = {};
  let expansionParseIssues: SnippetParseIssue[] = [];
  let expansionCompileState: ExpansionCompileState = "idle";
  let expansionCompilePromise: Promise<void> | null = null;
  let expansionCompileDebounce: ReturnType<typeof setTimeout> | null = null;

  function isThemeMode(value: unknown): value is ThemeMode {
    return value === "dark" || value === "light";
  }

  function applyTheme(mode: ThemeMode): void {
    document.documentElement.setAttribute("data-theme", mode);
  }

  function loadThemePreference(): ThemeMode {
    if (typeof window === "undefined") {
      return "dark";
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "dark";
  }

  function toggleTheme(): void {
    themeMode = themeMode === "dark" ? "light" : "dark";
    applyTheme(themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }

  function compileExpansionsSync(): void {
    const variablesResult = parseSnippetVariablesSource(expansionVariablesSource);
    expansionVariables = variablesResult.variables;
    const snippetsResult = parseObsidianSnippetSource(expansionSnippetsSource, expansionVariables);
    expansionCompiledSnippets = snippetsResult.snippets;
    expansionParseIssues = [...variablesResult.issues, ...snippetsResult.issues];
  }

  function shouldCompileExpansions(): boolean {
    return expansionSettings.enabled && expansionSnippetsSource.trim().length > 0;
  }

  async function ensureExpansionsCompiled(force = false): Promise<void> {
    if (!shouldCompileExpansions()) {
      expansionCompiledSnippets = [];
      expansionVariables = {};
      expansionParseIssues = [];
      expansionCompileState = "idle";
      return;
    }

    if (!force && expansionCompileState === "ready") {
      return;
    }
    if (expansionCompilePromise) {
      await expansionCompilePromise;
      return;
    }

    expansionCompileState = "loading";
    expansionCompilePromise = new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        compileExpansionsSync();
        expansionCompileState = "ready";
        expansionCompilePromise = null;
        resolve();
      });
    });

    await expansionCompilePromise;
  }

  function debounceExpansionCompile(delayMs = 180): void {
    if (expansionCompileDebounce !== null) {
      clearTimeout(expansionCompileDebounce);
    }
    expansionCompileState = "idle";
    expansionCompileDebounce = setTimeout(() => {
      expansionCompileDebounce = null;
      void ensureExpansionsCompiled(true);
    }, delayMs);
  }

  function closeExpansionMenu(): void {
    expansionMenuOpen = false;
  }

  function toggleExpansionMenu(): void {
    expansionMenuOpen = !expansionMenuOpen;
    if (expansionMenuOpen) {
      void ensureExpansionsCompiled();
    }
  }

  function updateExpansionSettings(next: ExpansionSettings): void {
    expansionSettings = cloneExpansionSettings(next);
    saveExpansionSettings(expansionSettings);
  }

  function handleExpansionEnabledToggle(): void {
    const nextEnabled = !expansionSettings.enabled;
    updateExpansionSettings({
      ...expansionSettings,
      enabled: nextEnabled
    });
    if (nextEnabled) {
      void ensureExpansionsCompiled();
      return;
    }
    expansionCompileState = "idle";
    expansionCompiledSnippets = [];
    expansionVariables = {};
    expansionParseIssues = [];
  }

  function handleExpansionHelperToggle(key: BooleanHelperKey, value: boolean): void {
    updateExpansionSettings({
      ...expansionSettings,
      helpers: {
        ...expansionSettings.helpers,
        [key]: value
      }
    });
  }

  function handleExpansionInput(event: Event): void {
    expansionSnippetsSource = (event.currentTarget as HTMLTextAreaElement).value;
    saveExpansionSnippetSource(expansionSnippetsSource);
    debounceExpansionCompile();
  }

  function handleVariablesInput(event: Event): void {
    expansionVariablesSource = (event.currentTarget as HTMLTextAreaElement).value;
    saveExpansionVariablesSource(expansionVariablesSource);
    debounceExpansionCompile();
  }

  function resetExpansionDefaults(): void {
    expansionSettings = cloneExpansionSettings(DEFAULT_EXPANSION_SETTINGS);
    expansionSnippetsSource = DEFAULT_OBSIDIAN_SNIPPETS_SOURCE;
    expansionVariablesSource = DEFAULT_EXPANSION_VARIABLES_SOURCE;
    saveExpansionSettings(expansionSettings);
    saveExpansionSnippetSource(expansionSnippetsSource);
    saveExpansionVariablesSource(expansionVariablesSource);
    void ensureExpansionsCompiled(true);
  }

  function handleDocumentMouseDown(event: MouseEvent): void {
    if (!expansionMenuOpen) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    const inToggle = !!expansionButtonElement?.contains(target);
    const inPanel = !!expansionMenuElement?.contains(target);
    if (!inToggle && !inPanel) {
      closeExpansionMenu();
    }
  }

  function handleWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && expansionMenuOpen) {
      closeExpansionMenu();
    }
  }

  onMount(() => {
    themeMode = loadThemePreference();
    applyTheme(themeMode);
    expansionSettings = cloneExpansionSettings(loadExpansionSettings());
    expansionSnippetsSource = loadExpansionSnippetSource();
    expansionVariablesSource = loadExpansionVariablesSource();
    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    game.loadHistory();
    return;
  });

  onDestroy(() => {
    document.removeEventListener("mousedown", handleDocumentMouseDown);
    window.removeEventListener("keydown", handleWindowKeyDown);
    if (poolRestartFlashTimer !== null) {
      clearTimeout(poolRestartFlashTimer);
      poolRestartFlashTimer = null;
    }
    if (expansionCompileDebounce !== null) {
      clearTimeout(expansionCompileDebounce);
      expansionCompileDebounce = null;
    }
  });

  function handleModeChange(mode: Mode): void {
    game.updateSettings({ mode });
  }

  function handleDifficultyToggle(difficulty: Difficulty): void {
    const currentSettings = get(game).settings;
    const selected = new Set(currentSettings.difficulties);
    if (selected.has(difficulty)) {
      if (selected.size === 1) {
        return;
      }
      selected.delete(difficulty);
    } else {
      selected.add(difficulty);
    }

    const nextDifficulties: SessionSettings["difficulties"] = ["beginner", "intermediate", "advanced"].filter(
      (item) => selected.has(item)
    ) as SessionSettings["difficulties"];

    const projectedSettings: SessionSettings = {
      ...currentSettings,
      difficulties: nextDifficulties,
      selectedSubtopicsByTopic: normalizeSubtopicMap(
        currentSettings.selectedTopicIds,
        currentSettings.selectedSubtopicsByTopic
      )
    };

    if (getPoolSize(projectedSettings) === 0) {
      return;
    }

    game.updateSettings({
      difficulties: nextDifficulties,
      selectedSubtopicsByTopic: projectedSettings.selectedSubtopicsByTopic
    });
  }

  function handleDurationChange(durationSec: SessionSettings["durationSec"]): void {
    game.updateSettings({ durationSec });
  }

  function handleStart(): void {
    game.start();
    void ensureExpansionsCompiled();
  }

  function handleRestart(): void {
    game.reset();
  }

  function handleEnd(): void {
    game.end();
  }

  function handleCloseResults(): void {
    game.dismissResults();
  }

  function handleClearHistory(): void {
    game.clearHistory();
  }

  function handleDeleteSession(event: CustomEvent<{ id: string }>): void {
    game.deleteHistoryRecord(event.detail.id);
  }

  function handleRevealToggle(isEnabled: boolean): void {
    game.toggleReveal(isEnabled);
  }

  function getPoolSize(settings: SessionSettings): number {
    const selectedTopics = new Set(settings.selectedTopicIds);
    return EXPRESSIONS.filter(
      (item) =>
        settings.difficulties.includes(item.difficulty) &&
        item.topics.some((topicId) => {
          if (!selectedTopics.has(topicId)) {
            return false;
          }
          const selectedSubtopics = settings.selectedSubtopicsByTopic[topicId] ?? [];
          if (selectedSubtopics.length === 0) {
            return true;
          }
          return getTopicScopedSubtopics(item, topicId).some((subtopic) => selectedSubtopics.includes(subtopic));
        })
    ).length;
  }

  function normalizeSubtopicMap(
    topicIds: TopicId[],
    inputMap: SessionSettings["selectedSubtopicsByTopic"]
  ): SessionSettings["selectedSubtopicsByTopic"] {
    const normalized: SessionSettings["selectedSubtopicsByTopic"] = {};
    const selected = new Set(topicIds);

    for (const topicId of TOPICS.map((topic) => topic.id)) {
      if (!selected.has(topicId)) {
        normalized[topicId] = [];
        continue;
      }

      const available = allSubtopicsByTopic[topicId] ?? [];
      const incoming = inputMap[topicId] ?? [];
      const valid = available.filter((subtopic) => incoming.includes(subtopic));
      normalized[topicId] = valid.length > 0 ? valid : [...available];
    }

    return normalized;
  }

  function getTopicCounts(settings: SessionSettings): Record<TopicId, number> {
    const counts = TOPICS.reduce<Record<TopicId, number>>((accumulator, topic) => {
      accumulator[topic.id] = 0;
      return accumulator;
    }, {} as Record<TopicId, number>);

    for (const expression of EXPRESSIONS) {
      if (!settings.difficulties.includes(expression.difficulty)) {
        continue;
      }
      for (const topicId of expression.topics) {
        counts[topicId] = (counts[topicId] ?? 0) + 1;
      }
    }

    return counts;
  }

  function getTopicSubtopicStats(settings: SessionSettings): TopicSubtopicStats {
    const byTopic = TOPICS.reduce<Record<TopicId, Map<string, number>>>((accumulator, topic) => {
      accumulator[topic.id] = new Map<string, number>();
      return accumulator;
    }, {} as Record<TopicId, Map<string, number>>);

    for (const expression of EXPRESSIONS) {
      if (!settings.difficulties.includes(expression.difficulty)) {
        continue;
      }
      for (const topicId of expression.topics) {
        const topicMap = byTopic[topicId];
        if (!topicMap) {
          continue;
        }
        for (const subtopic of getTopicScopedSubtopics(expression, topicId)) {
          topicMap.set(subtopic, (topicMap.get(subtopic) ?? 0) + 1);
        }
      }
    }

    return TOPICS.reduce<TopicSubtopicStats>((accumulator, topic) => {
      const entries = [...(byTopic[topic.id]?.entries() ?? [])]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([label, count]) => ({ label, count }));

      accumulator[topic.id] = entries;
      return accumulator;
    }, {} as TopicSubtopicStats);
  }

  function handleTopicToggle(topicId: TopicId): void {
    const currentSettings = get(game).settings;
    const selected = new Set(currentSettings.selectedTopicIds);
    const nextSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"] = {
      ...currentSettings.selectedSubtopicsByTopic
    };

    if (selected.has(topicId)) {
      if (selected.size === 1) {
        return;
      }
      selected.delete(topicId);
      nextSubtopicsByTopic[topicId] = [];
    } else {
      selected.add(topicId);
      nextSubtopicsByTopic[topicId] = [...(allSubtopicsByTopic[topicId] ?? [])];
    }

    const nextTopicIds = TOPICS.map((topic) => topic.id).filter((id) => selected.has(id));
    const normalizedSubtopicsByTopic = normalizeSubtopicMap(nextTopicIds, nextSubtopicsByTopic);
    const projectedSettings: SessionSettings = {
      ...currentSettings,
      selectedTopicIds: nextTopicIds,
      selectedSubtopicsByTopic: normalizedSubtopicsByTopic
    };

    if (getPoolSize(projectedSettings) === 0) {
      return;
    }

    game.updateSettings({
      selectedTopicIds: nextTopicIds,
      selectedSubtopicsByTopic: normalizedSubtopicsByTopic
    });
  }

  function handleTopicSelectAll(): void {
    const currentSettings = get(game).settings;
    const nextTopicIds = TOPICS.map((topic) => topic.id);
    const fullSubtopicsByTopic = TOPICS.reduce<SessionSettings["selectedSubtopicsByTopic"]>((accumulator, topic) => {
      accumulator[topic.id] = [...(allSubtopicsByTopic[topic.id] ?? [])];
      return accumulator;
    }, {} as SessionSettings["selectedSubtopicsByTopic"]);
    const currentlyAllSelected = nextTopicIds.every((topicId) => {
      if (!currentSettings.selectedTopicIds.includes(topicId)) {
        return false;
      }
      const availableSubtopics = fullSubtopicsByTopic[topicId] ?? [];
      const selectedSubtopics = currentSettings.selectedSubtopicsByTopic[topicId] ?? [];
      if (availableSubtopics.length === 0) {
        return true;
      }
      return availableSubtopics.every((subtopic) => selectedSubtopics.includes(subtopic));
    });

    if (!currentlyAllSelected) {
      const projectedSettings: SessionSettings = {
        ...currentSettings,
        selectedTopicIds: nextTopicIds,
        selectedSubtopicsByTopic: fullSubtopicsByTopic
      };

      if (getPoolSize(projectedSettings) === 0) {
        return;
      }

      game.updateSettings({
        selectedTopicIds: nextTopicIds,
        selectedSubtopicsByTopic: fullSubtopicsByTopic
      });
      return;
    }

    for (const topic of TOPICS) {
      const singleTopicIds: TopicId[] = [topic.id];
      const singleTopicSubtopics: SessionSettings["selectedSubtopicsByTopic"] = {
        [topic.id]: [...(allSubtopicsByTopic[topic.id] ?? [])]
      };
      const normalizedSubtopicsByTopic = normalizeSubtopicMap(singleTopicIds, singleTopicSubtopics);
      const projectedSettings: SessionSettings = {
        ...currentSettings,
        selectedTopicIds: singleTopicIds,
        selectedSubtopicsByTopic: normalizedSubtopicsByTopic
      };

      if (getPoolSize(projectedSettings) === 0) {
        continue;
      }

      game.updateSettings({
        selectedTopicIds: singleTopicIds,
        selectedSubtopicsByTopic: normalizedSubtopicsByTopic
      });
      return;
    }
  }

  function handleSubtopicToggle(payload: SubtopicTogglePayload): void {
    const { topicId, subtopic } = payload;
    const currentSettings = get(game).settings;
    const availableSubtopics = allSubtopicsByTopic[topicId] ?? [];
    if (!availableSubtopics.includes(subtopic)) {
      return;
    }

    const selectedTopics = new Set(currentSettings.selectedTopicIds);
    const nextSubtopicsByTopic: SessionSettings["selectedSubtopicsByTopic"] = {
      ...currentSettings.selectedSubtopicsByTopic
    };
    const topicIsSelected = selectedTopics.has(topicId);
    const topicSubtopics = new Set(
      topicIsSelected ? (nextSubtopicsByTopic[topicId] ?? availableSubtopics) : []
    );

    if (topicSubtopics.has(subtopic)) {
      if (topicSubtopics.size === 1) {
        if (selectedTopics.size === 1 && selectedTopics.has(topicId)) {
          return;
        }
        selectedTopics.delete(topicId);
        topicSubtopics.clear();
      } else {
        topicSubtopics.delete(subtopic);
      }
    } else {
      selectedTopics.add(topicId);
      topicSubtopics.add(subtopic);
    }

    nextSubtopicsByTopic[topicId] = availableSubtopics.filter((item) => topicSubtopics.has(item));
    const nextTopicIds = TOPICS.map((topic) => topic.id).filter((id) => selectedTopics.has(id));
    const normalizedSubtopicsByTopic = normalizeSubtopicMap(nextTopicIds, nextSubtopicsByTopic);
    const projectedSettings: SessionSettings = {
      ...currentSettings,
      selectedTopicIds: nextTopicIds,
      selectedSubtopicsByTopic: normalizedSubtopicsByTopic
    };

    if (getPoolSize(projectedSettings) === 0) {
      return;
    }

    game.updateSettings({
      selectedTopicIds: nextTopicIds,
      selectedSubtopicsByTopic: normalizedSubtopicsByTopic
    });
  }

  async function handleSubmit(inputLatex: string): Promise<void> {
    await game.submit(inputLatex);
  }

  function handleActivity(): void {
    game.registerActivity();
  }

  function handleSkip(): void {
    game.skip();
  }

  $: topicCounts = getTopicCounts($game.settings);
  $: topicSubtopicStats = getTopicSubtopicStats($game.settings);
  $: if ($game.status === "running" && expansionSettings.enabled && expansionCompileState === "idle") {
    void ensureExpansionsCompiled();
  }
  $: if ($game.poolRestartedAt !== null && $game.poolRestartedAt !== lastPoolRestartedAt) {
    lastPoolRestartedAt = $game.poolRestartedAt;
    poolRestartFallbackLatex = $game.lastResult?.targetLatex ?? "";
    poolRestartFlashVisible = true;
    if (poolRestartFlashTimer !== null) {
      clearTimeout(poolRestartFlashTimer);
    }
    poolRestartFlashTimer = setTimeout(() => {
      poolRestartFlashVisible = false;
      poolRestartFallbackLatex = "";
      poolRestartFlashTimer = null;
      if (get(game).status === "running") {
        inputFocusNonce += 1;
      }
    }, POOL_RESTART_LOCK_MS);
  }
</script>

<main class="app-shell">
  <a
    class="github-link"
    href="https://github.com/levYatsishin/textyper"
    target="_blank"
    rel="noreferrer"
    aria-label="Open GitHub repository"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 0C3.58 0 0 3.58 0 8a8.01 8.01 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52 0-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  </a>
  <div class="github-help-wrap">
    <button type="button" class="github-help-trigger text-option" aria-label="About features">
      ?
    </button>
    <div class="github-help-popout" role="note" aria-label="feature notes">
      <div class="github-help-popout-title">quick overview</div>
      <ul class="github-help-popout-list">
        <li class="github-help-popout-item">rendered target, type matching latex.</li>
        <li class="github-help-popout-item">auto-advance when render matches.</li>
        <li class="github-help-popout-item">filter by difficulty, topic, and subtopic.</li>
        <li class="github-help-popout-item">local history and statistics in browser, hidden at the bottom of the page.</li>
      </ul>
      <div class="github-help-popout-separator" aria-hidden="true"></div>
      <ul class="github-help-popout-list">
        <li class="github-help-popout-item">'show formula' mode for symbol learning.</li>
        <li class="github-help-popout-item">hover over individual rendered symbols to learn their code, double-click to copy.</li>
        <li class="github-help-popout-item">zen auto-stops after 5m of no input.</li>
      </ul>
      <div class="github-help-popout-link">read more on github readme above</div>
    </div>
  </div>
  <div class="expansion-settings-wrap">
    <button
      type="button"
      class="expansion-settings-trigger text-option"
      class:expansion-settings-trigger-loading={expansionCompileState === "loading"}
      bind:this={expansionButtonElement}
      aria-label="Expansion settings"
      on:click={toggleExpansionMenu}
    >
      ⚙
    </button>
    {#if expansionMenuOpen}
      <div class="expansion-settings-popout" bind:this={expansionMenuElement} role="dialog" aria-label="Expansion settings">
        <div class="expansion-popout-header">
          <span>expansions</span>
          <button type="button" class="text-option expansion-link-button" on:click={resetExpansionDefaults}>reset</button>
        </div>
        <div class="expansion-popout-row">
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.enabled}
            aria-pressed={expansionSettings.enabled}
            on:click={handleExpansionEnabledToggle}
          >
            enabled
          </button>
          <span class="bar-divider" aria-hidden="true">|</span>
          <span class="expansion-muted">format: obsidian</span>
        </div>
        {#if expansionCompileState === "loading"}
          <div class="expansion-loading" role="status" aria-live="polite">
            <span class="expansion-loading-spinner" aria-hidden="true"></span>
            <span>loading snippets...</span>
          </div>
        {/if}
        <div class="expansion-popout-row">
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.helpers.autofractionEnabled}
            on:click={() => handleExpansionHelperToggle("autofractionEnabled", !expansionSettings.helpers.autofractionEnabled)}
          >
            autofraction
          </button>
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.helpers.taboutEnabled}
            on:click={() => handleExpansionHelperToggle("taboutEnabled", !expansionSettings.helpers.taboutEnabled)}
          >
            tabout
          </button>
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.helpers.matrixShortcutsEnabled}
            on:click={() =>
              handleExpansionHelperToggle("matrixShortcutsEnabled", !expansionSettings.helpers.matrixShortcutsEnabled)}
          >
            matrix
          </button>
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.helpers.autoBracketPairingEnabled}
            on:click={() =>
              handleExpansionHelperToggle(
                "autoBracketPairingEnabled",
                !expansionSettings.helpers.autoBracketPairingEnabled
              )}
          >
            autopair
          </button>
          <button
            type="button"
            class="text-option expansion-option"
            class:active-option={expansionSettings.helpers.autoEnlargeBracketsEnabled}
            on:click={() =>
              handleExpansionHelperToggle("autoEnlargeBracketsEnabled", !expansionSettings.helpers.autoEnlargeBracketsEnabled)}
          >
            enlarge
          </button>
        </div>
        <label class="expansion-editor-label" for="expansion-snippets-input">snippets source</label>
        <textarea
          id="expansion-snippets-input"
          class="expansion-editor"
          value={expansionSnippetsSource}
          on:input={handleExpansionInput}
        ></textarea>
        <label class="expansion-editor-label" for="expansion-variables-input">variables</label>
        <textarea
          id="expansion-variables-input"
          class="expansion-editor expansion-editor-vars"
          value={expansionVariablesSource}
          on:input={handleVariablesInput}
        ></textarea>
        <div class="expansion-issues">
          <div class="expansion-issues-title">diagnostics</div>
          {#if expansionParseIssues.length === 0}
            <div class="expansion-issues-empty">no issues</div>
          {:else}
            <ul>
              {#each expansionParseIssues as issue}
                <li class={issue.severity === "error" ? "issue-error" : "issue-warning"}>
                  {issue.severity}: {issue.message}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="theme-toggle text-option"
    aria-label={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    on:click={toggleTheme}
  >
    {themeMode === "dark" ? "☾" : "☀"}
  </button>

  <header class="app-header">
    <h1>math latex typer</h1>
  </header>

  <ControlBar
    settings={$game.settings}
    status={$game.status}
    topics={TOPICS}
    topicCounts={topicCounts}
    topicSubtopicStats={topicSubtopicStats}
    on:modeChange={(event) => handleModeChange(event.detail)}
    on:difficultyToggle={(event) => handleDifficultyToggle(event.detail)}
    on:durationChange={(event) => handleDurationChange(event.detail)}
    on:revealToggle={(event) => handleRevealToggle(event.detail)}
    on:start={handleStart}
    on:restart={handleRestart}
    on:end={handleEnd}
    on:topicToggle={(event) => handleTopicToggle(event.detail)}
    on:subtopicToggle={(event) => handleSubtopicToggle(event.detail)}
    on:topicSelectAll={handleTopicSelectAll}
  />

  <FormulaStage
    expression={$game.currentExpression}
    revealLatex={$game.settings.revealLatex}
    poolRestartFlashVisible={poolRestartFlashVisible}
    poolRestartFallbackLatex={poolRestartFallbackLatex}
  />

  <div class="formula-skip">
    <button
      type="button"
      class="text-option"
      on:click={handleSkip}
      disabled={$game.status !== "running" || $game.isSubmitting || poolRestartFlashVisible}
    >
      skip
    </button>
  </div>

  <InputLane
    status={$game.status}
    mode={$game.settings.mode}
    remainingMs={$game.remainingMs}
    elapsedMs={$game.stats.elapsedMs}
    isSubmitting={$game.isSubmitting}
    inputLocked={poolRestartFlashVisible}
    focusNonce={inputFocusNonce}
    lastResult={$game.lastResult}
    targetLatex={$game.currentExpression?.latex ?? ""}
    expansionsEnabled={expansionSettings.enabled && expansionCompileState === "ready"}
    expansionSettings={expansionSettings}
    compiledSnippets={expansionCompiledSnippets}
    on:submit={(event) => handleSubmit(event.detail)}
    on:activity={handleActivity}
  />

  <details class="stats-drawer">
    <summary class="stats-drawer-toggle">
      <span class="stats-chevron" aria-hidden="true">▸</span>
      <span class="sr-only">Toggle statistics</span>
    </summary>

    <div class="stats-drawer-content">
      <StatsRail
        history={$game.history}
        stats={$game.stats}
        currentStreak={$game.currentStreak}
        status={$game.status}
      />

      <HistoryPanel
        history={$game.history}
        bests={$game.bests}
        on:clearHistory={handleClearHistory}
        on:deleteSession={handleDeleteSession}
      />
    </div>
  </details>

  <ResultsModal
    open={$game.status === "ended"}
    session={$game.lastSession}
    on:close={handleCloseResults}
    on:restart={handleRestart}
  />
</main>
