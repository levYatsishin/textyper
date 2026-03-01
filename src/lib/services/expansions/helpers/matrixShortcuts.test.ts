import { describe, expect, it } from "vitest";
import { applyMatrixShortcuts } from "./matrixShortcuts";

const ENVIRONMENTS = ["matrix", "aligned"];

describe("applyMatrixShortcuts", () => {
  it("inserts alignment separator on Tab inside matrix environment", () => {
    const value = "\\begin{matrix}a";
    const mutation = applyMatrixShortcuts({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      key: "Tab",
      environments: ENVIRONMENTS
    });

    expect(mutation?.value).toBe("\\begin{matrix}a & ");
    expect(mutation?.selectionStart).toBe("\\begin{matrix}a & ".length);
  });

  it("inserts row separator on Enter inside matrix environment", () => {
    const value = "\\begin{aligned}x &= y";
    const mutation = applyMatrixShortcuts({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      key: "Enter",
      environments: ENVIRONMENTS
    });

    expect(mutation?.value).toBe("\\begin{aligned}x &= y \\\\\n");
    expect(mutation?.selectionStart).toBe("\\begin{aligned}x &= y \\\\\n".length);
  });

  it("does nothing when cursor is outside configured environments", () => {
    const value = "x + y";
    const mutation = applyMatrixShortcuts({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      key: "Tab",
      environments: ENVIRONMENTS
    });

    expect(mutation).toBeNull();
  });
});
