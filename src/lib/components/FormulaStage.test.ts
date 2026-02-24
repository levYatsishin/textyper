import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FormulaStage from "./FormulaStage.svelte";
import { buildInstrumentedRender } from "../services/latexHoverMap";
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

  it("copies snippet on double click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    const { container } = render(FormulaStage, { expression, revealLatex: false });
    const atom = container.querySelector("[data-ltx-id]") as HTMLElement;
    expect(atom).toBeTruthy();

    await fireEvent.dblClick(atom, { clientX: 20, clientY: 20 });
    expect(writeText).toHaveBeenCalledWith("a");
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

  it("prefers styled command snippet over inner symbol", async () => {
    const styledExpression: Expression = {
      ...expression,
      id: "hover-style-test",
      latex: "\\Delta \\mathbf{x} = r \\mathbf{v}"
    };
    const { container } = render(FormulaStage, { expression: styledExpression, revealLatex: false });
    const symbolNodes = Array.from(container.querySelectorAll<HTMLElement>("[data-ltx-id]")).filter(
      (node) => node.textContent?.trim() === "v"
    );
    const vNode = symbolNodes.at(-1);
    expect(vNode).toBeTruthy();

    await fireEvent.pointerOver(vNode!, { pointerType: "mouse", clientX: 30, clientY: 20 });
    const snippetNode = container.querySelector(".formula-hover-snippet");

    expect(snippetNode?.textContent?.trim()).toBe("\\mathbf{v}");
  });

  it("prefers operatorname snippet over letter token", async () => {
    const opExpression: Expression = {
      ...expression,
      id: "hover-operator-test",
      latex: "\\operatorname{Conv}_h(z)"
    };
    const { container } = render(FormulaStage, { expression: opExpression, revealLatex: false });
    const convLetter = Array.from(container.querySelectorAll<HTMLElement>("[data-ltx-id]")).find(
      (node) => node.textContent?.trim() === "C"
    );
    expect(convLetter).toBeTruthy();

    await fireEvent.pointerOver(convLetter!, { pointerType: "mouse", clientX: 24, clientY: 24 });
    const snippetNode = container.querySelector(".formula-hover-snippet");

    expect(snippetNode?.textContent?.trim()).toContain("\\operatorname{Conv}");
  });

  it("shows hover tooltip inside align environment formula", async () => {
    const alignExpression: Expression = {
      ...expression,
      id: "hover-align-test",
      latex: "\\begin{align} x &= \\frac{1 - s^2}{1 + s^2} \\\\[5pt] y &= \\frac{2s}{1 + s^2} \\end{align}"
    };
    const { container } = render(FormulaStage, { expression: alignExpression, revealLatex: false });
    const symbolS = Array.from(container.querySelectorAll<HTMLElement>("[data-ltx-id]")).find(
      (node) => node.textContent?.trim() === "s"
    );
    expect(symbolS).toBeTruthy();

    await fireEvent.pointerOver(symbolS!, { pointerType: "mouse", clientX: 35, clientY: 35 });
    const snippetNode = container.querySelector(".formula-hover-snippet");
    expect(snippetNode).toBeTruthy();
  });

  it("shows hover tooltip for spaced left/right limit formula", async () => {
    const limitExpression: Expression = {
      ...expression,
      id: "hover-limit-test",
      latex: "\\lim_{x \\to \\infty} \\left (1 + \\frac{1}{x} \\right)^x = e"
    };
    const { container } = render(FormulaStage, { expression: limitExpression, revealLatex: false });
    const atom = container.querySelector<HTMLElement>("[data-ltx-id]");
    expect(atom).toBeTruthy();

    await fireEvent.pointerOver(atom!, { pointerType: "mouse", clientX: 32, clientY: 28 });
    const snippetNode = container.querySelector(".formula-hover-snippet");
    expect(snippetNode).toBeTruthy();
  });

  it("shows scripted lambda snippet for KKT formula", async () => {
    const kktExpression: Expression = {
      ...expression,
      id: "hover-kkt-test",
      latex: "0=\\nabla_{x}L(x^{*},\\lambda^{*})=\\nabla f(x^{*})-\\sum \\limits_{i\\in A(x^{*})}\\lambda_{i}^{*}\\nabla c_{i}(x^{*})"
    };
    const { container } = render(FormulaStage, { expression: kktExpression, revealLatex: false });
    const lambdaNode = Array.from(container.querySelectorAll<HTMLElement>("[data-ltx-id]")).find(
      (node) => node.textContent?.trim() === "\u03bb"
    );
    expect(lambdaNode).toBeTruthy();

    await fireEvent.pointerOver(lambdaNode!, { pointerType: "mouse", clientX: 30, clientY: 30 });
    const snippetNode = container.querySelector(".formula-hover-snippet");
    expect(snippetNode?.textContent?.trim()).toContain("\\lambda");
  });

  it("shows hover tooltip for integral operator", async () => {
    const integralExpression: Expression = {
      ...expression,
      id: "hover-int-test",
      latex: "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"
    };
    const instrumented = buildInstrumentedRender(integralExpression.latex);
    const integralAtom = Object.values(instrumented.atomsById).find((atom) => atom.snippet.includes("\\int"));
    expect(integralAtom).toBeTruthy();

    const { container } = render(FormulaStage, { expression: integralExpression, revealLatex: false });
    const integralNode = container.querySelector<HTMLElement>(`[data-ltx-id=\"${integralAtom!.id}\"]`);
    expect(integralNode).toBeTruthy();

    await fireEvent.pointerOver(integralNode!, { pointerType: "mouse", clientX: 30, clientY: 30 });
    const snippetNode = container.querySelector(".formula-hover-snippet");
    expect(snippetNode?.textContent?.trim()).toContain("\\int");
  });
});
