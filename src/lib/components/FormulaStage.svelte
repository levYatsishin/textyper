<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { TOPIC_MAP } from "../data/topics";
  import { buildInstrumentedRender, extractHoverSnippet, type HoverAtom } from "../services/latexHoverMap";
  import { getTopicScopedSubtopics } from "../services/topicSubtopics";
  import type { Expression } from "../types";

  export let expression: Expression | null = null;
  export let revealLatex = false;
  let outputContainer: HTMLDivElement | null = null;
  let formulaNode: HTMLDivElement | null = null;
  let tooltipNode: HTMLDivElement | null = null;
  let formulaScale = 1;
  let resizeObserver: ResizeObserver | null = null;
  let atomsById: Record<string, HoverAtom> = {};
  let activeAtomId: string | null = null;
  let tooltipText = "";
  let tooltipVisible = false;
  let tooltipCopied = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let touchTooltipPinned = false;
  let longPressTimer: number | null = null;
  let touchPointerId: number | null = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartAtomId: string | null = null;
  let copiedResetTimer: number | null = null;
  let previousExpressionId = "";
  let lastPointerX = 0;
  let lastPointerY = 0;

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

  $: instrumentedRender = expression ? buildInstrumentedRender(expression.latex) : { html: "", atomsById: {} };
  $: renderedExpression = expression ? instrumentedRender.html : "";
  $: atomsById = expression ? instrumentedRender.atomsById : {};
  $: sourceTopicId = expression?.topics[0] ?? "";
  $: sourceTopic = expression ? formatTopic(sourceTopicId) : "";
  $: sourceSubtopic = expression ? getTopicScopedSubtopics(expression, sourceTopicId)[0] ?? "" : "";
  $: sourceLabel = expression ? (sourceSubtopic ? `${sourceTopic} · ${sourceSubtopic}` : sourceTopic) : "";
  $: additionalSourceLabels = expression
    ? getTopicSubtopicLabels(expression).filter((label) => label !== sourceLabel)
    : [];
  $: currentExpressionId = expression?.id ?? "";
  $: if (currentExpressionId !== previousExpressionId) {
    previousExpressionId = currentExpressionId;
    hideTooltip();
    clearLongPressTracker();
  }

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
    if (tooltipVisible) {
      updateTooltipPosition(lastPointerX, lastPointerY);
    }
  }

  function getAtomIdFromTarget(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const atomElement = target.closest<HTMLElement>("[data-ltx-id]");
    return atomElement?.dataset.ltxId ?? null;
  }

  function updateTooltipPosition(clientX: number, clientY: number): void {
    if (!outputContainer) {
      return;
    }
    const rect = outputContainer.getBoundingClientRect();
    const tooltipWidth = tooltipNode?.offsetWidth ?? 220;
    const tooltipHeight = tooltipNode?.offsetHeight ?? 46;
    const padding = 8;
    const maxX = Math.max(padding, outputContainer.clientWidth - tooltipWidth - padding);
    const maxY = Math.max(padding, outputContainer.clientHeight - tooltipHeight - padding);

    const relativeX = clientX - rect.left + 12;
    const relativeY = clientY - rect.top + 12;

    tooltipX = Math.max(padding, Math.min(relativeX, maxX));
    tooltipY = Math.max(padding, Math.min(relativeY, maxY));
    lastPointerX = clientX;
    lastPointerY = clientY;
  }

  function showTooltip(atomId: string, clientX: number, clientY: number, pinned = false): void {
    const snippet = extractHoverSnippet(atomId, atomsById);
    if (!snippet) {
      return;
    }

    activeAtomId = atomId;
    tooltipText = snippet;
    tooltipCopied = false;
    tooltipVisible = true;
    touchTooltipPinned = pinned;
    updateTooltipPosition(clientX, clientY);
    tick().then(() => updateTooltipPosition(clientX, clientY));
  }

  function hideTooltip(): void {
    tooltipVisible = false;
    tooltipCopied = false;
    touchTooltipPinned = false;
    activeAtomId = null;
    if (copiedResetTimer !== null) {
      window.clearTimeout(copiedResetTimer);
      copiedResetTimer = null;
    }
  }

  function clearLongPressTracker(): void {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    touchPointerId = null;
    touchStartAtomId = null;
  }

  function handlePointerOver(event: PointerEvent): void {
    if (event.pointerType === "touch" || touchTooltipPinned) {
      return;
    }
    if (event.target instanceof Element && event.target.closest(".formula-hover-popout")) {
      return;
    }
    const atomId = getAtomIdFromTarget(event.target);
    if (!atomId) {
      return;
    }
    showTooltip(atomId, event.clientX, event.clientY);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType === "touch") {
      if (event.pointerId !== touchPointerId || longPressTimer === null) {
        return;
      }
      const deltaX = event.clientX - touchStartX;
      const deltaY = event.clientY - touchStartY;
      if (Math.hypot(deltaX, deltaY) > 10) {
        clearLongPressTracker();
      }
      return;
    }
    if (touchTooltipPinned || (event.target instanceof Element && event.target.closest(".formula-hover-popout"))) {
      return;
    }
    const atomId = getAtomIdFromTarget(event.target);
    if (!atomId) {
      hideTooltip();
      return;
    }
    if (atomId !== activeAtomId) {
      showTooltip(atomId, event.clientX, event.clientY);
      return;
    }
    updateTooltipPosition(event.clientX, event.clientY);
  }

  function handlePointerLeave(event: PointerEvent): void {
    if (event.pointerType === "touch" || touchTooltipPinned) {
      return;
    }
    hideTooltip();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse") {
      return;
    }
    const atomId = getAtomIdFromTarget(event.target);
    if (!atomId) {
      clearLongPressTracker();
      return;
    }

    clearLongPressTracker();
    touchPointerId = event.pointerId;
    touchStartX = event.clientX;
    touchStartY = event.clientY;
    touchStartAtomId = atomId;
    longPressTimer = window.setTimeout(() => {
      if (!touchStartAtomId) {
        return;
      }
      showTooltip(touchStartAtomId, touchStartX, touchStartY, true);
      clearLongPressTracker();
    }, 350);
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.pointerId === touchPointerId) {
      clearLongPressTracker();
    }
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId === touchPointerId) {
      clearLongPressTracker();
    }
  }

  function handleGlobalPointerDown(event: PointerEvent): void {
    if (!touchTooltipPinned || !outputContainer) {
      return;
    }
    if (event.target instanceof Node && outputContainer.contains(event.target)) {
      return;
    }
    hideTooltip();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      hideTooltip();
      clearLongPressTracker();
    }
  }

  async function copyTooltipSnippet(): Promise<void> {
    if (!tooltipText || !navigator?.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tooltipText);
      tooltipCopied = true;
      if (copiedResetTimer !== null) {
        window.clearTimeout(copiedResetTimer);
      }
      copiedResetTimer = window.setTimeout(() => {
        tooltipCopied = false;
        copiedResetTimer = null;
      }, 1_000);
    } catch {
      tooltipCopied = false;
    }
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
    window.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handleGlobalPointerDown, true);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", handleWindowResize);
    window.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    clearLongPressTracker();
    if (copiedResetTimer !== null) {
      window.clearTimeout(copiedResetTimer);
      copiedResetTimer = null;
    }
  });
</script>

<section class="formula-stage">
  {#if expression}
    <div class="formula-source-wrap">
      <div class="formula-source formula-source-trigger">
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
      <div
        class="formula-output"
        role="figure"
        aria-label="target formula"
        aria-live="polite"
        bind:this={outputContainer}
        on:pointerover={handlePointerOver}
        on:pointermove={handlePointerMove}
        on:pointerleave={handlePointerLeave}
        on:pointerdown={handlePointerDown}
        on:pointerup={handlePointerUp}
        on:pointercancel={handlePointerCancel}
      >
        <div class="formula-scale" bind:this={formulaNode} style={`transform: scale(${formulaScale});`}>
          {@html renderedExpression}
        </div>
        {#if tooltipVisible && tooltipText}
          <div
            class="formula-hover-popout visible"
            role="note"
            bind:this={tooltipNode}
            style={`left: ${tooltipX}px; top: ${tooltipY}px;`}
          >
            <code class="formula-hover-snippet">{tooltipText}</code>
            <button type="button" class="formula-hover-copy text-option" on:click|stopPropagation={copyTooltipSnippet}>
              {tooltipCopied ? "copied" : "copy"}
            </button>
          </div>
        {/if}
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
