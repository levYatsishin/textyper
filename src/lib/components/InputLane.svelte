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
  import { addKatexLineBreakHints } from "../services/katexLineBreaks";
  import type {
    CompiledSnippet,
    ExpansionMutation,
    ExpansionSettings,
    Mode,
    SessionStatus,
    SubmissionResult,
    TabstopState
  } from "../types";

  interface InputSnapshot {
    value: string;
    selectionStart: number;
    selectionEnd: number;
    tabstops: TabstopState | null;
  }

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
  let previousTabstopState: TabstopState | null = null;
  let undoStack: InputSnapshot[] = [];
  let redoStack: InputSnapshot[] = [];
  let lastCommittedSnapshot: InputSnapshot = {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    tabstops: null
  };
  const INPUT_HISTORY_LIMIT = 200;

  function renderLivePreview(latex: string): string {
    if (!latex.trim()) {
      return "";
    }

    try {
      const rendered = katex.renderToString(latex, { displayMode: true, throwOnError: true });
      return addKatexLineBreakHints(rendered);
    } catch {
      return "<span class='preview-error'>Invalid LaTeX</span>";
    }
  }

  function captureInputSnapshot(): void {
    previousInputValue = value;
    previousSelectionStart = inputElement?.selectionStart ?? value.length;
    previousSelectionEnd = inputElement?.selectionEnd ?? previousSelectionStart;
    previousTabstopState = cloneTabstopState(tabstopState);
  }

  function cloneTabstopState(state: TabstopState | null): TabstopState | null {
    if (!state) {
      return null;
    }

    return {
      groups: state.groups.map((group) => ({
        index: group.index,
        ranges: group.ranges.map((range) => ({ start: range.start, end: range.end }))
      })),
      activeGroupIndex: state.activeGroupIndex
    };
  }

  function createSnapshot(): InputSnapshot {
    return {
      value,
      selectionStart: inputElement?.selectionStart ?? value.length,
      selectionEnd: inputElement?.selectionEnd ?? value.length,
      tabstops: cloneTabstopState(tabstopState)
    };
  }

  function snapshotsEqual(left: InputSnapshot, right: InputSnapshot): boolean {
    return left.value === right.value && left.selectionStart === right.selectionStart && left.selectionEnd === right.selectionEnd;
  }

  function cloneSnapshot(snapshot: InputSnapshot): InputSnapshot {
    return {
      value: snapshot.value,
      selectionStart: snapshot.selectionStart,
      selectionEnd: snapshot.selectionEnd,
      tabstops: cloneTabstopState(snapshot.tabstops)
    };
  }

  function pushUndoSnapshot(snapshot: InputSnapshot): void {
    const top = undoStack[undoStack.length - 1];
    if (top && snapshotsEqual(top, snapshot)) {
      return;
    }
    undoStack = [...undoStack, snapshot];
    if (undoStack.length > INPUT_HISTORY_LIMIT) {
      undoStack = undoStack.slice(undoStack.length - INPUT_HISTORY_LIMIT);
    }
  }

  async function restoreSnapshot(snapshot: InputSnapshot): Promise<void> {
    value = snapshot.value;
    tabstopState = cloneTabstopState(snapshot.tabstops);
    await tick();
    if (!inputElement || inputElement.disabled) {
      return;
    }
    inputElement.focus();
    inputElement.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    lastCommittedSnapshot = cloneSnapshot(snapshot);
  }

  function isInputDisabled(): boolean {
    return status !== "running" || isSubmitting || inputLocked;
  }

  async function applyMutation(
    mutation: ExpansionMutation,
    options?: {
      recordUndo?: boolean;
      undoCheckpoint?: InputSnapshot;
      clearRedo?: boolean;
    }
  ): Promise<void> {
    const recordUndo = options?.recordUndo ?? true;
    if (recordUndo && mutation.value !== value) {
      pushUndoSnapshot(options?.undoCheckpoint ?? createSnapshot());
      if (options?.clearRedo ?? true) {
        redoStack = [];
      }
    }

    value = mutation.value;
    tabstopState = mutation.tabstops;
    await tick();
    if (!inputElement || inputElement.disabled) {
      return;
    }
    inputElement.focus();
    inputElement.setSelectionRange(mutation.selectionStart, mutation.selectionEnd);
    lastCommittedSnapshot = createSnapshot();
  }

  async function handleTabKey(event: KeyboardEvent): Promise<void> {
    if (!expansionsEnabled || !inputElement || !expansionSettings.helpers.taboutEnabled) {
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
      lastCommittedSnapshot = createSnapshot();
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
    const undoCheckpoint = createSnapshot();
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
      await applyMutation(passiveMutation, { undoCheckpoint });
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
        await applyMutation(autofractionMutation, { undoCheckpoint });
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

      await applyMutation(mergedMutation, { undoCheckpoint });
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
        await applyMutation(autoEnlargeMutation, { undoCheckpoint });
      }
    }
  }

  async function handleUndoRedoKey(event: KeyboardEvent): Promise<boolean> {
    if (!inputElement) {
      return false;
    }

    const key = event.key.toLowerCase();
    const hasModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (!hasModifier) {
      return false;
    }

    const isUndo = key === "z" && !event.shiftKey;
    const isRedo = (key === "z" && event.shiftKey) || key === "y";
    if (!isUndo && !isRedo) {
      return false;
    }

    if (isUndo) {
      if (undoStack.length === 0) {
        return false;
      }
      event.preventDefault();
      const current = createSnapshot();
      const target = undoStack[undoStack.length - 1];
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, current];
      await restoreSnapshot(target);
      dispatch("activity");
      return true;
    }

    if (redoStack.length === 0) {
      return false;
    }

    event.preventDefault();
    const current = createSnapshot();
    const target = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    pushUndoSnapshot(current);
    await restoreSnapshot(target);
    dispatch("activity");
    return true;
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
    lastCommittedSnapshot = {
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      tabstops: null
    };
    await tick();
    inputElement?.focus();
    isAutoSubmitting = false;
  }

  async function onInput(event: Event): Promise<void> {
    const inputEvent = event as InputEvent;
    const inputType = typeof inputEvent.inputType === "string" ? inputEvent.inputType : "";
    const isDeleteInput = inputType.startsWith("delete");
    const nextValue = (event.currentTarget as HTMLTextAreaElement).value;
    const priorSnapshot = cloneSnapshot(lastCommittedSnapshot);
    const changedByUser = nextValue !== priorSnapshot.value;
    if (changedByUser) {
      pushUndoSnapshot({
        value: priorSnapshot.value,
        selectionStart: priorSnapshot.selectionStart,
        selectionEnd: priorSnapshot.selectionEnd,
        tabstops: cloneTabstopState(priorSnapshot.tabstops)
      });
      redoStack = [];
    }
    value = nextValue;
    if (expansionsEnabled && tabstopState) {
      tabstopState = updateTabstopStateAfterInput(
        tabstopState,
        priorSnapshot.value,
        value,
        priorSnapshot.selectionStart,
        priorSnapshot.selectionEnd
      );
    }
    dispatch("activity");
    if (!isDeleteInput) {
      await runAutoExpansionPipeline();
    }
    void autoSubmitIfCorrect();
    lastCommittedSnapshot = createSnapshot();
  }

  async function onKeydown(event: KeyboardEvent): Promise<void> {
    captureInputSnapshot();
    if (isInputDisabled()) {
      return;
    }

    const key = event.key.toLowerCase();
    const isUndoRedoKey = (event.ctrlKey || event.metaKey) && !event.altKey && (key === "z" || key === "y");
    if (isUndoRedoKey) {
      const handledUndoRedo = await handleUndoRedoKey(event);
      if (handledUndoRedo) {
        return;
      }
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
    undoStack = [];
    redoStack = [];
    lastCommittedSnapshot = {
      value,
      selectionStart: 0,
      selectionEnd: 0,
      tabstops: null
    };
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
