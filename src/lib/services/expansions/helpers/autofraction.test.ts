import { describe, expect, it } from "vitest";
import { applyAutofraction } from "./autofraction";

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
    expect(mutation?.selectionStart).toBe("x+\\frac{1}{".length);
    expect(mutation?.tabstops).toBeTruthy();
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
});
