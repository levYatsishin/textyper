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

  interface TopicSubtopicStat {
    label: string;
    count: number;
  }

  interface SubtopicTogglePayload {
    topicId: TopicId;
    subtopic: string;
  }

  type TopicSubtopicStats = Record<TopicId, TopicSubtopicStat[]>;

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
        for (const subtopic of expression.subtopics) {
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
        item.topics.some((topicId) => {
          if (!selectedTopics.has(topicId)) {
            return false;
          }
          const selectedSubtopics = settings.selectedSubtopicsByTopic[topicId] ?? [];
          if (selectedSubtopics.length === 0) {
            return true;
          }
          return item.subtopics.some((subtopic) => selectedSubtopics.includes(subtopic));
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
      if (expression.subtopics.length === 0) {
        continue;
      }

      for (const topicId of expression.topics) {
        const topicMap = byTopic[topicId];
        if (!topicMap) {
          continue;
        }
        for (const subtopic of expression.subtopics) {
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

  function handleSkip(): void {
    game.skip();
  }

  $: topicCounts = getTopicCounts($game.settings);
  $: topicSubtopicStats = getTopicSubtopicStats($game.settings);
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
    topicSubtopicStats={topicSubtopicStats}
    on:modeChange={(event) => handleModeChange(event.detail)}
    on:difficultyToggle={(event) => handleDifficultyToggle(event.detail)}
    on:durationChange={(event) => handleDurationChange(event.detail)}
    on:revealToggle={(event) => handleRevealToggle(event.detail)}
    on:topicToggle={(event) => handleTopicToggle(event.detail)}
    on:subtopicToggle={(event) => handleSubtopicToggle(event.detail)}
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
