import { describe, expect, it } from "vitest";
import { applyAutoEnlargeBrackets } from "./autoEnlargeBrackets";

describe("applyAutoEnlargeBrackets", () => {
  it("expands configured trigger into left-right delimiters with tabstops", () => {
    const value = "lr(";
    const mutation = applyAutoEnlargeBrackets({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      triggers: ["lr(", "lr["]
    });

    expect(mutation?.value).toBe("\\left(\\right)");
    expect(mutation?.selectionStart).toBe("\\left(".length);
    expect(mutation?.selectionEnd).toBe("\\left(".length);
    expect(mutation?.tabstops).toBeTruthy();
  });

  it("does nothing when no trigger is matched", () => {
    const mutation = applyAutoEnlargeBrackets({
      value: "abc",
      selectionStart: 3,
      selectionEnd: 3,
      triggers: ["lr(", "lr["]
    });

    expect(mutation).toBeNull();
  });

  it("does nothing when text is selected", () => {
    const mutation = applyAutoEnlargeBrackets({
      value: "lr(",
      selectionStart: 0,
      selectionEnd: 3,
      triggers: ["lr("]
    });

    expect(mutation).toBeNull();
  });
});
