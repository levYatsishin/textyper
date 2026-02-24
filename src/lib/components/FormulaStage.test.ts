import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FormulaStage from "./FormulaStage.svelte";
import type { Expression } from "../types";

const expression: Expression = {
  id: "hover-test",
  latex: "a+b",
  difficulty: "beginner",
  complexityScore: 12,
  complexityBand: "beginner",
  name: "Simple Sum",
  topics: ["algebra"],
  subtopics: ["fundamentals"]
};

describe("FormulaStage hover tooltip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows tooltip with snippet on hover", async () => {
    const { container } = render(FormulaStage, { expression, revealLatex: false });
    const atom = container.querySelector("[data-ltx-id]") as HTMLElement;
    expect(atom).toBeTruthy();

    await fireEvent.pointerOver(atom, { pointerType: "mouse", clientX: 20, clientY: 20 });
    const snippetNode = container.querySelector(".formula-hover-snippet");

    expect(snippetNode).toBeTruthy();
    expect(["a", "+", "b"]).toContain((snippetNode?.textContent ?? "").trim());
  });

  it("copies current snippet text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    const { container, getByRole } = render(FormulaStage, { expression, revealLatex: false });
    const atom = container.querySelector("[data-ltx-id]") as HTMLElement;
    await fireEvent.pointerOver(atom, { pointerType: "mouse", clientX: 20, clientY: 20 });

    const snippetText = (container.querySelector(".formula-hover-snippet")?.textContent ?? "").trim();
    await fireEvent.click(getByRole("button", { name: "copy" }));

    expect(writeText).toHaveBeenCalledWith(snippetText);
  });

  it("hides tooltip on pointer leave", async () => {
    const { container } = render(FormulaStage, { expression, revealLatex: false });
    const atom = container.querySelector("[data-ltx-id]") as HTMLElement;
    const output = container.querySelector(".formula-output") as HTMLElement;

    await fireEvent.pointerOver(atom, { pointerType: "mouse", clientX: 10, clientY: 10 });
    expect(container.querySelector(".formula-hover-popout")).toBeTruthy();

    await fireEvent.pointerLeave(output, { pointerType: "mouse" });
    expect(container.querySelector(".formula-hover-popout")).toBeNull();
  });

  it("opens on touch long press and ignores short tap", async () => {
    vi.useFakeTimers();

    const first = render(FormulaStage, { expression, revealLatex: false });
    const firstAtom = first.container.querySelector("[data-ltx-id]") as HTMLElement;
    await fireEvent.pointerDown(firstAtom, { pointerType: "touch", pointerId: 1, clientX: 16, clientY: 18 });
    vi.advanceTimersByTime(100);
    await fireEvent.pointerUp(firstAtom, { pointerType: "touch", pointerId: 1, clientX: 16, clientY: 18 });
    vi.advanceTimersByTime(400);
    await tick();
    expect(first.container.querySelector(".formula-hover-popout")).toBeNull();

    const second = render(FormulaStage, { expression, revealLatex: false });
    const secondAtom = second.container.querySelector("[data-ltx-id]") as HTMLElement;
    await fireEvent.pointerDown(secondAtom, { pointerType: "touch", pointerId: 2, clientX: 24, clientY: 22 });
    vi.advanceTimersByTime(380);
    await tick();
    expect(second.container.querySelector(".formula-hover-popout")).toBeTruthy();
  });

  it("closes tooltip on Escape", async () => {
    const { container } = render(FormulaStage, { expression, revealLatex: false });
    const atom = container.querySelector("[data-ltx-id]") as HTMLElement;

    await fireEvent.pointerOver(atom, { pointerType: "mouse", clientX: 20, clientY: 20 });
    expect(container.querySelector(".formula-hover-popout")).toBeTruthy();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".formula-hover-popout")).toBeNull();
  });
});
