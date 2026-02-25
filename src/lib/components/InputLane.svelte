<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import katex from "katex";
  import { normalizeLatex } from "../services/matcher";
  import { formatElapsedDuration } from "../services/statsDisplay";
  import type { Mode, SessionStatus, SubmissionResult } from "../types";

  export let status: SessionStatus;
  export let mode: Mode = "practice";
  export let remainingMs: number | null = null;
  export let elapsedMs = 0;
  export let isSubmitting = false;
  export let inputLocked = false;
  export let focusNonce = 0;
  export let lastResult: SubmissionResult | null = null;
  export let targetLatex = "";

  const dispatch = createEventDispatcher<{
    submit: string;
    activity: void;
  }>();

  let value = "";
  let inputElement: HTMLTextAreaElement | null = null;
  let isAutoSubmitting = false;
  let lastFocusedTarget = "";
  let lastAppliedFocusNonce = -1;

  const SOFT_BREAK_SELECTOR = ".mbin, .mrel, .mpunct, .mclose";
  const HARD_BREAK_BASE_TEXT_THRESHOLD = 24;
  const HARD_BREAK_STEP = 2;

  function insertWbrAfter(node: Element): void {
    if (!node.parentNode) {
      return;
    }
    const next = node.nextSibling;
    if (next && next.nodeName === "WBR") {
      return;
    }
    node.parentNode.insertBefore(document.createElement("wbr"), next);
  }

  function addPreviewBreakpoints(renderedHtml: string): string {
    if (!renderedHtml || typeof document === "undefined") {
      return renderedHtml;
    }

    const root = document.createElement("div");
    root.innerHTML = renderedHtml;
    const katexHtml = root.querySelector(".katex-html");
    if (!katexHtml) {
      return renderedHtml;
    }

    const bases = Array.from(katexHtml.querySelectorAll<HTMLElement>(".base"));
    for (const base of bases) {
      insertWbrAfter(base);
    }

    const softBreakNodes = Array.from(katexHtml.querySelectorAll<HTMLElement>(SOFT_BREAK_SELECTOR));
    for (const node of softBreakNodes) {
      insertWbrAfter(node);
    }

    for (const base of bases) {
      const textLength = (base.textContent ?? "").replace(/\s+/g, "").length;
      if (textLength <= HARD_BREAK_BASE_TEXT_THRESHOLD) {
        continue;
      }

      const directChildren = Array.from(base.children).filter((child) => !child.classList.contains("strut"));
      if (directChildren.length < 2) {
        continue;
      }

      for (let index = HARD_BREAK_STEP; index < directChildren.length; index += HARD_BREAK_STEP) {
        const target = directChildren[index];
        if (!target.parentNode) {
          continue;
        }
        const prev = target.previousSibling;
        if (prev && prev.nodeName === "WBR") {
          continue;
        }
        target.parentNode.insertBefore(document.createElement("wbr"), target);
      }
    }

    return root.innerHTML;
  }

  function renderLivePreview(latex: string): string {
    if (!latex.trim()) {
      return "";
    }

    try {
      const rendered = katex.renderToString(latex, { displayMode: true, throwOnError: true });
      return addPreviewBreakpoints(rendered);
    } catch {
      return "<span class='preview-error'>Invalid LaTeX</span>";
    }
  }

  async function autoSubmitIfCorrect(): Promise<void> {
    if (status !== "running" || isSubmitting || inputLocked || isAutoSubmitting) {
      return;
    }
    const typed = normalizeLatex(value);
    const target = normalizeLatex(targetLatex);
    if (!typed || !target || typed !== target) {
      return;
    }

    isAutoSubmitting = true;
    dispatch("submit", value);
    value = "";
    await tick();
    inputElement?.focus();
    isAutoSubmitting = false;
  }

  function onInput(event: Event): void {
    value = (event.currentTarget as HTMLTextAreaElement).value;
    dispatch("activity");
    void autoSubmitIfCorrect();
  }

  $: if (status === "running") {
    tick().then(() => inputElement?.focus());
  }

  $: if (status === "running" && targetLatex !== lastFocusedTarget) {
    lastFocusedTarget = targetLatex;
    tick().then(() => inputElement?.focus());
  }

  $: if (status === "running" && !inputLocked && focusNonce !== lastAppliedFocusNonce) {
    lastAppliedFocusNonce = focusNonce;
    tick().then(() => {
      if (inputElement && !inputElement.disabled) {
        inputElement.focus();
      }
    });
  }

  $: livePreview = renderLivePreview(value);
  $: hasPreview = value.trim().length > 0;
  $: runModeLabel = mode === "practice" ? "zen" : "timed";
  $: remainingSec = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
  $: runCounter = mode === "practice" ? formatElapsedDuration(elapsedMs) : String(remainingSec);
  $: wasSkipped = !!lastResult && !lastResult.isCorrect && lastResult.inputLatex.trim().length === 0;
</script>

<section class="input-lane">
  <textarea
    bind:this={inputElement}
    bind:value
    rows="3"
    placeholder={status === "running" ? "Type LaTeX here..." : "Start a session to begin typing"}
    on:input={onInput}
    disabled={status !== "running" || isSubmitting || inputLocked}
  ></textarea>

  <div class="live-preview" aria-live="polite">
    <p class="preview-label">Live preview</p>
    {#if hasPreview}
      <div class="preview-output">
        {@html livePreview}
      </div>
    {:else}
      <p class="preview-placeholder">start typing...</p>
    {/if}
  </div>
  {#if lastResult}
    <p class:last-good={lastResult.isCorrect} class:last-bad={!lastResult.isCorrect} class="last-result">
      {#if lastResult.isCorrect}
        Correct ({lastResult.strategy} match)
      {:else if wasSkipped}
        Skipped ({lastResult.strategy})
      {:else}
        Incorrect ({lastResult.strategy})
      {/if}
    </p>
  {/if}

  <div class="preview-run-controls">
    <span class="preview-run-indicator">{runModeLabel}</span>
    <p class="preview-run-elapsed" class:preview-run-elapsed-zen={mode === "practice" && status === "running"}>
      {runCounter}
    </p>
  </div>
</section>
