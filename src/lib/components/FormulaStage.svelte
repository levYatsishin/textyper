<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import katex from "katex";
  import type { Expression } from "../types";

  export let expression: Expression | null = null;
  export let revealLatex = false;
  let outputContainer: HTMLDivElement | null = null;
  let formulaNode: HTMLDivElement | null = null;
  let formulaScale = 1;
  let resizeObserver: ResizeObserver | null = null;

  function renderLatex(latex: string): string {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: true });
    } catch {
      return "<span class='formula-error'>Unable to render formula.</span>";
    }
  }

  function formatDifficulty(difficulty: Expression["difficulty"]): string {
    if (difficulty === "beginner") {
      return "easy";
    }
    if (difficulty === "intermediate") {
      return "medium";
    }
    return "hard";
  }

  $: renderedExpression = expression ? renderLatex(expression.latex) : "";

  function updateFormulaScale(): void {
    if (!outputContainer || !formulaNode) {
      formulaScale = 1;
      return;
    }

    const availableWidth = Math.max(0, outputContainer.clientWidth - 10);
    const requiredWidth = formulaNode.scrollWidth;
    if (availableWidth <= 0 || requiredWidth <= 0) {
      formulaScale = 1;
      return;
    }

    formulaScale = Math.min(1, availableWidth / requiredWidth);
  }

  function handleWindowResize(): void {
    updateFormulaScale();
  }

  $: if (renderedExpression) {
    tick().then(updateFormulaScale);
  }

  onMount(() => {
    tick().then(updateFormulaScale);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateFormulaScale);
      if (outputContainer) {
        resizeObserver.observe(outputContainer);
      }
    }
    window.addEventListener("resize", handleWindowResize);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", handleWindowResize);
  });
</script>

<section class="formula-stage">
  {#if expression}
    <div class="formula-topic">{expression.name}</div>
    <div class="formula-difficulty">{formatDifficulty(expression.difficulty)}</div>
    <div class="formula-card">
      <div class="formula-output" aria-live="polite" bind:this={outputContainer}>
        <div class="formula-scale" bind:this={formulaNode} style={`transform: scale(${formulaScale});`}>
          {@html renderedExpression}
        </div>
      </div>
      {#if revealLatex}
        <pre class="latex-reveal">{expression.latex}</pre>
      {/if}
    </div>
  {:else}
    <div class="formula-card empty">
      <p>No formula loaded. Press Start to begin.</p>
    </div>
  {/if}
</section>
