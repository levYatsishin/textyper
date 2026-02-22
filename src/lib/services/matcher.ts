import html2canvas from "html2canvas";
import katex from "katex";
import pixelmatch from "pixelmatch";
import type { CompareLatexFn } from "../types";

const DEFAULT_TOLERANCE = 0.018;

export function normalizeLatex(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

function createRenderHost(label: string): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-render-host", label);
  host.style.position = "fixed";
  host.style.top = "-10000px";
  host.style.left = "-10000px";
  host.style.padding = "12px";
  host.style.background = "#ffffff";
  host.style.color = "#000000";
  host.style.fontSize = "40px";
  host.style.whiteSpace = "nowrap";
  host.style.zIndex = "-1";
  return host;
}

function createCanvasFromElement(element: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to initialize 2D canvas context.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(element, 0, 0);
  return canvas;
}

export async function compareRenderedLatex(inputLatex: string, targetLatex: string): Promise<number> {
  if (typeof document === "undefined") {
    throw new Error("Rendered comparison requires a browser document.");
  }

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "-10000px";
  wrapper.style.left = "-10000px";
  wrapper.style.pointerEvents = "none";
  document.body.appendChild(wrapper);

  const inputHost = createRenderHost("input");
  const targetHost = createRenderHost("target");
  wrapper.appendChild(inputHost);
  wrapper.appendChild(targetHost);

  try {
    katex.render(inputLatex, inputHost, { throwOnError: true, displayMode: true });
    katex.render(targetLatex, targetHost, { throwOnError: true, displayMode: true });

    const [inputCanvasRaw, targetCanvasRaw] = await Promise.all([
      html2canvas(inputHost, { backgroundColor: "#ffffff", scale: 1, logging: false }),
      html2canvas(targetHost, { backgroundColor: "#ffffff", scale: 1, logging: false })
    ]);

    const width = Math.max(inputCanvasRaw.width, targetCanvasRaw.width);
    const height = Math.max(inputCanvasRaw.height, targetCanvasRaw.height);

    if (width === 0 || height === 0) {
      return 1;
    }

    const inputCanvas = createCanvasFromElement(inputCanvasRaw, width, height);
    const targetCanvas = createCanvasFromElement(targetCanvasRaw, width, height);

    const inputContext = inputCanvas.getContext("2d");
    const targetContext = targetCanvas.getContext("2d");
    const diffContext = document.createElement("canvas").getContext("2d");

    if (!inputContext || !targetContext || !diffContext) {
      throw new Error("Unable to read canvas image data.");
    }

    const inputPixels = inputContext.getImageData(0, 0, width, height).data;
    const targetPixels = targetContext.getImageData(0, 0, width, height).data;
    const diffPixels = diffContext.createImageData(width, height);

    const mismatchCount = pixelmatch(inputPixels, targetPixels, diffPixels.data, width, height, {
      threshold: 0.1,
      includeAA: true
    });

    return mismatchCount / (width * height);
  } finally {
    wrapper.remove();
  }
}

export const compareLatex: CompareLatexFn = async (inputLatex, targetLatex, options) => {
  const normalizedInput = normalizeLatex(inputLatex);
  const normalizedTarget = normalizeLatex(targetLatex);

  if (normalizedInput.length === 0 || normalizedTarget.length === 0) {
    return {
      isMatch: false,
      mismatchRatio: 1,
      strategy: "fail"
    };
  }

  if (normalizedInput === normalizedTarget) {
    return {
      isMatch: true,
      mismatchRatio: 0,
      strategy: "exact"
    };
  }

  const compareFn = options?.renderComparator ?? compareRenderedLatex;
  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE;

  try {
    const mismatchRatio = await compareFn(inputLatex, targetLatex);
    return {
      isMatch: mismatchRatio <= tolerance,
      mismatchRatio,
      strategy: "render"
    };
  } catch {
    return {
      isMatch: false,
      mismatchRatio: 1,
      strategy: "fail"
    };
  }
};
