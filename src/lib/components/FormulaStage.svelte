<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { TOPIC_MAP } from "../data/topics";
  import {
    buildInstrumentedRender,
    extractHoverSnippet,
    extractLeftRightDelimiterSnippets,
    type HoverAtom
  } from "../services/latexHoverMap";
  import { getTopicScopedSubtopics } from "../services/topicSubtopics";
  import type { Expression } from "../types";

  export let expression: Expression | null = null;
  export let revealLatex = false;
  export let poolRestartFlashVisible = false;
  export let poolRestartFallbackLatex = "";
  let displayedExpression: Expression | null = null;
  let outputContainer: HTMLDivElement | null = null;
  let formulaNode: HTMLDivElement | null = null;
  let tooltipNode: HTMLDivElement | null = null;
  let formulaScale = 1;
  let resizeObserver: ResizeObserver | null = null;
  let baseAtomsById: Record<string, HoverAtom> = {};
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
  let noticeHideTimer: number | null = null;
  let copyNoticeVisible = false;
  let copyNoticeText = "";
  let previousExpressionId = "";
  let lastPointerX = 0;
  let lastPointerY = 0;
  const STYLE_COMMAND_RE =
    /^\\(?:operatorname|text|mathbf|mathrm|mathit|mathsf|mathcal|mathfrak|mathbb|boldsymbol|bm|vec|hat|bar|overline|underline|widehat|widetilde)\b/;

  function pickSmallestCandidate(candidateIds: string[]): string | null {
    let bestId: string | null = null;
    let bestSpan = Number.POSITIVE_INFINITY;

    for (const candidateId of candidateIds) {
      const atom = atomsById[candidateId];
      if (!atom) {
        continue;
      }
      const span = Math.max(0, atom.end - atom.start);
      if (span < bestSpan) {
        bestSpan = span;
        bestId = candidateId;
      }
    }

    return bestId;
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

  $: if (!poolRestartFlashVisible) {
    displayedExpression = expression;
  }
  $: effectiveExpression = poolRestartFlashVisible ? (displayedExpression ?? expression) : expression;
  $: instrumentedRender = effectiveExpression ? buildInstrumentedRender(effectiveExpression.latex) : { html: "", atomsById: {} };
  $: renderedExpression = effectiveExpression ? instrumentedRender.html : "";
  $: baseAtomsById = effectiveExpression ? instrumentedRender.atomsById : {};
  $: atomsById = baseAtomsById;
  $: sourceTopicId = effectiveExpression?.topics[0] ?? "";
  $: sourceTopic = effectiveExpression ? formatTopic(sourceTopicId) : "";
  $: sourceSubtopic = effectiveExpression ? getTopicScopedSubtopics(effectiveExpression, sourceTopicId)[0] ?? "" : "";
  $: sourceLabel = effectiveExpression ? (sourceSubtopic ? `${sourceTopic} · ${sourceSubtopic}` : sourceTopic) : "";
  $: revealLatexValue =
    poolRestartFlashVisible && poolRestartFallbackLatex.trim().length > 0
      ? poolRestartFallbackLatex
      : (effectiveExpression?.latex ?? "");
  $: additionalSourceLabels = effectiveExpression
    ? getTopicSubtopicLabels(effectiveExpression).filter((label) => label !== sourceLabel)
    : [];
  $: currentExpressionId = effectiveExpression?.id ?? "";
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

  function collectCandidateIdsFromTarget(target: EventTarget | null): string[] {
    if (!(target instanceof Element)) {
      return [];
    }
    const candidateIds: string[] = [];
    let current = target.closest<HTMLElement>("[data-ltx-id]");
    while (current) {
      const atomId = current.dataset.ltxId;
      if (atomId) {
        candidateIds.push(atomId);
      }
      const parent = current.parentElement;
      current = parent ? parent.closest<HTMLElement>("[data-ltx-id]") : null;
    }
    return candidateIds;
  }

  function collectCandidateIdsFromPoint(clientX: number, clientY: number): string[] {
    if (typeof document.elementsFromPoint !== "function") {
      return [];
    }
    const elements = document.elementsFromPoint(clientX, clientY);
    const candidateIds: string[] = [];
    const seen = new Set<string>();
    for (const element of elements) {
      if (!(element instanceof Element)) {
        continue;
      }
      if (!outputContainer?.contains(element)) {
        continue;
      }
      const holder = element.closest<HTMLElement>("[data-ltx-id]");
      const atomId = holder?.dataset.ltxId;
      if (!atomId || seen.has(atomId)) {
        continue;
      }
      seen.add(atomId);
      candidateIds.push(atomId);
    }
    return candidateIds;
  }

  function getAtomIdFromPointer(target: EventTarget | null, clientX: number, clientY: number): string | null {
    const pointCandidates = collectCandidateIdsFromPoint(clientX, clientY);
    const targetCandidates = collectCandidateIdsFromTarget(target);
    const candidateIds = [...pointCandidates, ...targetCandidates].filter((id, index, all) => all.indexOf(id) === index);

    if (candidateIds.length === 0) {
      return null;
    }

    const styledCandidates = candidateIds.filter((candidateId) => {
      const atom = atomsById[candidateId];
      return Boolean(atom?.snippet && STYLE_COMMAND_RE.test(atom.snippet));
    });

    if (styledCandidates.length > 0) {
      return pickSmallestCandidate(styledCandidates) ?? styledCandidates[0] ?? null;
    }

    return pickSmallestCandidate(candidateIds) ?? null;
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

  function showCopyNotice(message: string): void {
    copyNoticeText = message;
    copyNoticeVisible = true;
    if (noticeHideTimer !== null) {
      window.clearTimeout(noticeHideTimer);
    }
    noticeHideTimer = window.setTimeout(() => {
      copyNoticeVisible = false;
      noticeHideTimer = null;
    }, 650);
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
    if (noticeHideTimer !== null) {
      window.clearTimeout(noticeHideTimer);
      noticeHideTimer = null;
    }
    copyNoticeVisible = false;
    copyNoticeText = "";
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
    const atomId = getAtomIdFromPointer(event.target, event.clientX, event.clientY);
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
    const atomId = getAtomIdFromPointer(event.target, event.clientX, event.clientY);
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
    const atomId = getAtomIdFromPointer(event.target, event.clientX, event.clientY);
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

  async function handleDoubleClick(event: MouseEvent): Promise<void> {
    if (event.target instanceof Element && event.target.closest(".formula-hover-popout")) {
      return;
    }
    const atomId = getAtomIdFromPointer(event.target, event.clientX, event.clientY);
    if (!atomId) {
      return;
    }
    showTooltip(atomId, event.clientX, event.clientY);
    await copyTooltipSnippet();
  }

  async function handleRevealDoubleClick(event: MouseEvent): Promise<void> {
    if (!navigator?.clipboard?.writeText || !revealLatexValue) {
      return;
    }
    try {
      await navigator.clipboard.writeText(revealLatexValue);
      showCopyNotice("formula copied");
    } catch {
      showCopyNotice("copy failed");
    }
  }

  function applyLeftRightDelimiterHoverMapping(): void {
    if (!outputContainer || !effectiveExpression) {
      atomsById = baseAtomsById;
      return;
    }

    const leftRightSnippets = extractLeftRightDelimiterSnippets(effectiveExpression.latex);
    if (leftRightSnippets.length === 0) {
      atomsById = baseAtomsById;
      return;
    }

    outputContainer.querySelectorAll<HTMLElement>("[data-ltx-id^='ltx-post-']").forEach((node) => {
      node.removeAttribute("data-ltx-id");
    });

    const delimiterNodes = Array.from(outputContainer.querySelectorAll<HTMLElement>(".katex .mopen, .katex .mclose"))
      .filter((node) => !node.classList.contains("nulldelimiter"))
      .filter((node) => !node.closest("[data-ltx-id]"));

    if (delimiterNodes.length === 0) {
      atomsById = baseAtomsById;
      return;
    }

    const mappedCount = Math.min(delimiterNodes.length, leftRightSnippets.length);
    if (mappedCount <= 0) {
      atomsById = baseAtomsById;
      return;
    }

    const mergedAtoms: Record<string, HoverAtom> = { ...baseAtomsById };
    for (let index = 0; index < mappedCount; index += 1) {
      const node = delimiterNodes[index];
      const snippet = leftRightSnippets[index];
      const id = `ltx-post-${currentExpressionId}-${index}`;
      node.dataset.ltxId = id;
      mergedAtoms[id] = {
        id,
        snippet,
        start: -1,
        end: -1,
        kind: "command"
      };
    }

    atomsById = mergedAtoms;
  }

  $: if (renderedExpression) {
    tick().then(() => {
      applyLeftRightDelimiterHoverMapping();
      updateFormulaScale();
    });
  } else {
    atomsById = baseAtomsById;
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
    if (noticeHideTimer !== null) {
      window.clearTimeout(noticeHideTimer);
      noticeHideTimer = null;
    }
  });
</script>

<section class="formula-stage">
  {#if effectiveExpression}
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
    <div class="formula-topic">{effectiveExpression.name}</div>
    <div class="formula-difficulty">{formatDifficulty(effectiveExpression.difficulty)}</div>
    <div class="formula-card">
      {#if poolRestartFlashVisible}
        <div class="formula-output formula-pool-restart-inline" role="status" aria-live="polite">
          ↻ pool reset
        </div>
      {:else}
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
          on:dblclick={handleDoubleClick}
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
              <code class="formula-hover-snippet" title={tooltipText}>{tooltipText}</code>
              <button type="button" class="formula-hover-copy text-option" on:click|stopPropagation={copyTooltipSnippet}>
                {tooltipCopied ? "copied" : "copy"}
              </button>
            </div>
          {/if}
        </div>
      {/if}
      {#if revealLatex}
        <div class="latex-reveal-wrap">
          <pre class="latex-reveal" on:dblclick={handleRevealDoubleClick}>{revealLatexValue}</pre>
          {#if copyNoticeVisible}
            <div class="formula-copy-notice" role="status">{copyNoticeText}</div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="formula-card empty">
      <p>No formula loaded. Press Start to begin.</p>
    </div>
  {/if}
</section>
