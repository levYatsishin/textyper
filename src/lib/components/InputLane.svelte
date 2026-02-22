<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import katex from "katex";
  import type { SessionStatus, SubmissionResult } from "../types";

  export let status: SessionStatus;
  export let isSubmitting = false;
  export let lastResult: SubmissionResult | null = null;

  const dispatch = createEventDispatcher<{
    submit: string;
    skip: void;
  }>();

  let value = "";
  let inputElement: HTMLTextAreaElement | null = null;

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

  async function submitValue(): Promise<void> {
    if (status !== "running" || isSubmitting) {
      return;
    }
    dispatch("submit", value);
    value = "";
    await tick();
    inputElement?.focus();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitValue();
    }
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
    on:keydown={onKeyDown}
    disabled={status !== "running" || isSubmitting}
  ></textarea>

  <div class="lane-actions">
    <button type="button" class="btn strong" on:click={submitValue} disabled={status !== "running" || isSubmitting}>
      Submit
    </button>
    <button type="button" class="btn subtle" on:click={() => dispatch("skip")} disabled={status !== "running" || isSubmitting}>
      Skip
    </button>
  </div>

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
