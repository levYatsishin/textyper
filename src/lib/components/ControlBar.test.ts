import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ControlBar from "./ControlBar.svelte";
import ControlBarHarness from "./test-fixtures/ControlBarHarness.svelte";
import type { SessionSettings, TopicId } from "../types";

const settings: SessionSettings = {
  mode: "practice",
  durationSec: 60,
  difficulties: ["beginner", "intermediate", "advanced"],
  selectedTopicIds: ["algebra", "calculus"],
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

describe("ControlBar topics menu", () => {
  it("opens and closes the topics menu", async () => {
    render(ControlBar, {
      settings,
      status: "running",
      topics,
      topicCounts
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    expect(screen.getByPlaceholderText("search topics...")).toBeTruthy();

    await fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText("search topics...")).toBeNull();
  });

  it("filters topic list by search text", async () => {
    render(ControlBar, {
      settings,
      status: "running",
      topics,
      topicCounts
    });

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    await fireEvent.input(screen.getByPlaceholderText("search topics..."), {
      target: { value: "calc" }
    });

    expect(screen.getByText("calculus")).toBeTruthy();
    expect(screen.queryByText("probability")).toBeNull();
  });

  it("emits topic events for item toggle and all action", async () => {
    render(ControlBarHarness);

    await fireEvent.click(screen.getByRole("button", { name: "topics" }));
    await fireEvent.click(screen.getByRole("button", { name: /probability/i }));
    await fireEvent.click(screen.getByRole("button", { name: "all" }));

    expect(screen.getByTestId("toggled-value").textContent).toBe("probability");
    expect(screen.getByTestId("all-count").textContent).toBe("1");
  });
});
