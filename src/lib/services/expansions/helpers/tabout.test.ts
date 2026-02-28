import { describe, expect, it } from "vitest";
import { applyTabout } from "./tabout";

describe("applyTabout", () => {
  it("moves cursor over closing symbol", () => {
    const mutation = applyTabout({
      value: "\\left(x\\right)",
      selectionStart: "\\left(x\\right".length,
      selectionEnd: "\\left(x\\right".length,
      closingSymbols: [")", "]", "}"]
    });

    expect(mutation).toEqual({
      value: "\\left(x\\right)",
      selectionStart: "\\left(x\\right)".length,
      selectionEnd: "\\left(x\\right)".length,
      tabstops: null
    });
  });

  it("does nothing when next char is not configured", () => {
    const mutation = applyTabout({
      value: "abc",
      selectionStart: 1,
      selectionEnd: 1,
      closingSymbols: [")", "]", "}"]
    });
    expect(mutation).toBeNull();
  });
});
