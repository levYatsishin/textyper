import { describe, expect, it } from "vitest";
import {
  getActiveTabstopRange,
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

  it("steps forward and exits after last tabstop", () => {
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
    expect(step3.state).toBeNull();
  });

  it("updates active tabstop ranges after editing", () => {
    const parsed = resolveTabstops("${1:n}+${2:m}");
    const state = parsed.tabstops;
    expect(state).toBeTruthy();

    const updated = updateTabstopStateAfterInput(state, "n+m", "abc+m", 0, 1);
    expect(updated?.groups[0].ranges[0]).toEqual({ start: 0, end: 3 });
    expect(updated?.groups[1].ranges[0]).toEqual({ start: 4, end: 5 });
  });
});
