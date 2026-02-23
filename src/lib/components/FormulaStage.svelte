<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import katex from "katex";
  import { TOPIC_MAP } from "../data/topics";
  import { getTopicScopedSubtopics } from "../services/topicSubtopics";
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

  function formatTopic(topicId: string): string {
    if (!topicId) {
      return "general";
    }
    return TOPIC_MAP[topicId]?.label ?? topicId.replaceAll("-", " ");
  }

  function getTopicSubtopicLabels(expression: Expression): string[] {
    const labels: string[] = [];
    const seen = new Set<string>();

    for (const topicId of expression.topics) {
      const topicLabel = formatTopic(topicId);
      const scopedSubtopics = getTopicScopedSubtopics(expression, topicId);
      const normalizedSubtopics = scopedSubtopics.length > 0 ? scopedSubtopics : [""];

      for (const subtopic of normalizedSubtopics) {
        const key = `${topicId}::${subtopic}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        labels.push(subtopic ? `${topicLabel} · ${subtopic}` : topicLabel);
      }
    }

    return labels;
  }

  $: renderedExpression = expression ? renderLatex(expression.latex) : "";
  $: sourceTopicId = expression?.topics[0] ?? "";
  $: sourceTopic = expression ? formatTopic(sourceTopicId) : "";
  $: sourceSubtopic = expression ? getTopicScopedSubtopics(expression, sourceTopicId)[0] ?? "" : "";
  $: sourceLabel = expression ? (sourceSubtopic ? `${sourceTopic} · ${sourceSubtopic}` : sourceTopic) : "";
  $: additionalSourceLabels = expression
    ? getTopicSubtopicLabels(expression).filter((label) => label !== sourceLabel)
    : [];

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
    <div class="formula-source-wrap">
      <div class="formula-source formula-source-trigger" tabindex={additionalSourceLabels.length > 0 ? 0 : undefined}>
        {sourceLabel}
      </div>
      {#if additionalSourceLabels.length > 0}
        <div class="formula-source-popout" role="note" aria-label="additional categories">
          <div class="formula-source-popout-title">also in</div>
          {#each additionalSourceLabels as label (label)}
            <div class="formula-source-popout-item">{label}</div>
          {/each}
        </div>
      {/if}
    </div>
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
