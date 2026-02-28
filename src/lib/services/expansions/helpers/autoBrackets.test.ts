import { describe, expect, it } from "vitest";
import { applyAutoBrackets, applyPassiveAutoEnlarge } from "./autoBrackets";

describe("applyAutoBrackets", () => {
  const triggers = ["\\sum", "\\int", "\\frac", "\\prod", "\\bigcup", "\\bigcap"];

  it("auto-pairs opening brackets and places cursor inside", () => {
    const mutation = applyAutoBrackets({
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      key: "(",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("()");
    expect(mutation?.selectionStart).toBe(1);
    expect(mutation?.selectionEnd).toBe(1);
  });

  it("wraps current selection with matching brackets", () => {
    const mutation = applyAutoBrackets({
      value: "abc",
      selectionStart: 1,
      selectionEnd: 2,
      key: "[",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("a[b]c");
    expect(mutation?.selectionStart).toBe(2);
    expect(mutation?.selectionEnd).toBe(3);
  });

  it("skips over existing closing delimiter", () => {
    const mutation = applyAutoBrackets({
      value: "\\frac{a}{b})",
      selectionStart: "\\frac{a}{b}".length,
      selectionEnd: "\\frac{a}{b}".length,
      key: ")",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("\\frac{a}{b})");
    expect(mutation?.selectionStart).toBe("\\frac{a}{b})".length);
    expect(mutation?.selectionEnd).toBe("\\frac{a}{b})".length);
  });

  it("auto-enlarges paired delimiters on closing skip", () => {
    const mutation = applyAutoBrackets({
      value: "(\\sum)",
      selectionStart: "(\\sum".length,
      selectionEnd: "(\\sum".length,
      key: ")",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("\\left(\\sum\\right)");
    expect(mutation?.selectionStart).toBe("\\left(\\sum\\right)".length);
    expect(mutation?.selectionEnd).toBe("\\left(\\sum\\right)".length);
  });

  it("does not auto-enlarge grouped braces", () => {
    const mutation = applyAutoBrackets({
      value: "{x}",
      selectionStart: "{x".length,
      selectionEnd: "{x".length,
      key: "}",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("{x}");
    expect(mutation?.selectionStart).toBe("{x}".length);
    expect(mutation?.selectionEnd).toBe("{x}".length);
  });

  it("does not auto-pair after left/right command", () => {
    const mutation = applyAutoBrackets({
      value: "\\left",
      selectionStart: "\\left".length,
      selectionEnd: "\\left".length,
      key: "(",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation).toBeNull();
  });

  it("passively auto-enlarges when cursor sits before a closing delimiter", () => {
    const mutation = applyPassiveAutoEnlarge({
      value: "(\\sum)",
      selectionStart: "(\\sum".length,
      selectionEnd: "(\\sum".length,
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation?.value).toBe("\\left(\\sum\\right)");
    expect(mutation?.selectionStart).toBe("\\left(\\sum\\right)".length);
    expect(mutation?.selectionEnd).toBe("\\left(\\sum\\right)".length);
  });

  it("does not enlarge when no trigger command is inside", () => {
    const mutation = applyPassiveAutoEnlarge({
      value: "(s)",
      selectionStart: "(s".length,
      selectionEnd: "(s".length,
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: triggers
    });

    expect(mutation).toBeNull();
  });
});
