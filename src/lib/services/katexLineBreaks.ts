const SOFT_BREAK_SELECTOR = ".mbin, .mrel, .mpunct, .mclose";
const HARD_BREAK_BASE_TEXT_THRESHOLD = 24;
const HARD_BREAK_STEP = 2;

function insertWbrAfter(node: Element): void {
  if (!node.parentNode) {
    return;
  }
  const next = node.nextSibling;
  if (next && next.nodeName === "WBR") {
    return;
  }
  node.parentNode.insertBefore(document.createElement("wbr"), next);
}

export function addKatexLineBreakHints(renderedHtml: string): string {
  if (!renderedHtml || typeof document === "undefined") {
    return renderedHtml;
  }

  const root = document.createElement("div");
  root.innerHTML = renderedHtml;
  const katexHtml = root.querySelector(".katex-html");
  if (!katexHtml) {
    return renderedHtml;
  }

  const bases = Array.from(katexHtml.querySelectorAll<HTMLElement>(".base"));
  for (const base of bases) {
    insertWbrAfter(base);
  }

  const softBreakNodes = Array.from(katexHtml.querySelectorAll<HTMLElement>(SOFT_BREAK_SELECTOR));
  for (const node of softBreakNodes) {
    insertWbrAfter(node);
  }

  for (const base of bases) {
    const textLength = (base.textContent ?? "").replace(/\s+/g, "").length;
    if (textLength <= HARD_BREAK_BASE_TEXT_THRESHOLD) {
      continue;
    }

    const directChildren = Array.from(base.children).filter((child) => !child.classList.contains("strut"));
    if (directChildren.length < 2) {
      continue;
    }

    for (let index = HARD_BREAK_STEP; index < directChildren.length; index += HARD_BREAK_STEP) {
      const target = directChildren[index];
      if (!target.parentNode) {
        continue;
      }
      const prev = target.previousSibling;
      if (prev && prev.nodeName === "WBR") {
        continue;
      }
      target.parentNode.insertBefore(document.createElement("wbr"), target);
    }
  }

  return root.innerHTML;
}
