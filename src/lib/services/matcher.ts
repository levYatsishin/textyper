import html2canvas from "html2canvas";
import katex from "katex";
import pixelmatch from "pixelmatch";
import type { CompareLatexFn } from "../types";

const DEFAULT_TOLERANCE = 0.018;

type TokenType = "whitespace" | "commandWord" | "commandSymbol" | "char" | "removed";

interface Token {
  type: TokenType;
  value: string;
}

const COMMAND_ALIASES: Record<string, string> = {
  "\\le": "\\leq",
  "\\ge": "\\geq",
  "\\to": "\\rightarrow",
  "\\iff": "\\Leftrightarrow",
  "\\implies": "\\Rightarrow"
};

const SPACING_WORD_COMMANDS = new Set(["\\quad", "\\qquad"]);
const SPACING_SYMBOL_COMMANDS = new Set(["\\,", "\\;", "\\!", "\\:"]);

function isLetter(char: string): boolean {
  return /[A-Za-z]/.test(char);
}

function isAsciiLetterToken(token: Token): boolean {
  return token.type === "char" && /^[A-Za-z]$/.test(token.value);
}

function tokenizeLatex(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      let end = index + 1;
      while (end < input.length && /\s/.test(input[end])) {
        end += 1;
      }
      tokens.push({ type: "whitespace", value: input.slice(index, end) });
      index = end;
      continue;
    }

    if (char === "\\") {
      const next = input[index + 1];
      if (!next) {
        tokens.push({ type: "char", value: "\\" });
        index += 1;
        continue;
      }

      if (isLetter(next)) {
        let end = index + 2;
        while (end < input.length && isLetter(input[end])) {
          end += 1;
        }
        tokens.push({ type: "commandWord", value: input.slice(index, end) });
        index = end;
        continue;
      }

      tokens.push({ type: "commandSymbol", value: input.slice(index, index + 2) });
      index += 2;
      continue;
    }

    tokens.push({ type: "char", value: char });
    index += 1;
  }

  return tokens;
}

function applyCanonicalTransforms(tokens: Token[]): Token[] {
  return tokens.map((token) => {
    if (token.type === "commandWord") {
      const alias = COMMAND_ALIASES[token.value];
      const value = alias ?? token.value;
      if (SPACING_WORD_COMMANDS.has(value)) {
        return { type: "removed", value: "" };
      }
      return { ...token, value };
    }

    if (token.type === "commandSymbol" && SPACING_SYMBOL_COMMANDS.has(token.value)) {
      return { type: "removed", value: "" };
    }

    return token;
  });
}

function nextMeaningfulIndex(tokens: Token[], fromIndex: number): number {
  for (let index = fromIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].type !== "whitespace" && tokens[index].type !== "removed") {
      return index;
    }
  }
  return -1;
}

function shouldInsertCommandBoundary(tokens: Token[], commandIndex: number): boolean {
  let sawWhitespace = false;

  for (let index = commandIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "removed") {
      continue;
    }
    if (token.type === "whitespace") {
      sawWhitespace = true;
      continue;
    }
    return sawWhitespace && isAsciiLetterToken(token);
  }

  return false;
}

function buildCanonicalLatex(tokens: Token[]): string {
  let output = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "whitespace" || token.type === "removed") {
      continue;
    }

    if (token.type === "char" && (token.value === "_" || token.value === "^")) {
      const argumentIndex = nextMeaningfulIndex(tokens, index);
      if (argumentIndex === -1) {
        output += token.value;
        continue;
      }

      const argument = tokens[argumentIndex];
      if (argument.type === "char" && argument.value === "{") {
        output += token.value;
        continue;
      }

      if (argument.type === "commandWord" || argument.type === "commandSymbol" || argument.type === "char") {
        output += `${token.value}{${argument.value}}`;
        index = argumentIndex;
        continue;
      }

      output += token.value;
      continue;
    }

    output += token.value;

    if (token.type === "commandWord" && shouldInsertCommandBoundary(tokens, index)) {
      output += "{}";
    }
  }

  return output;
}

export function normalizeLatex(input: string): string {
  const tokens = tokenizeLatex(input);
  const canonicalTokens = applyCanonicalTransforms(tokens);
  return buildCanonicalLatex(canonicalTokens).trim();
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
