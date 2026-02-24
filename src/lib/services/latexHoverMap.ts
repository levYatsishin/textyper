import katex, { type TrustContext } from "katex";

export interface HoverAtom {
  id: string;
  snippet: string;
  start: number;
  end: number;
  kind: "command" | "symbol" | "group" | "script" | "operator";
}

export interface InstrumentedRender {
  html: string;
  atomsById: Record<string, HoverAtom>;
}

interface CommandSignature {
  requiredArgs: number;
  optionalArgs: number;
}

const COMMAND_SIGNATURES: Record<string, CommandSignature> = {
  frac: { requiredArgs: 2, optionalArgs: 0 },
  dfrac: { requiredArgs: 2, optionalArgs: 0 },
  tfrac: { requiredArgs: 2, optionalArgs: 0 },
  cfrac: { requiredArgs: 2, optionalArgs: 0 },
  binom: { requiredArgs: 2, optionalArgs: 0 },
  dbinom: { requiredArgs: 2, optionalArgs: 0 },
  tbinom: { requiredArgs: 2, optionalArgs: 0 },
  overset: { requiredArgs: 2, optionalArgs: 0 },
  underset: { requiredArgs: 2, optionalArgs: 0 },
  stackrel: { requiredArgs: 2, optionalArgs: 0 },
  genfrac: { requiredArgs: 6, optionalArgs: 0 },
  sqrt: { requiredArgs: 1, optionalArgs: 1 },
  text: { requiredArgs: 1, optionalArgs: 0 },
  operatorname: { requiredArgs: 1, optionalArgs: 0 },
  mathrm: { requiredArgs: 1, optionalArgs: 0 },
  mathbf: { requiredArgs: 1, optionalArgs: 0 },
  mathbb: { requiredArgs: 1, optionalArgs: 0 },
  mathcal: { requiredArgs: 1, optionalArgs: 0 },
  mathfrak: { requiredArgs: 1, optionalArgs: 0 },
  mathsf: { requiredArgs: 1, optionalArgs: 0 },
  mathit: { requiredArgs: 1, optionalArgs: 0 },
  hat: { requiredArgs: 1, optionalArgs: 0 },
  bar: { requiredArgs: 1, optionalArgs: 0 },
  dot: { requiredArgs: 1, optionalArgs: 0 },
  ddot: { requiredArgs: 1, optionalArgs: 0 },
  vec: { requiredArgs: 1, optionalArgs: 0 },
  overline: { requiredArgs: 1, optionalArgs: 0 },
  underline: { requiredArgs: 1, optionalArgs: 0 },
  widehat: { requiredArgs: 1, optionalArgs: 0 },
  widetilde: { requiredArgs: 1, optionalArgs: 0 },
  pmod: { requiredArgs: 1, optionalArgs: 0 }
};

const DELIMITER_COMMANDS = new Set(["left", "right", "middle", "big", "Big", "bigg", "Bigg", "bigl", "bigr"]);
const UNSUPPORTED_BLOCK_COMMANDS = new Set(["begin", "end"]);
const OPERATOR_CHARS = new Set([
  "+",
  "-",
  "=",
  "<",
  ">",
  "*",
  "/",
  "|",
  ":",
  ";",
  ",",
  "!",
  "?"
]);
const LETTER_RE = /[A-Za-z]/;

const renderCache = new Map<string, InstrumentedRender>();

function trustHtmlData(context: TrustContext): boolean {
  if (context.command !== "\\htmlData") {
    return false;
  }
  if (!context.attributes) {
    return false;
  }
  const idValue = context.attributes["data-ltx-id"];
  if (typeof idValue !== "string" || !/^ltx-[a-z0-9]+$/.test(idValue)) {
    return false;
  }
  return Object.keys(context.attributes).length === 1;
}

function renderFallback(latex: string): string {
  try {
    return katex.renderToString(latex, { displayMode: true, throwOnError: true });
  } catch {
    return "<span class='formula-error'>Unable to render formula.</span>";
  }
}

class LatexHoverParser {
  private index = 0;
  private atomCounter = 0;
  private readonly atomsById: Record<string, HoverAtom> = {};

  constructor(private readonly source: string) {}

  parse(): { instrumentedLatex: string; atomsById: Record<string, HoverAtom> } {
    const instrumentedLatex = this.parseSequence();
    if (this.index !== this.source.length) {
      throw new Error("Unexpected trailing input while parsing LaTeX atoms.");
    }
    return {
      instrumentedLatex,
      atomsById: this.atomsById
    };
  }

  private parseSequence(stopChar?: string): string {
    let output = "";
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (stopChar && char === stopChar) {
        break;
      }
      if (/\s/.test(char)) {
        output += char;
        this.index += 1;
        continue;
      }
      output += this.parseAtom();
    }
    return output;
  }

  private parseAtom(): string {
    const char = this.source[this.index];
    if (char === "{") {
      return this.parseGroup();
    }
    if (char === "^" || char === "_") {
      return this.parseScript();
    }
    if (char === "\\") {
      return this.parseCommandOrControl();
    }
    if (char === "[") {
      return this.parseBracketGroup();
    }
    return this.parseSymbol();
  }

  private parseGroup(): string {
    const start = this.index;
    this.index += 1;
    const inner = this.parseSequence("}");
    if (this.source[this.index] !== "}") {
      throw new Error("Unterminated group.");
    }
    this.index += 1;
    const end = this.index;
    const id = this.registerAtom(start, end, "group");
    return this.wrapAtom(id, `{${inner}}`);
  }

  private parseBracketGroup(): string {
    const start = this.index;
    this.index += 1;
    let inner = "";
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === "]") {
        this.index += 1;
        const end = this.index;
        const id = this.registerAtom(start, end, "group");
        return this.wrapAtom(id, `[${inner}]`);
      }
      if (/\s/.test(char)) {
        inner += char;
        this.index += 1;
        continue;
      }
      if (char === "[") {
        inner += this.parseBracketGroup();
        continue;
      }
      inner += this.parseAtom();
    }
    throw new Error("Unterminated optional bracket group.");
  }

  private parseScript(): string {
    const start = this.index;
    const operator = this.source[this.index];
    this.index += 1;
    const spacing = this.consumeWhitespace();

    if (this.index >= this.source.length) {
      const end = this.index;
      const id = this.registerAtom(start, end, "script");
      return this.wrapAtom(id, `${operator}${spacing}`);
    }

    const scriptBody = this.source[this.index] === "{" ? this.parseGroupedArgumentContent() : this.parseAtom();
    const end = this.index;
    const id = this.registerAtom(start, end, "script");
    return this.wrapAtom(id, `${operator}${spacing}{${scriptBody}}`);
  }

  private parseCommandOrControl(): string {
    const start = this.index;
    const rawCommand = this.parseRawCommandToken();
    const commandName = rawCommand.slice(1);

    if (rawCommand.length === 2 && !LETTER_RE.test(rawCommand[1])) {
      const id = this.registerAtom(start, this.index, "command");
      return this.wrapAtom(id, rawCommand);
    }

    const normalizedCommand = commandName.replace(/\*$/, "");
    if (UNSUPPORTED_BLOCK_COMMANDS.has(normalizedCommand)) {
      throw new Error("Environment commands are not instrumented in hover mode.");
    }

    let suffix = "";
    if (DELIMITER_COMMANDS.has(normalizedCommand)) {
      const spacing = this.consumeWhitespace();
      const delimiter = this.parseDelimiterToken();
      suffix = `${spacing}${delimiter}`;
    } else {
      const signature = COMMAND_SIGNATURES[normalizedCommand] ?? { requiredArgs: 0, optionalArgs: 0 };
      for (let index = 0; index < signature.optionalArgs; index += 1) {
        const spacing = this.consumeWhitespace();
        if (this.source[this.index] === "[") {
          suffix += `${spacing}${this.parseOptionalArgument()}`;
        } else {
          suffix += spacing;
        }
      }
      for (let index = 0; index < signature.requiredArgs; index += 1) {
        const spacing = this.consumeWhitespace();
        if (this.index >= this.source.length) {
          throw new Error(`Missing argument for command ${rawCommand}.`);
        }
        const arg = this.source[this.index] === "{" ? this.parseGroupedArgumentContent() : this.parseAtom();
        suffix += `${spacing}{${arg}}`;
      }
    }

    const end = this.index;
    const id = this.registerAtom(start, end, "command");
    return this.wrapAtom(id, `${rawCommand}${suffix}`);
  }

  private parseSymbol(): string {
    const start = this.index;
    const char = this.source[this.index];
    this.index += 1;
    const end = this.index;
    const kind = OPERATOR_CHARS.has(char) ? "operator" : "symbol";
    const id = this.registerAtom(start, end, kind);
    return this.wrapAtom(id, char);
  }

  private parseRawCommandToken(): string {
    if (this.source[this.index] !== "\\") {
      throw new Error("Expected command token.");
    }

    const start = this.index;
    this.index += 1;
    if (this.index >= this.source.length) {
      throw new Error("Dangling command slash.");
    }

    if (LETTER_RE.test(this.source[this.index])) {
      while (this.index < this.source.length && LETTER_RE.test(this.source[this.index])) {
        this.index += 1;
      }
      if (this.source[this.index] === "*") {
        this.index += 1;
      }
      return this.source.slice(start, this.index);
    }

    this.index += 1;
    return this.source.slice(start, this.index);
  }

  private parseDelimiterToken(): string {
    if (this.index >= this.source.length) {
      throw new Error("Missing delimiter after delimiter command.");
    }

    if (this.source[this.index] === "\\") {
      return this.parseRawCommandToken();
    }

    const delimiter = this.source[this.index];
    this.index += 1;
    return delimiter;
  }

  private parseGroupedArgumentContent(): string {
    const start = this.index;
    this.index += 1;
    const inner = this.parseSequence("}");
    if (this.source[this.index] !== "}") {
      throw new Error("Unterminated argument group.");
    }
    this.index += 1;
    const end = this.index;
    const id = this.registerAtom(start, end, "group");
    return this.wrapAtom(id, `{${inner}}`);
  }

  private parseOptionalArgument(): string {
    if (this.source[this.index] !== "[") {
      throw new Error("Expected optional argument.");
    }
    this.index += 1;
    let content = "";
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === "]") {
        this.index += 1;
        return `[${content}]`;
      }
      if (/\s/.test(char)) {
        content += char;
        this.index += 1;
        continue;
      }
      if (char === "[") {
        content += this.parseOptionalArgument();
        continue;
      }
      content += this.parseAtom();
    }
    throw new Error("Unterminated optional argument.");
  }

  private consumeWhitespace(): string {
    const start = this.index;
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index += 1;
    }
    return this.source.slice(start, this.index);
  }

  private registerAtom(start: number, end: number, kind: HoverAtom["kind"]): string {
    const id = `ltx-${this.atomCounter.toString(36)}`;
    this.atomCounter += 1;
    this.atomsById[id] = {
      id,
      snippet: this.source.slice(start, end),
      start,
      end,
      kind
    };
    return id;
  }

  private wrapAtom(id: string, content: string): string {
    return `\\htmlData{ltx-id=${id}}{${content}}`;
  }
}

export function buildInstrumentedRender(latex: string): InstrumentedRender {
  const cached = renderCache.get(latex);
  if (cached) {
    return cached;
  }

  try {
    const parser = new LatexHoverParser(latex);
    const { instrumentedLatex, atomsById } = parser.parse();
    const html = katex.renderToString(instrumentedLatex, {
      displayMode: true,
      throwOnError: true,
      strict: "ignore",
      trust: trustHtmlData
    });
    const result = { html, atomsById };
    renderCache.set(latex, result);
    return result;
  } catch {
    const fallback = { html: renderFallback(latex), atomsById: {} };
    renderCache.set(latex, fallback);
    return fallback;
  }
}

export function extractHoverSnippet(atomId: string, atomsById: Record<string, HoverAtom>): string | null {
  return atomsById[atomId]?.snippet ?? null;
}
