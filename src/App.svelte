<script lang="ts">
  import { onMount } from "svelte";
  import ControlBar from "./lib/components/ControlBar.svelte";
  import FormulaStage from "./lib/components/FormulaStage.svelte";
  import HistoryPanel from "./lib/components/HistoryPanel.svelte";
  import InputLane from "./lib/components/InputLane.svelte";
  import ResultsModal from "./lib/components/ResultsModal.svelte";
  import StatsRail from "./lib/components/StatsRail.svelte";
  import { EXPRESSIONS } from "./lib/data/expressions";
  import { createGameStore } from "./lib/stores/gameStore";
  import type { Difficulty, Mode, SessionSettings } from "./lib/types";

  const game = createGameStore(EXPRESSIONS);

  onMount(() => {
    game.loadHistory();
    game.start();
  });

  function handleModeChange(mode: Mode): void {
    game.updateSettings({ mode });
  }

  function handleDifficultyChange(difficulty: Difficulty): void {
    game.updateSettings({ difficulty });
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

  async function handleSubmit(inputLatex: string): Promise<void> {
    await game.submit(inputLatex);
  }

  function handleSkip(): void {
    game.skip();
  }
</script>

<main class="app-shell">
  <header class="app-header">
    <h1>Math LaTeX Typer</h1>
    <p>Practice math expression typing with render-aware scoring.</p>
  </header>

  <ControlBar
    settings={$game.settings}
    status={$game.status}
    on:modeChange={(event) => handleModeChange(event.detail)}
    on:difficultyChange={(event) => handleDifficultyChange(event.detail)}
    on:durationChange={(event) => handleDurationChange(event.detail)}
    on:revealToggle={(event) => handleRevealToggle(event.detail)}
    on:start={handleStart}
    on:restart={handleRestart}
    on:end={handleEnd}
  />

  <FormulaStage expression={$game.currentExpression} revealLatex={$game.settings.revealLatex} />

  <InputLane status={$game.status} isSubmitting={$game.isSubmitting} lastResult={$game.lastResult} on:submit={(event) => handleSubmit(event.detail)} on:skip={handleSkip} />

  <StatsRail
    stats={$game.stats}
    currentStreak={$game.currentStreak}
    mode={$game.settings.mode}
    remainingMs={$game.remainingMs}
    status={$game.status}
  />

  <HistoryPanel history={$game.history} bests={$game.bests} />

  <ResultsModal open={$game.status === "ended"} session={$game.lastSession} on:restart={handleRestart} />
</main>
