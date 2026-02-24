<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import katex from "katex";
  import { normalizeLatex } from "../services/matcher";
  import type { Mode, SessionStatus, SubmissionResult } from "../types";

  export let status: SessionStatus;
  export let mode: Mode = "practice";
  export let remainingMs: number | null = null;
  export let elapsedMs = 0;
  export let isSubmitting = false;
  export let lastResult: SubmissionResult | null = null;
  export let targetLatex = "";

  const dispatch = createEventDispatcher<{
    submit: string;
  }>();

  let value = "";
  let inputElement: HTMLTextAreaElement | null = null;
  let isAutoSubmitting = false;
  let lastFocusedTarget = "";

  function renderLivePreview(latex: string): string {
    if (!latex.trim()) {
      return "";
    }

    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: true });
    } catch {
      return "<span class='preview-error'>Invalid LaTeX</span>";
    }
  }

  async function autoSubmitIfCorrect(): Promise<void> {
    if (status !== "running" || isSubmitting || isAutoSubmitting) {
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
    void autoSubmitIfCorrect();
  }

  function formatZenElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  $: if (status === "running") {
    tick().then(() => inputElement?.focus());
  }

  $: if (status === "running" && targetLatex !== lastFocusedTarget) {
    lastFocusedTarget = targetLatex;
    tick().then(() => inputElement?.focus());
  }

  $: livePreview = renderLivePreview(value);
  $: hasPreview = value.trim().length > 0;
  $: runModeLabel = mode === "practice" ? "zen" : "timed";
  $: remainingSec = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
  $: runCounter = mode === "practice" ? formatZenElapsed(elapsedMs) : String(remainingSec);
</script>

<section class="input-lane">
  <textarea
    bind:this={inputElement}
    bind:value
    rows="3"
    placeholder={status === "running" ? "Type LaTeX here..." : "Start a session to begin typing"}
    on:input={onInput}
    disabled={status !== "running" || isSubmitting}
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
  <div class="preview-run-controls">
    <span class="preview-run-indicator">{runModeLabel}</span>
    <p class="preview-run-elapsed" class:preview-run-elapsed-zen={mode === "practice" && status === "running"}>
      {runCounter}
    </p>
  </div>

  {#if lastResult}
    <p class:last-good={lastResult.isCorrect} class:last-bad={!lastResult.isCorrect} class="last-result">
      {#if lastResult.isCorrect}
        Correct ({lastResult.strategy} match)
      {:else}
        Incorrect ({lastResult.strategy})
      {/if}
    </p>
  {/if}
</section>
