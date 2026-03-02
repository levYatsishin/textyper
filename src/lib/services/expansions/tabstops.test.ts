import { describe, expect, it } from "vitest";
import {
  getActiveTabstopRange,
  mergeNestedTabstopState,
  resolveTabstops,
  stepTabstop,
  updateTabstopStateAfterInput
} from "./tabstops";

describe("tabstop resolution", () => {
  it("parses numbered placeholders and default text", () => {
    const parsed = resolveTabstops("\\frac{$1}{${2:x}}$0");
    expect(parsed.text).toBe("\\frac{}{x}");
    expect(parsed.tabstops?.groups.map((group) => group.index)).toEqual([1, 2, 0]);
  });

  it("tracks linked placeholders under the same index", () => {
    const parsed = resolveTabstops("${1:n}+${1}+${2:m}");
    const firstGroup = parsed.tabstops?.groups[0];
    expect(firstGroup?.index).toBe(1);
    expect(firstGroup?.ranges.length).toBe(2);
    expect(parsed.text).toBe("n+n+m");
  });

  it("clamps at first/last tabstop instead of dropping state", () => {
    const parsed = resolveTabstops("${1:a}+${2:b}$0");
    const state = parsed.tabstops;
    expect(state).toBeTruthy();

    const firstSelection = getActiveTabstopRange(state);
    expect(firstSelection).toEqual({ start: 0, end: 1 });

    const step1 = stepTabstop(parsed.text, state, 1);
    expect(step1.state?.activeGroupIndex).toBe(1);

    const step2 = stepTabstop(step1.value, step1.state, 1);
    expect(step2.state?.activeGroupIndex).toBe(2);

    const step3 = stepTabstop(step2.value, step2.state, 1);
    expect(step3.state?.activeGroupIndex).toBe(2);
    expect(step3.selection).toEqual({ start: 3, end: 3 });

    const stepBack = stepTabstop(step3.value, step3.state, -1);
    expect(stepBack.state?.activeGroupIndex).toBe(1);

    const stepToFirst = stepTabstop(stepBack.value, stepBack.state, -1);
    expect(stepToFirst.state?.activeGroupIndex).toBe(0);

    const stepPastFirst = stepTabstop(stepToFirst.value, stepToFirst.state, -1);
    expect(stepPastFirst.state?.activeGroupIndex).toBe(0);
    expect(stepPastFirst.selection).toEqual({ start: 0, end: 1 });
  });

  it("updates active tabstop ranges after editing", () => {
    const parsed = resolveTabstops("${1:n}+${2:m}");
    const state = parsed.tabstops;
    expect(state).toBeTruthy();

    const updated = updateTabstopStateAfterInput(state, "n+m", "abc+m", 0, 1);
    expect(updated?.groups[0].ranges[0]).toEqual({ start: 0, end: 3 });
    expect(updated?.groups[1].ranges[0]).toEqual({ start: 4, end: 5 });
  });

  it("merges child tabstops into parent flow and keeps next parent groups", () => {
    const parent = resolveTabstops("\\int $0 \\, d${1:x} $2");
    const child = resolveTabstops("\\mathbf{$1}$0");
    expect(parent.tabstops).toBeTruthy();
    expect(child.tabstops).toBeTruthy();

    const parentRange = getActiveTabstopRange(parent.tabstops);
    expect(parentRange).toBeTruthy();

    const merged = mergeNestedTabstopState(
      parent.tabstops,
      child.tabstops,
      parentRange!.start,
      parentRange!.end,
      "\\mathbf{}".length
    );
    expect(merged).toBeTruthy();
    expect(merged?.groups.length).toBe(4);
    expect(merged?.activeGroupIndex).toBe(0);

    const first = getActiveTabstopRange(merged);
    expect(first).toEqual({ start: 8, end: 8 });

    const valueWithChild = `${parent.text.slice(0, parentRange!.start)}\\mathbf{}${parent.text.slice(parentRange!.end)}`;
    const step1 = stepTabstop(valueWithChild, merged, 1);
    expect(step1.state?.activeGroupIndex).toBe(1);

    const step2 = stepTabstop(step1.value, step1.state, 1);
    expect(step2.state?.activeGroupIndex).toBe(2);
    expect(step2.selection).toBeTruthy();
    expect(step2.selection?.start).toBeGreaterThanOrEqual(step1.selection?.start ?? 0);
    const selected = step2.value.slice(step2.selection!.start, step2.selection!.end);
    expect(selected).toBe("x");
  });
});
