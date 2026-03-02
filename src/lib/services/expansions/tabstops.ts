import type { TabstopGroup, TabstopRange, TabstopState } from "../../types";

interface ParsedTabstops {
  text: string;
  tabstops: TabstopState | null;
}

function cloneRange(range: TabstopRange): TabstopRange {
  return { start: range.start, end: range.end };
}

function cloneState(state: TabstopState): TabstopState {
  return {
    activeGroupIndex: state.activeGroupIndex,
    groups: state.groups.map((group) => ({
      index: group.index,
      ranges: group.ranges.map(cloneRange)
    }))
  };
}

function shiftRanges(state: TabstopState, from: number, delta: number): void {
  if (delta === 0) {
    return;
  }

  state.groups.forEach((group) => {
    group.ranges.forEach((range) => {
      if (range.start >= from) {
        range.start += delta;
        range.end += delta;
      } else if (range.end >= from) {
        range.end += delta;
      }
    });
  });
}

function parseBracePlaceholder(template: string, start: number): { content: string; end: number } | null {
  let cursor = start + 2;
  let escaped = false;
  let content = "";

  while (cursor < template.length) {
    const char = template[cursor];
    if (!escaped && char === "}") {
      return { content, end: cursor + 1 };
    }

    if (!escaped && char === "\\") {
      escaped = true;
      content += char;
      cursor += 1;
      continue;
    }

    escaped = false;
    content += char;
    cursor += 1;
  }

  return null;
}

function parseSimplePlaceholder(template: string, start: number): { index: number; end: number } | null {
  let cursor = start + 1;
  let digits = "";
  while (cursor < template.length && /\d/.test(template[cursor])) {
    digits += template[cursor];
    cursor += 1;
  }

  if (digits.length === 0) {
    return null;
  }

  return {
    index: Number.parseInt(digits, 10),
    end: cursor
  };
}

function parseTabstopPlaceholder(
  template: string,
  start: number
): { index: number; defaultValue: string; end: number } | null {
  if (template[start] !== "$") {
    return null;
  }

  if (template[start + 1] === "{") {
    const parsed = parseBracePlaceholder(template, start);
    if (!parsed) {
      return null;
    }
    const match = parsed.content.match(/^(\d+)(?::([\s\S]*))?$/);
    if (!match) {
      return null;
    }
    return {
      index: Number.parseInt(match[1], 10),
      defaultValue: match[2] ?? "",
      end: parsed.end
    };
  }

  const simple = parseSimplePlaceholder(template, start);
  if (!simple) {
    return null;
  }
  return {
    index: simple.index,
    defaultValue: "",
    end: simple.end
  };
}

function orderedTabstopIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)];
}

export function resolveTabstops(template: string): ParsedTabstops {
  let output = "";
  let cursor = 0;
  const initialValues = new Map<number, string>();
  const ranges = new Map<number, TabstopRange[]>();

  while (cursor < template.length) {
    const char = template[cursor];
    if (char === "\\" && template[cursor + 1] === "$") {
      output += "$";
      cursor += 2;
      continue;
    }

    if (char !== "$") {
      output += char;
      cursor += 1;
      continue;
    }

    const parsed = parseTabstopPlaceholder(template, cursor);
    if (!parsed) {
      output += char;
      cursor += 1;
      continue;
    }

    const value = initialValues.has(parsed.index) ? initialValues.get(parsed.index)! : parsed.defaultValue;
    if (!initialValues.has(parsed.index)) {
      initialValues.set(parsed.index, value);
    }

    const rangeStart = output.length;
    output += value;
    const rangeEnd = output.length;
    const list = ranges.get(parsed.index) ?? [];
    list.push({ start: rangeStart, end: rangeEnd });
    ranges.set(parsed.index, list);
    cursor = parsed.end;
  }

  if (ranges.size === 0) {
    return {
      text: output,
      tabstops: null
    };
  }

  const groups: TabstopGroup[] = orderedTabstopIndexes([...ranges.keys()]).map((index) => ({
    index,
    ranges: (ranges.get(index) ?? []).map(cloneRange)
  }));

  return {
    text: output,
    tabstops: {
      groups,
      activeGroupIndex: 0
    }
  };
}

export function offsetTabstopState(state: TabstopState | null, offset: number): TabstopState | null {
  if (!state) {
    return null;
  }

  const next = cloneState(state);
  shiftRanges(next, 0, offset);
  return next;
}

export function shiftTabstopState(state: TabstopState | null, from: number, delta: number): TabstopState | null {
  if (!state || delta === 0) {
    return state ? cloneState(state) : null;
  }

  const next = cloneState(state);
  shiftRanges(next, from, delta);
  return next;
}

export function mergeNestedTabstopState(
  parentState: TabstopState | null,
  childState: TabstopState | null,
  matchStart: number,
  matchEnd: number,
  insertedLength: number
): TabstopState | null {
  if (!parentState && !childState) {
    return null;
  }

  if (!parentState) {
    return childState ? cloneState(childState) : null;
  }

  const activeParentIndex = Math.max(0, Math.min(parentState.activeGroupIndex, parentState.groups.length - 1));
  const delta = insertedLength - (matchEnd - matchStart);
  const shiftedParent = shiftTabstopState(parentState, matchEnd, delta);
  if (!shiftedParent) {
    return childState ? cloneState(childState) : null;
  }

  const parentBefore = shiftedParent.groups.slice(0, activeParentIndex);
  const parentAfter = shiftedParent.groups.slice(activeParentIndex + 1);

  if (!childState || childState.groups.length === 0) {
    return shiftedParent.groups.length > 0 ? shiftedParent : null;
  }

  const childClone = cloneState(childState);
  const groups = [...parentBefore, ...childClone.groups, ...parentAfter];

  return {
    groups,
    activeGroupIndex: parentBefore.length + childClone.activeGroupIndex
  };
}

export function getActiveTabstopRange(state: TabstopState | null): TabstopRange | null {
  if (!state || state.groups.length === 0) {
    return null;
  }
  const group = state.groups[state.activeGroupIndex];
  if (!group || group.ranges.length === 0) {
    return null;
  }
  return group.ranges[0];
}

function syncActiveLinkedRanges(value: string, state: TabstopState): { value: string; state: TabstopState } {
  const nextState = cloneState(state);
  const activeGroup = nextState.groups[nextState.activeGroupIndex];
  if (!activeGroup || activeGroup.ranges.length <= 1) {
    return { value, state: nextState };
  }

  const primaryRange = activeGroup.ranges[0];
  const primaryText = value.slice(primaryRange.start, primaryRange.end);
  let nextValue = value;

  for (let rangeIndex = 1; rangeIndex < activeGroup.ranges.length; rangeIndex += 1) {
    const range = activeGroup.ranges[rangeIndex];
    const before = nextValue.slice(0, range.start);
    const after = nextValue.slice(range.end);
    const previousLength = range.end - range.start;
    nextValue = `${before}${primaryText}${after}`;
    const delta = primaryText.length - previousLength;
    const replacementEnd = range.start + primaryText.length;
    range.end = replacementEnd;
    shiftRanges(nextState, replacementEnd, delta);
  }

  return { value: nextValue, state: nextState };
}

export function stepTabstop(
  value: string,
  state: TabstopState | null,
  direction: 1 | -1
): { value: string; state: TabstopState | null; selection: TabstopRange | null } {
  if (!state || state.groups.length === 0) {
    return { value, state: null, selection: null };
  }

  const synced = syncActiveLinkedRanges(value, state);
  const currentIndex = synced.state.activeGroupIndex;
  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= synced.state.groups.length) {
    return {
      value: synced.value,
      state: synced.state,
      selection: getActiveTabstopRange(synced.state)
    };
  }

  const nextState = cloneState(synced.state);
  nextState.activeGroupIndex = nextIndex;
  return {
    value: synced.value,
    state: nextState,
    selection: getActiveTabstopRange(nextState)
  };
}

export function updateTabstopStateAfterInput(
  state: TabstopState | null,
  previousValue: string,
  nextValue: string,
  previousSelectionStart: number,
  previousSelectionEnd: number
): TabstopState | null {
  if (!state) {
    return null;
  }

  const nextState = cloneState(state);
  const activeGroup = nextState.groups[nextState.activeGroupIndex];
  if (!activeGroup || activeGroup.ranges.length === 0) {
    return nextState;
  }

  const primaryRange = activeGroup.ranges[0];
  const selectionTouchesPrimary =
    previousSelectionStart >= primaryRange.start &&
    previousSelectionEnd <= primaryRange.end &&
    previousSelectionEnd >= previousSelectionStart;

  if (!selectionTouchesPrimary) {
    return nextState;
  }

  const delta = nextValue.length - previousValue.length;
  if (delta === 0) {
    return nextState;
  }

  const oldPrimaryEnd = primaryRange.end;
  shiftRanges(nextState, oldPrimaryEnd, delta);
  primaryRange.end = Math.max(primaryRange.start, oldPrimaryEnd + delta);

  return nextState;
}
