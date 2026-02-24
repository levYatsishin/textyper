import { render, screen } from "@testing-library/svelte";
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

  it("formats zen time as h:mm:ss after one hour", () => {
    render(InputLane, {
      status: "running",
      mode: "practice",
      elapsedMs: 3_661_000
    });

    expect(screen.getByText("1:01:01")).toBeTruthy();
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
});
