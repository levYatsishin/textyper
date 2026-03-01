<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import katex from "katex";
  import { DEFAULT_EXPANSION_SETTINGS } from "../data/expansionsDefaults";
  import { applySnippetExpansions } from "../services/expansions/engine";
  import { applyAutoBrackets, applyPassiveAutoEnlarge } from "../services/expansions/helpers/autoBrackets";
  import { applyAutoEnlargeBrackets } from "../services/expansions/helpers/autoEnlargeBrackets";
  import { applyAutofraction } from "../services/expansions/helpers/autofraction";
  import { applyMatrixShortcuts } from "../services/expansions/helpers/matrixShortcuts";
  import { applyTabout } from "../services/expansions/helpers/tabout";
  import {
    getActiveTabstopRange,
    mergeNestedTabstopState,
    stepTabstop,
    updateTabstopStateAfterInput
  } from "../services/expansions/tabstops";
  import { normalizeLatex } from "../services/matcher";
  import { formatElapsedDuration } from "../services/statsDisplay";
  import type {
    CompiledSnippet,
    ExpansionMutation,
    ExpansionSettings,
    Mode,
    SessionStatus,
    SubmissionResult,
    TabstopState
  } from "../types";

  export let status: SessionStatus;
  export let mode: Mode = "practice";
  export let remainingMs: number | null = null;
  export let elapsedMs = 0;
  export let isSubmitting = false;
  export let inputLocked = false;
  export let focusNonce = 0;
  export let lastResult: SubmissionResult | null = null;
  export let targetLatex = "";
  export let expansionsEnabled = true;
  export let expansionSettings: ExpansionSettings = DEFAULT_EXPANSION_SETTINGS;
  export let compiledSnippets: CompiledSnippet[] = [];

  const dispatch = createEventDispatcher<{
    submit: string;
    activity: void;
  }>();

  let value = "";
  let inputElement: HTMLTextAreaElement | null = null;
  let isAutoSubmitting = false;
  let lastFocusedTarget = "";
  let lastAppliedFocusNonce = -1;
  let tabstopState: TabstopState | null = null;
  let previousInputValue = "";
  let previousSelectionStart = 0;
  let previousSelectionEnd = 0;

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

  function captureInputSnapshot(): void {
    previousInputValue = value;
    previousSelectionStart = inputElement?.selectionStart ?? value.length;
    previousSelectionEnd = inputElement?.selectionEnd ?? previousSelectionStart;
  }

  function isInputDisabled(): boolean {
    return status !== "running" || isSubmitting || inputLocked;
  }

  async function applyMutation(mutation: ExpansionMutation): Promise<void> {
    value = mutation.value;
    tabstopState = mutation.tabstops;
    await tick();
    if (!inputElement || inputElement.disabled) {
      return;
    }
    inputElement.focus();
    inputElement.setSelectionRange(mutation.selectionStart, mutation.selectionEnd);
  }

  async function handleTabKey(event: KeyboardEvent): Promise<void> {
    if (!expansionsEnabled || !inputElement) {
      return;
    }
    event.preventDefault();
    dispatch("activity");

    if (tabstopState) {
      const stepped = stepTabstop(value, tabstopState, event.shiftKey ? -1 : 1);
      tabstopState = stepped.state;
      if (stepped.value !== value) {
        value = stepped.value;
      }

      const activeRange = stepped.selection ?? getActiveTabstopRange(stepped.state);
      if (activeRange) {
        await tick();
        inputElement.focus();
        inputElement.setSelectionRange(activeRange.start, activeRange.end);
      }
      return;
    }

    if (!event.shiftKey && expansionSettings.helpers.matrixShortcutsEnabled) {
      const matrixMutation = applyMatrixShortcuts({
        value,
        selectionStart: inputElement.selectionStart ?? value.length,
        selectionEnd: inputElement.selectionEnd ?? value.length,
        key: "Tab",
        environments: expansionSettings.helpers.matrixShortcutEnvironments
      });
      if (matrixMutation) {
        await applyMutation(matrixMutation);
        return;
      }
    }

    if (expansionSettings.helpers.taboutEnabled) {
      const taboutMutation = applyTabout({
        value,
        selectionStart: inputElement.selectionStart ?? value.length,
        selectionEnd: inputElement.selectionEnd ?? value.length,
        closingSymbols: expansionSettings.helpers.taboutClosingSymbols
      });
      if (taboutMutation) {
        await applyMutation(taboutMutation);
        return;
      }
    }

    if (!event.shiftKey) {
      const manualExpansion = applySnippetExpansions(
        {
          value,
          selectionStart: inputElement.selectionStart ?? value.length,
          selectionEnd: inputElement.selectionEnd ?? value.length,
          snippets: compiledSnippets,
          wordDelimiters: expansionSettings.wordDelimiters
        },
        "manual",
        1
      );

      if (manualExpansion) {
        await applyMutation(manualExpansion);
        await autoSubmitIfCorrect();
      }
    }
  }

  async function handleEnterKey(event: KeyboardEvent): Promise<void> {
    if (!expansionsEnabled || !expansionSettings.helpers.matrixShortcutsEnabled || !inputElement) {
      return;
    }

    const matrixMutation = applyMatrixShortcuts({
      value,
      selectionStart: inputElement.selectionStart ?? value.length,
      selectionEnd: inputElement.selectionEnd ?? value.length,
      key: "Enter",
      environments: expansionSettings.helpers.matrixShortcutEnvironments
    });

    if (!matrixMutation) {
      return;
    }

    event.preventDefault();
    dispatch("activity");
    await applyMutation(matrixMutation);
  }

  async function handleBracketKey(event: KeyboardEvent): Promise<boolean> {
    if (
      !expansionsEnabled ||
      !expansionSettings.helpers.autoBracketPairingEnabled ||
      !inputElement ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing
    ) {
      return false;
    }

    const mutation = applyAutoBrackets({
      value,
      selectionStart: inputElement.selectionStart ?? value.length,
      selectionEnd: inputElement.selectionEnd ?? value.length,
      key: event.key,
      autoEnlargeEnabled: expansionSettings.helpers.autoEnlargeBracketsEnabled,
      autoEnlargeTriggers: expansionSettings.helpers.autoEnlargeTriggers
    });

    if (!mutation) {
      return false;
    }

    event.preventDefault();
    dispatch("activity");
    await applyMutation(mutation);
    await autoSubmitIfCorrect();
    return true;
  }

  async function runAutoExpansionPipeline(): Promise<void> {
    if (!expansionsEnabled || !inputElement) {
      return;
    }

    const selectionStart = inputElement.selectionStart ?? value.length;
    const selectionEnd = inputElement.selectionEnd ?? selectionStart;
    const baseInput = {
      value,
      selectionStart,
      selectionEnd,
      snippets: compiledSnippets,
      wordDelimiters: expansionSettings.wordDelimiters
    };

    const tryPassiveAutoEnlarge = async (): Promise<boolean> => {
      if (!expansionSettings.helpers.autoEnlargeBracketsEnabled || !inputElement) {
        return false;
      }
      const passiveMutation = applyPassiveAutoEnlarge({
        value,
        selectionStart: inputElement.selectionStart ?? value.length,
        selectionEnd: inputElement.selectionEnd ?? value.length,
        autoEnlargeEnabled: expansionSettings.helpers.autoEnlargeBracketsEnabled,
        autoEnlargeTriggers: expansionSettings.helpers.autoEnlargeTriggers
      });
      if (!passiveMutation) {
        return false;
      }
      await applyMutation(passiveMutation);
      return true;
    };

    if (expansionSettings.helpers.autofractionEnabled) {
      const autofractionMutation = applyAutofraction({
        value: baseInput.value,
        selectionStart: baseInput.selectionStart,
        selectionEnd: baseInput.selectionEnd,
        symbol: expansionSettings.helpers.autofractionSymbol,
        breakingChars: expansionSettings.helpers.autofractionBreakingChars,
        autoEnlargeEnabled: expansionSettings.helpers.autoEnlargeBracketsEnabled,
        autoEnlargeTriggers: expansionSettings.helpers.autoEnlargeTriggers
      });
      if (autofractionMutation) {
        await applyMutation(autofractionMutation);
        await tryPassiveAutoEnlarge();
        return;
      }
    }

    const tabstopsBeforeAuto = tabstopState;
    const valueBeforeAuto = value;
    const autoSnippetMutation = applySnippetExpansions(baseInput, "auto", 2);
    if (autoSnippetMutation) {
      const matchStart = autoSnippetMutation.matchStart ?? baseInput.selectionStart;
      const matchEnd = autoSnippetMutation.matchEnd ?? baseInput.selectionEnd;
      const insertedLength = autoSnippetMutation.value.length - (valueBeforeAuto.length - (matchEnd - matchStart));
      const preservedTabstops = mergeNestedTabstopState(
        tabstopsBeforeAuto,
        autoSnippetMutation.tabstops,
        matchStart,
        matchEnd,
        insertedLength
      );
      const mergedMutation =
        preservedTabstops && preservedTabstops.groups.length > 0
          ? {
              ...autoSnippetMutation,
              tabstops: preservedTabstops
            }
          : autoSnippetMutation;

      await applyMutation(mergedMutation);
      await tryPassiveAutoEnlarge();
      return;
    }

    if (await tryPassiveAutoEnlarge()) {
      return;
    }

    if (expansionSettings.helpers.autoEnlargeBracketsEnabled) {
      const autoEnlargeMutation = applyAutoEnlargeBrackets({
        value: baseInput.value,
        selectionStart: baseInput.selectionStart,
        selectionEnd: baseInput.selectionEnd,
        triggers: expansionSettings.helpers.autoEnlargeTriggers
      });
      if (autoEnlargeMutation) {
        await applyMutation(autoEnlargeMutation);
      }
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
    tabstopState = null;
    await tick();
    inputElement?.focus();
    isAutoSubmitting = false;
  }

  async function onInput(event: Event): Promise<void> {
    const inputEvent = event as InputEvent;
    const inputType = typeof inputEvent.inputType === "string" ? inputEvent.inputType : "";
    const isDeleteInput = inputType.startsWith("delete");

    value = (event.currentTarget as HTMLTextAreaElement).value;
    if (expansionsEnabled && tabstopState) {
      tabstopState = updateTabstopStateAfterInput(
        tabstopState,
        previousInputValue,
        value,
        previousSelectionStart,
        previousSelectionEnd
      );
    }
    dispatch("activity");
    if (!isDeleteInput) {
      await runAutoExpansionPipeline();
    }
    void autoSubmitIfCorrect();
  }

  async function onKeydown(event: KeyboardEvent): Promise<void> {
    captureInputSnapshot();
    if (isInputDisabled()) {
      return;
    }

    const handledBracket = await handleBracketKey(event);
    if (handledBracket) {
      return;
    }

    if (event.key === "Tab") {
      await handleTabKey(event);
      return;
    }

    if (event.key === "Enter") {
      await handleEnterKey(event);
      return;
    }
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

  $: if (status !== "running") {
    tabstopState = null;
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
    on:keydown={onKeydown}
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
