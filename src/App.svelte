<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import ControlBar from "./lib/components/ControlBar.svelte";
  import FormulaStage from "./lib/components/FormulaStage.svelte";
  import HistoryPanel from "./lib/components/HistoryPanel.svelte";
  import InputLane from "./lib/components/InputLane.svelte";
  import ResultsModal from "./lib/components/ResultsModal.svelte";
  import StatsRail from "./lib/components/StatsRail.svelte";
  import { EXPRESSIONS } from "./lib/data/expressions";
  import { TOPICS } from "./lib/data/topics";
  import { createGameStore } from "./lib/stores/gameStore";
  import type { Difficulty, Mode, SessionSettings, TopicId } from "./lib/types";

  const game = createGameStore(EXPRESSIONS);

  function handleBeforeUnload(): void {
    game.end();
  }

  onMount(() => {
    game.loadHistory();
    if (get(game).status === "idle") {
      game.start();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
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

    if (getPoolSize({ ...currentSettings, difficulties: nextDifficulties }) === 0) {
      return;
    }

    game.updateSettings({ difficulties: nextDifficulties });
  }

  function handleDurationChange(durationSec: SessionSettings["durationSec"]): void {
    game.updateSettings({ durationSec });
  }

  function handleStart(): void {
    game.start();
  }

  function handleRestart(): void {
    game.reset();
  }

  function handleEnd(): void {
    game.end();
  }

  function handleRevealToggle(isEnabled: boolean): void {
    game.toggleReveal(isEnabled);
  }

  function getPoolSize(settings: SessionSettings): number {
    const selectedTopics = new Set(settings.selectedTopicIds);
    return EXPRESSIONS.filter(
      (item) =>
        settings.difficulties.includes(item.difficulty) &&
        item.topics.some((topicId) => selectedTopics.has(topicId))
    ).length;
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

  function handleTopicToggle(topicId: TopicId): void {
    const currentSettings = get(game).settings;
    const selected = new Set(currentSettings.selectedTopicIds);

    if (selected.has(topicId)) {
      if (selected.size === 1) {
        return;
      }
      selected.delete(topicId);
    } else {
      selected.add(topicId);
    }

    const nextTopicIds = TOPICS.map((topic) => topic.id).filter((id) => selected.has(id));
    const projectedSettings: SessionSettings = {
      ...currentSettings,
      selectedTopicIds: nextTopicIds
    };

    if (getPoolSize(projectedSettings) === 0) {
      return;
    }

    game.updateSettings({ selectedTopicIds: nextTopicIds });
  }

  function handleTopicSelectAll(): void {
    const currentSettings = get(game).settings;
    const nextTopicIds = TOPICS.map((topic) => topic.id);
    const projectedSettings: SessionSettings = {
      ...currentSettings,
      selectedTopicIds: nextTopicIds
    };

    if (getPoolSize(projectedSettings) === 0) {
      return;
    }

    game.updateSettings({ selectedTopicIds: nextTopicIds });
  }

  async function handleSubmit(inputLatex: string): Promise<void> {
    await game.submit(inputLatex);
  }

  function handleSkip(): void {
    game.skip();
  }

  $: topicCounts = getTopicCounts($game.settings);
</script>

<main class="app-shell">
  <header class="app-header">
    <h1>math latex typer</h1>
  </header>

  <ControlBar
    settings={$game.settings}
    status={$game.status}
    topics={TOPICS}
    topicCounts={topicCounts}
    on:modeChange={(event) => handleModeChange(event.detail)}
    on:difficultyToggle={(event) => handleDifficultyToggle(event.detail)}
    on:durationChange={(event) => handleDurationChange(event.detail)}
    on:revealToggle={(event) => handleRevealToggle(event.detail)}
    on:topicToggle={(event) => handleTopicToggle(event.detail)}
    on:topicSelectAll={handleTopicSelectAll}
    on:start={handleStart}
    on:restart={handleRestart}
    on:end={handleEnd}
  />

  <FormulaStage expression={$game.currentExpression} revealLatex={$game.settings.revealLatex} />

  <div class="formula-skip">
    <button type="button" class="text-option" on:click={handleSkip} disabled={$game.status !== "running" || $game.isSubmitting}>
      skip
    </button>
  </div>

  <InputLane
    status={$game.status}
    isSubmitting={$game.isSubmitting}
    lastResult={$game.lastResult}
    targetLatex={$game.currentExpression?.latex ?? ""}
    on:submit={(event) => handleSubmit(event.detail)}
  />

  <details class="stats-drawer">
    <summary class="stats-drawer-toggle">
      <span class="stats-chevron" aria-hidden="true">▸</span>
      <span class="sr-only">Toggle statistics</span>
    </summary>

    <div class="stats-drawer-content">
      <StatsRail
        stats={$game.stats}
        currentStreak={$game.currentStreak}
        mode={$game.settings.mode}
        remainingMs={$game.remainingMs}
        status={$game.status}
      />

      <HistoryPanel history={$game.history} bests={$game.bests} />
    </div>
  </details>

  <ResultsModal open={$game.status === "ended"} session={$game.lastSession} on:restart={handleRestart} />
</main>
