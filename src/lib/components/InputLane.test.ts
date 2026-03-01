import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXPANSION_SETTINGS } from "../data/expansionsDefaults";
import type { CompiledSnippet } from "../types";
import InputLane from "./InputLane.svelte";

function createSnippet(partial: Partial<CompiledSnippet>): CompiledSnippet {
  return {
    id: "snippet",
    trigger: "",
    triggerSource: "",
    replacement: "",
    options: {
      auto: false,
      regex: false,
      visual: false,
      wordBoundary: false,
      modes: {
        text: false,
        math: false,
        blockMath: false,
        inlineMath: false,
        code: false
      }
    },
    priority: 0,
    description: "",
    triggerKey: null,
    ...partial
  };
}

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

  it("expands non-auto snippets on Tab in running session", async () => {
    const compiledSnippets = [
      createSnippet({
        id: "manual-fraction",
        trigger: "fr",
        triggerSource: "fr",
        replacement: "\\frac{$1}{$2}$0",
        options: {
          auto: false,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      compiledSnippets
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "fr";
    await fireEvent.input(textarea);
    textarea.setSelectionRange(2, 2);

    await fireEvent.keyDown(textarea, { key: "Tab" });

    expect(textarea.value).toBe("\\frac{}{}");
  });

  it("traverses tabstops with Tab and Shift+Tab", async () => {
    const compiledSnippets = [
      createSnippet({
        id: "manual-linked",
        trigger: "tt",
        triggerSource: "tt",
        replacement: "${1:a}+${2:b}$0",
        options: {
          auto: false,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      compiledSnippets
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "tt";
    await fireEvent.input(textarea);
    textarea.setSelectionRange(2, 2);

    await fireEvent.keyDown(textarea, { key: "Tab" });
    const firstStart = textarea.selectionStart;
    const firstEnd = textarea.selectionEnd;
    expect(textarea.value).toBe("a+b");
    expect(firstStart).toBe(0);
    expect(firstEnd).toBe(1);

    await fireEvent.keyDown(textarea, { key: "Tab" });
    const secondStart = textarea.selectionStart;
    const secondEnd = textarea.selectionEnd;
    expect(secondStart).toBe(2);
    expect(secondEnd).toBe(3);

    await fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(1);
  });

  it("expands lim with tab order n -> infty -> tail", async () => {
    const compiledSnippets = [
      createSnippet({
        id: "auto-lim",
        trigger: "lim",
        triggerSource: "lim",
        replacement: "\\lim_{${1:n} \\to ${2:\\infty}} $0",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      compiledSnippets
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "lim";
    textarea.setSelectionRange(3, 3);
    await fireEvent.input(textarea);

    expect(textarea.value).toBe("\\lim_{n \\to \\infty} ");
    const nStart = textarea.value.indexOf("n");
    expect(textarea.selectionStart).toBe(nStart);
    expect(textarea.selectionEnd).toBe(nStart + 1);

    await fireEvent.keyDown(textarea, { key: "Tab" });
    const infStart = textarea.value.indexOf("\\infty");
    expect(textarea.selectionStart).toBe(infStart);
    expect(textarea.selectionEnd).toBe(infStart + "\\infty".length);

    await fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it("auto-pairs brackets from keyboard input", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 0);

    await fireEvent.keyDown(textarea, { key: "(" });

    expect(textarea.value).toBe("()");
    expect(textarea.selectionStart).toBe(1);
    expect(textarea.selectionEnd).toBe(1);
  });

  it("does not auto-pair brackets when autopair helper is disabled", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      expansionSettings: {
        ...DEFAULT_EXPANSION_SETTINGS,
        helpers: {
          ...DEFAULT_EXPANSION_SETTINGS.helpers,
          autoBracketPairingEnabled: false
        }
      }
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 0);

    await fireEvent.keyDown(textarea, { key: "(" });

    expect(textarea.value).toBe("");
  });

  it("expands // into an empty fraction via snippets", async () => {
    const compiledSnippets = [
      createSnippet({
        id: "auto-fraction-snippet",
        trigger: "//",
        triggerSource: "//",
        replacement: "\\frac{$1}{$2}$0",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      compiledSnippets
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "/";
    textarea.setSelectionRange(1, 1);
    await fireEvent.input(textarea);

    textarea.value = "//";
    textarea.setSelectionRange(2, 2);
    await fireEvent.input(textarea);

    expect(textarea.value).toBe("\\frac{}{}");
  });

  it("auto-enlarges brackets after autofraction inside paired delimiters", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "(1/)";
    textarea.setSelectionRange(3, 3);
    await fireEvent.input(textarea);

    expect(textarea.value).toBe("\\left(\\frac{1}{}\\right)");
  });

  it("auto-enlarges bracket pair when closing key is pressed", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "(\\sum)";
    await fireEvent.input(textarea);
    textarea.setSelectionRange("(\\sum".length, "(\\sum".length);

    await fireEvent.keyDown(textarea, { key: ")" });

    expect(textarea.value).toBe("\\left(\\sum\\right)");
    expect(textarea.selectionStart).toBe("\\left(\\sum\\right)".length);
    expect(textarea.selectionEnd).toBe("\\left(\\sum\\right)".length);
  });

  it("auto-enlarges when typing ends before an existing closing bracket", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "(\\sum)";
    textarea.setSelectionRange("(\\sum".length, "(\\sum".length);
    await fireEvent.input(textarea);

    expect(textarea.value).toBe("\\left(\\sum\\right)");
    expect(textarea.selectionStart).toBe("\\left(\\sum".length);
    expect(textarea.selectionEnd).toBe("\\left(\\sum".length);
  });

  it("does not run auto expansion pipeline on delete input", async () => {
    const { container } = render(InputLane, {
      status: "running",
      mode: "practice"
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "_{n}";
    textarea.setSelectionRange(3, 3);
    await fireEvent.input(textarea);

    textarea.value = "_{}";
    textarea.setSelectionRange(2, 2);
    await fireEvent.input(textarea, { inputType: "deleteContentBackward" });

    expect(textarea.value).toBe("_{}");
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
  });

  it("keeps parent tabstop flow after nested auto expansion inside int template", async () => {
    const compiledSnippets = [
      createSnippet({
        id: "auto-int",
        trigger: "int",
        triggerSource: "int",
        replacement: "\\int $1 \\, d$2 $0",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      }),
      createSnippet({
        id: "auto-bf",
        trigger: "bf",
        triggerSource: "bf",
        replacement: "\\mathbf{$1}$0",
        options: {
          auto: true,
          regex: false,
          visual: false,
          wordBoundary: false,
          modes: { text: false, math: false, blockMath: false, inlineMath: false, code: false }
        }
      })
    ];

    const { container } = render(InputLane, {
      status: "running",
      mode: "practice",
      compiledSnippets
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "int";
    textarea.setSelectionRange(3, 3);
    await fireEvent.input(textarea);

    expect(textarea.value).toContain("\\int");
    expect(textarea.value).toContain("\\, d");

    const insertAt = textarea.selectionStart;
    textarea.value = `${textarea.value.slice(0, insertAt)}bf${textarea.value.slice(insertAt)}`;
    textarea.setSelectionRange(insertAt + 2, insertAt + 2);
    await fireEvent.input(textarea);

    expect(textarea.value).toContain("\\mathbf{}");
    const beforeTab = textarea.selectionStart;

    await fireEvent.keyDown(textarea, { key: "Tab" });

    const boldEnd = textarea.value.indexOf("\\mathbf{}") + "\\mathbf{}".length;
    expect(textarea.selectionStart).toBeGreaterThan(beforeTab);
    expect(textarea.selectionStart).toBeGreaterThanOrEqual(boldEnd);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);

    const afterChildTab = textarea.selectionStart;
    await fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.selectionStart).toBeGreaterThan(afterChildTab);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);
  });
});
