<script lang="ts">
  import ControlBar from "../ControlBar.svelte";
  import type { SessionSettings, TopicId } from "../../types";

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

  let toggled: TopicId[] = [];
  let selectedAllCount = 0;

  function handleTopicToggle(event: CustomEvent<TopicId>): void {
    toggled = [...toggled, event.detail];
  }

  function handleTopicSelectAll(): void {
    selectedAllCount += 1;
  }
</script>

<ControlBar
  {settings}
  status="running"
  {topics}
  {topicCounts}
  on:topicToggle={handleTopicToggle}
  on:topicSelectAll={handleTopicSelectAll}
/>

<div data-testid="toggled-value">{toggled.join(",")}</div>
<div data-testid="all-count">{selectedAllCount}</div>
