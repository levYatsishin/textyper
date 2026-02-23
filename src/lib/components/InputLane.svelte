<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import katex from "katex";
  import { normalizeLatex } from "../services/matcher";
  import type { SessionStatus, SubmissionResult } from "../types";

  export let status: SessionStatus;
  export let isSubmitting = false;
  export let lastResult: SubmissionResult | null = null;
  export let targetLatex = "";

  const dispatch = createEventDispatcher<{
    submit: string;
  }>();

  let value = "";
  let inputElement: HTMLTextAreaElement | null = null;
  let isAutoSubmitting = false;

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

  $: if (status === "running") {
    tick().then(() => inputElement?.focus());
  }

  $: livePreview = renderLivePreview(value);
  $: hasPreview = value.trim().length > 0;
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
