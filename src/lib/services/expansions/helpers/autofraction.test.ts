import { describe, expect, it } from "vitest";
import { applyAutofraction } from "./autofraction";
import { stepTabstop } from "../tabstops";

describe("applyAutofraction", () => {
  it("expands numerator before slash into fraction", () => {
    const mutation = applyAutofraction({
      value: "x+1/",
      selectionStart: 4,
      selectionEnd: 4,
      symbol: "\\frac",
      breakingChars: "+-=,;:"
    });

    expect(mutation?.value).toBe("x+\\frac{1}{}");
    expect(mutation?.selectionStart).toBe("x+\\frac{1".length);
    expect(mutation?.selectionEnd).toBe("x+\\frac{1".length);
    expect(mutation?.tabstops).toBeTruthy();

    const denominatorStep = stepTabstop(mutation?.value ?? "", mutation?.tabstops ?? null, 1);
    expect(denominatorStep.selection).toEqual({
      start: "x+\\frac{1}{".length,
      end: "x+\\frac{1}{".length
    });
  });

  it("does nothing without slash at cursor", () => {
    const mutation = applyAutofraction({
      value: "x+1",
      selectionStart: 3,
      selectionEnd: 3,
      symbol: "\\frac",
      breakingChars: "+-=,;:"
    });
    expect(mutation).toBeNull();
  });

  it("expands double slash into an empty fraction", () => {
    const mutation = applyAutofraction({
      value: "//",
      selectionStart: 2,
      selectionEnd: 2,
      symbol: "\\frac",
      breakingChars: "+-=,;:"
    });

    expect(mutation?.value).toBe("\\frac{}{}");
  });

  it("keeps unmatched leading delimiter outside fraction", () => {
    const mutation = applyAutofraction({
      value: "(1/)",
      selectionStart: 3,
      selectionEnd: 3,
      symbol: "\\frac",
      breakingChars: "+-=,;:"
    });

    expect(mutation?.value).toBe("(\\frac{1}{})");
  });

  it("does not expand a single slash inside empty paired delimiters", () => {
    const mutation = applyAutofraction({
      value: "(/)",
      selectionStart: 2,
      selectionEnd: 2,
      symbol: "\\frac",
      breakingChars: "+-=,;:"
    });

    expect(mutation).toBeNull();
  });

  it("auto-enlarges surrounding delimiters when fraction trigger is enabled", () => {
    const mutation = applyAutofraction({
      value: "(1/)",
      selectionStart: 3,
      selectionEnd: 3,
      symbol: "\\frac",
      breakingChars: "+-=,;:",
      autoEnlargeEnabled: true,
      autoEnlargeTriggers: ["\\sum", "\\int", "\\frac"]
    });

    expect(mutation?.value).toBe("\\left(\\frac{1}{}\\right)");
  });
});
