import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import ControlBar from "./ControlBar.svelte";
import ControlBarHarness from "./test-fixtures/ControlBarHarness.svelte";
import type { SessionSettings, TopicId } from "../types";

const settings: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulties: ["beginner", "intermediate", "advanced"],
  selectedTopicIds: ["algebra", "calculus"],
  selectedSubtopicsByTopic: {
    algebra: ["fundamentals"],
    calculus: ["integrals"]
  },
  revealLatex: false
};

const settingsAllTopicsPartial: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulties: ["beginner", "intermediate", "advanced"],
  selectedTopicIds: ["algebra", "calculus", "probability"],
  selectedSubtopicsByTopic: {
    algebra: ["fundamentals"],
    calculus: ["integrals"],
    probability: ["random variables"]
  },
  revealLatex: false
};

const topics = [
  { id: "algebra", label: "algebra", order: 1 },
  { id: "calculus", label: "calculus", order: 2 },
  { id: "probability", label: "probability", order: 3 }
];

const topicCounts: Record<TopicId, number> = {
  algebra: 12,
  calculus: 8,
  probability: 3
};

const topicSubtopicStats = {
  algebra: [{ label: "fundamentals", count: 12 }],
  calculus: [{ label: "integrals", count: 8 }],
  probability: [{ label: "random variables", count: 3 }]
};

describe("ControlBar topics menu", () => {
  it("disables mode buttons while session is running", async () => {
    render(ControlBar, {
      settings,
      status: "running",
      topics,
      topicCounts,
      topicSubtopicStats
    });

    expect(screen.getByRole("button", { name: "60" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "120" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "zen" }).hasAttribute("disabled")).toBe(true);
  });

  it("locks difficulties while timed session is running", async () => {
    render(ControlBar, {
      settings: {
        ...settings,
        mode: "timed"
      },
      status: "running",
      topics,
      topicCounts,
      topicSubtopicStats
    });

    expect(screen.getByRole("button", { name: "easy" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "medium" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "hard" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps difficulties enabled while zen is running", async () => {
    render(ControlBar, {
      settings: {
        ...settings,
        mode: "practice"
      },
      status: "running",
      topics,
      topicCounts,
      topicSubtopicStats
    });

    expect(screen.getByRole("button", { name: "easy" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "medium" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "hard" }).hasAttribute("disabled")).toBe(false);
  });

  it("enables mode buttons when session is ended", async () => {
    render(ControlBar, {
      settings,
      status: "ended",
      topics,
      topicCounts,
      topicSubtopicStats
    });

    expect(screen.getByRole("button", { name: "60" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "120" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "zen" }).hasAttribute("disabled")).toBe(false);
  });

  it("opens and closes the topics menu", async () => {
    render(ControlBar, {
      settings,
      topics,
      topicCounts,
      topicSubtopicStats
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    expect(screen.getByPlaceholderText(/search topics\.\.\./i)).toBeTruthy();

    await fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText(/search topics\.\.\./i)).toBeNull();
  });

  it("shows active difficulties above topics search", async () => {
    render(ControlBar, {
      settings,
      topics,
      topicCounts,
      topicSubtopicStats
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    expect(screen.getByPlaceholderText("search topics...")).toBeTruthy();

    const activeDifficulties = document.querySelector(".topics-active-difficulties");
    expect(activeDifficulties?.textContent).toContain("easy");
    expect(activeDifficulties?.textContent).toContain("medium");
    expect(activeDifficulties?.textContent).toContain("hard");
  });

  it("filters topic list by search text", async () => {
    render(ControlBar, {
      settings,
      topics,
      topicCounts,
      topicSubtopicStats
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    await fireEvent.input(screen.getByPlaceholderText(/search topics\.\.\./i), {
      target: { value: "calc" }
    });

    expect(screen.getByText("calculus")).toBeTruthy();
    expect(screen.queryByText("probability")).toBeNull();
  });

  it("filters topic list by subtopic search text", async () => {
    render(ControlBar, {
      settings,
      topics,
      topicCounts,
      topicSubtopicStats
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    await fireEvent.input(screen.getByPlaceholderText(/search topics\.\.\./i), {
      target: { value: "integral" }
    });

    expect(screen.getByText("calculus")).toBeTruthy();
    expect(screen.getByText("integrals")).toBeTruthy();
    expect(screen.queryByText("algebra")).toBeNull();
    expect(screen.queryByText("probability")).toBeNull();
  });

  it("emits topic events for item toggle and all action", async () => {
    render(ControlBarHarness);

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    const probabilityButton = screen.getByText("probability").closest("button");
    if (!probabilityButton) {
      throw new Error("Expected probability topic button");
    }
    await fireEvent.click(probabilityButton);
    await fireEvent.click(screen.getByRole("button", { name: "all" }));

    expect(screen.getByTestId("toggled-value").textContent).toBe("probability");
    expect(screen.getByTestId("all-count").textContent).toBe("1");
  });

  it("expands subtopics immediately on arrow click", async () => {
    render(ControlBar, {
      settings,
      topics,
      topicCounts,
      topicSubtopicStats
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    expect(screen.queryByText("fundamentals")).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Expand algebra" }));
    await tick();
    expect(screen.getByText("fundamentals")).toBeTruthy();
  });

  it("keeps all action enabled when topics are selected but subtopics are partial", async () => {
    render(ControlBar, {
      settings: settingsAllTopicsPartial,
      topics,
      topicCounts,
      topicSubtopicStats: {
        ...topicSubtopicStats,
        probability: [
          { label: "random variables", count: 2 },
          { label: "distributions", count: 1 }
        ]
      }
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    const allButton = screen.getByRole("button", { name: "all" });
    expect(allButton.hasAttribute("disabled")).toBe(false);
  });
});
