import type { ExpansionMutation } from "../../../types";
import { getActiveTabstopRange, offsetTabstopState, resolveTabstops } from "../tabstops";

interface AutoEnlargeInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  triggers: string[];
}

const TRIGGER_REPLACEMENTS: Record<string, string> = {
  "lr(": "\\left($1\\right)$0",
  "lr[": "\\left[$1\\right]$0",
  "lr{": "\\left\\{$1\\right\\}$0",
  "lr|": "\\left|$1\\right|$0"
};

export function applyAutoEnlargeBrackets(input: AutoEnlargeInput): ExpansionMutation | null {
  const { value, selectionStart, selectionEnd, triggers } = input;
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const enabledTriggers = [...new Set(triggers)].sort((left, right) => right.length - left.length);
  const before = value.slice(0, selectionStart);

  for (const trigger of enabledTriggers) {
    if (!before.endsWith(trigger)) {
      continue;
    }

    const template = TRIGGER_REPLACEMENTS[trigger];
    if (!template) {
      continue;
    }

    const start = selectionStart - trigger.length;
    const parsed = resolveTabstops(template);
    const tabstops = offsetTabstopState(parsed.tabstops, start);
    const nextValue = `${value.slice(0, start)}${parsed.text}${value.slice(selectionEnd)}`;
    const selection = getActiveTabstopRange(tabstops);
    const cursor = start + parsed.text.length;

    return {
      value: nextValue,
      selectionStart: selection?.start ?? cursor,
      selectionEnd: selection?.end ?? cursor,
      tabstops
    };
  }

  return null;
}
