import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import InputLane from "./InputLane.svelte";

describe("InputLane run controls", () => {
  it("renders one centered run mode label above one elapsed timer", () => {
    const { container } = render(InputLane, {
      status: "ended",
      mode: "practice",
      elapsedMs: 65_000
    });

    const controls = container.querySelector(".preview-run-controls");
    const indicator = container.querySelector(".preview-run-indicator");
    const elapsed = container.querySelector(".preview-run-elapsed");
    const allElapsed = container.querySelectorAll(".preview-run-elapsed");

    expect(controls).toBeTruthy();
    expect(indicator).toBeTruthy();
    expect(elapsed).toBeTruthy();
    expect(allElapsed.length).toBe(1);
    expect(controls?.contains(elapsed as Node)).toBe(true);
    expect(elapsed?.previousElementSibling).toBe(indicator);
    expect(screen.getByText("zen")).toBeTruthy();
  });

  it("formats zen time as mm:ss under one hour", () => {
    render(InputLane, {
      status: "running",
      mode: "practice",
      elapsedMs: 65_000
    });

    expect(screen.getByText("01:05")).toBeTruthy();
  });

  it("formats zen time as hh:mm:ss after one hour", () => {
    render(InputLane, {
      status: "running",
      mode: "practice",
      elapsedMs: 3_661_000
    });

    expect(screen.getByText("01:01:01")).toBeTruthy();
  });

  it("formats zen time as d:hh:mm:ss after one day", () => {
    render(InputLane, {
      status: "running",
      mode: "practice",
      elapsedMs: 97_261_000
    });

    expect(screen.getByText("1d:03:01:01")).toBeTruthy();
  });

  it("shows timed label with seconds counter", () => {
    render(InputLane, {
      status: "running",
      mode: "timed",
      remainingMs: 61_000
    });

    expect(screen.getByText("timed")).toBeTruthy();
    expect(screen.getByText("61")).toBeTruthy();
  });

  it("shows skipped result label for empty-input fail", () => {
    render(InputLane, {
      status: "running",
      mode: "practice",
      lastResult: {
        isCorrect: false,
        strategy: "fail",
        mismatchRatio: 1,
        inputLatex: "",
        targetLatex: "x+y"
      }
    });

    expect(screen.getByText("Skipped (fail)")).toBeTruthy();
  });

  it("injects line-break hints for long live preview formulas", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    textarea.value =
      "\\hat{y}=\\hat{f}(x)=\\frac{\\sum_{i=1}^{m} \\tau_{i} \\hat{y}_{i}}{\\sum_{i=1}^{m} \\tau_{i}}=\\sum_{i=1}^{m} \\tau_{i}^{*}\\hat{y}_{i}".repeat(
        3
      );
    await fireEvent.input(textarea);

    const preview = container.querySelector(".preview-output") as HTMLElement;
    expect(preview.querySelector("wbr")).toBeTruthy();
  });

  it("auto-submits when typed form is canonically equivalent to target", async () => {
    const target = "\\mathbf{p}_{n}=\\nabla f(\\mathbf{a_{n}})";
    const typed = "\\mathbf{p}_n=\\nabla f(\\mathbf{a_n})";

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      targetLatex: target
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    textarea.value = typed;
    await fireEvent.input(textarea);

    expect(textarea.value).toBe("");
  });
});
