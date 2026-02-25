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

interface RawGroup {
  raw: string;
  content: string;
}

interface ParsedPrimary {
  output: string;
  allowTrailingScripts: boolean;
  atomId: string | null;
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
const UNWRAPPED_DELIMITER_COMMANDS = new Set(["left", "right", "middle"]);
const UNWRAPPED_MODIFIER_COMMANDS = new Set([
  "limits",
  "nolimits",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle"
]);
const UNWRAPPED_OPERATOR_COMMANDS = new Set([
  "sum",
  "prod",
  "coprod",
  "int",
  "iint",
  "iiint",
  "oint",
  "bigcup",
  "bigcap",
  "bigsqcup",
  "bigvee",
  "bigwedge",
  "bigoplus",
  "bigotimes"
]);
const SUPPORTED_ENVIRONMENTS = new Set([
  "align",
  "align*",
  "aligned",
  "split",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "cases"
]);
const OPERATOR_CHARS = new Set(["+", "-", "=", "<", ">", "*", "/", "|", ":", ";", ",", "!", "?"]);
const LETTER_RE = /[A-Za-z]/;

const renderCache = new Map<string, InstrumentedRender>();

function readRawCommandToken(source: string, from: number): { token: string; end: number } | null {
  if (from >= source.length || source[from] !== "\\") {
    return null;
  }

  let index = from + 1;
  if (index >= source.length) {
    return null;
  }

  if (LETTER_RE.test(source[index])) {
    while (index < source.length && LETTER_RE.test(source[index])) {
      index += 1;
    }
    if (source[index] === "*") {
      index += 1;
    }
    return { token: source.slice(from, index), end: index };
  }

  index += 1;
  return { token: source.slice(from, index), end: index };
}

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
      output += this.parseAtomCluster();
    }
    return output;
  }

  private parseAtomCluster(): string {
    if (this.source[this.index] === "^" || this.source[this.index] === "_") {
      return this.parseScriptSuffix();
    }

    const primary = this.parsePrimaryAtom();
    if (!primary.allowTrailingScripts) {
      return primary.output;
    }
    const trailingScripts = this.parseTrailingScripts();
    if (!trailingScripts) {
      return primary.output;
    }

    if (primary.atomId) {
      const atom = this.atomsById[primary.atomId];
      atom.end = this.index;
      atom.snippet = this.source.slice(atom.start, this.index);
      atom.kind = "script";
    }

    return `${primary.output}${trailingScripts}`;
  }

  private parsePrimaryAtom(): ParsedPrimary {
    const char = this.source[this.index];
    if (char === "{") {
      return this.parseGroupInstrumented();
    }
    if (char === "\\") {
      return this.parseCommandOrControl();
    }
    if (char === "[") {
      return this.parseBracketGroupInstrumented();
    }
    return this.parseSymbolInstrumented();
  }

  private parseTrailingScripts(): string {
    let suffix = "";
    while (this.index < this.source.length) {
      const checkpoint = this.index;
      const spacing = this.consumeWhitespace();
      const char = this.source[this.index];
      if (char !== "^" && char !== "_") {
        this.index = checkpoint;
        break;
      }
      suffix += `${spacing}${this.parseScriptSuffix()}`;
    }
    return suffix;
  }

  private parseGroupInstrumented(): ParsedPrimary {
    const start = this.index;
    this.index += 1;
    const inner = this.parseSequence("}");
    if (this.source[this.index] !== "}") {
      throw new Error("Unterminated group.");
    }
    this.index += 1;
    const end = this.index;
    const id = this.registerAtom(start, end, "group");
    return { output: this.wrapAtom(id, `{${inner}}`), allowTrailingScripts: true, atomId: id };
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

  private parseBracketGroupInstrumented(): ParsedPrimary {
    const start = this.index;
    this.index += 1;
    let inner = "";
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === "]") {
        this.index += 1;
        const end = this.index;
        const id = this.registerAtom(start, end, "group");
        return { output: this.wrapAtom(id, `[${inner}]`), allowTrailingScripts: true, atomId: id };
      }
      if (/\s/.test(char)) {
        inner += char;
        this.index += 1;
        continue;
      }
      if (char === "[") {
        inner += this.parseBracketGroupInstrumented();
        continue;
      }
      inner += this.parseAtomCluster();
    }
    throw new Error("Unterminated optional bracket group.");
  }

  private parseOptionalArgumentInstrumented(): string {
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
        content += this.parseOptionalArgumentInstrumented();
        continue;
      }
      content += this.parseAtomCluster();
    }
    throw new Error("Unterminated optional argument.");
  }

  private parseScriptSuffix(): string {
    const operator = this.source[this.index];
    if (operator !== "^" && operator !== "_") {
      throw new Error("Expected script operator.");
    }
    this.index += 1;
    const spacing = this.consumeWhitespace();
    if (this.index >= this.source.length) {
      return `${operator}${spacing}`;
    }

    const body = this.source[this.index] === "{" ? this.parseGroupedArgumentContent() : this.parseAtomCluster();
    return `${operator}${spacing}{${body}}`;
  }

  private parseCommandOrControl(): ParsedPrimary {
    const start = this.index;
    const rawCommand = this.parseRawCommandToken();
    const commandName = rawCommand.slice(1);

    if (rawCommand.length === 2 && !LETTER_RE.test(rawCommand[1])) {
      const id = this.registerAtom(start, this.index, "command");
      return { output: this.wrapAtom(id, rawCommand), allowTrailingScripts: true, atomId: id };
    }

    const normalizedCommand = commandName.replace(/\*$/, "");

    if (normalizedCommand === "begin") {
      return { output: this.parseEnvironmentBlock(rawCommand), allowTrailingScripts: false, atomId: null };
    }

    if (normalizedCommand === "end") {
      const spacing = this.consumeWhitespace();
      const rawGroup = this.source[this.index] === "{" ? this.parseRawBraceGroup().raw : "";
      return { output: `${rawCommand}${spacing}${rawGroup}`, allowTrailingScripts: false, atomId: null };
    }

    if (UNWRAPPED_MODIFIER_COMMANDS.has(normalizedCommand)) {
      return { output: rawCommand, allowTrailingScripts: false, atomId: null };
    }

    if (UNWRAPPED_OPERATOR_COMMANDS.has(normalizedCommand)) {
      return { output: this.parseOperatorCommandCluster(rawCommand, start), allowTrailingScripts: false, atomId: null };
    }

    let suffix = "";
    if (DELIMITER_COMMANDS.has(normalizedCommand)) {
      const spacing = this.consumeWhitespace();
      const delimiter = this.parseDelimiterToken();
      suffix = `${spacing}${delimiter}`;
      if (UNWRAPPED_DELIMITER_COMMANDS.has(normalizedCommand)) {
        return { output: `${rawCommand}${suffix}`, allowTrailingScripts: false, atomId: null };
      }
    } else {
      const signature = COMMAND_SIGNATURES[normalizedCommand] ?? { requiredArgs: 0, optionalArgs: 0 };
      for (let argIndex = 0; argIndex < signature.optionalArgs; argIndex += 1) {
        const spacing = this.consumeWhitespace();
        if (this.source[this.index] === "[") {
          suffix += `${spacing}${this.parseOptionalArgumentInstrumented()}`;
        } else {
          suffix += spacing;
        }
      }
      for (let argIndex = 0; argIndex < signature.requiredArgs; argIndex += 1) {
        const spacing = this.consumeWhitespace();
        if (this.index >= this.source.length) {
          throw new Error(`Missing argument for command ${rawCommand}.`);
        }
        const arg = this.source[this.index] === "{" ? this.parseGroupedArgumentContent() : this.parseAtomCluster();
        suffix += `${spacing}{${arg}}`;
      }
    }

    const end = this.index;
    const id = this.registerAtom(start, end, "command");
    return { output: this.wrapAtom(id, `${rawCommand}${suffix}`), allowTrailingScripts: true, atomId: id };
  }

  private parseOperatorCommandCluster(rawCommand: string, start: number): string {
    let suffix = "";
    const modifierCheckpoint = this.index;
    const modifierSpacing = this.consumeWhitespace();

    if (this.source[this.index] === "\\") {
      const modifierToken = this.parseRawCommandToken();
      const modifierName = modifierToken.slice(1).replace(/\*$/, "");
      if (modifierName === "limits" || modifierName === "nolimits") {
        suffix += `${modifierSpacing}${modifierToken}`;
      } else {
        this.index = modifierCheckpoint;
      }
    } else {
      this.index = modifierCheckpoint;
    }

    suffix += this.parseTrailingScripts();

    const end = this.index;
    const kind: HoverAtom["kind"] = suffix.includes("^") || suffix.includes("_") ? "script" : "command";
    const id = this.registerAtom(start, end, kind);
    return this.wrapAtom(id, `${rawCommand}${suffix}`);
  }

  private parseEnvironmentBlock(rawBeginCommand: string): string {
    const spacing = this.consumeWhitespace();
    const envGroup = this.parseRawBraceGroup();
    const envName = envGroup.content.trim();
    if (!SUPPORTED_ENVIRONMENTS.has(envName)) {
      throw new Error(`Unsupported environment: ${envName}`);
    }

    const content = this.parseEnvironmentContent(envName);
    const endToken = this.parseEnvironmentEnd(envName);
    return `${rawBeginCommand}${spacing}${envGroup.raw}${content}${endToken}`;
  }

  private parseEnvironmentContent(envName: string): string {
    let output = "";
    while (this.index < this.source.length) {
      if (this.isEnvironmentEndAhead(envName)) {
        break;
      }

      const char = this.source[this.index];
      if (/\s/.test(char)) {
        output += char;
        this.index += 1;
        continue;
      }

      if (char === "&") {
        output += "&";
        this.index += 1;
        continue;
      }

      if (char === "\\" && this.source[this.index + 1] === "\\") {
        output += this.parseRowBreakToken();
        continue;
      }

      output += this.parseAtomCluster();
    }

    return output;
  }

  private isEnvironmentEndAhead(envName: string): boolean {
    const checkpoint = this.index;
    if (this.source[this.index] !== "\\") {
      return false;
    }
    try {
      const command = this.parseRawCommandToken();
      if (command !== "\\end") {
        this.index = checkpoint;
        return false;
      }
      this.consumeWhitespace();
      if (this.source[this.index] !== "{") {
        this.index = checkpoint;
        return false;
      }
      const group = this.parseRawBraceGroup();
      this.index = checkpoint;
      return group.content.trim() === envName;
    } catch {
      this.index = checkpoint;
      return false;
    }
  }

  private parseEnvironmentEnd(envName: string): string {
    const command = this.parseRawCommandToken();
    if (command !== "\\end") {
      throw new Error(`Expected \\end{${envName}}`);
    }
    const spacing = this.consumeWhitespace();
    const group = this.parseRawBraceGroup();
    if (group.content.trim() !== envName) {
      throw new Error(`Mismatched environment end: ${group.content}`);
    }
    return `${command}${spacing}${group.raw}`;
  }

  private parseRowBreakToken(): string {
    const command = this.parseRawCommandToken();
    if (command !== "\\\\") {
      throw new Error("Expected row break token.");
    }
    const spacing = this.consumeWhitespace();
    let optionalArgument = "";
    if (this.source[this.index] === "[") {
      optionalArgument = this.parseOptionalArgumentRaw();
    }
    return `${command}${spacing}${optionalArgument}`;
  }

  private parseRawBraceGroup(): RawGroup {
    if (this.source[this.index] !== "{") {
      throw new Error("Expected brace group.");
    }

    const start = this.index;
    let depth = 0;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      this.index += 1;
      if (char === "\\") {
        if (this.index < this.source.length) {
          this.index += 1;
        }
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const raw = this.source.slice(start, this.index);
          return { raw, content: raw.slice(1, -1) };
        }
      }
    }
    throw new Error("Unterminated brace group.");
  }

  private parseOptionalArgumentRaw(): string {
    if (this.source[this.index] !== "[") {
      throw new Error("Expected optional argument.");
    }
    const start = this.index;
    let depth = 0;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      this.index += 1;
      if (char === "\\") {
        if (this.index < this.source.length) {
          this.index += 1;
        }
        continue;
      }
      if (char === "[") {
        depth += 1;
        continue;
      }
      if (char === "]") {
        depth -= 1;
        if (depth === 0) {
          return this.source.slice(start, this.index);
        }
      }
    }
    throw new Error("Unterminated optional argument.");
  }

  private parseSymbolInstrumented(): ParsedPrimary {
    const start = this.index;
    const char = this.source[this.index];
    this.index += 1;
    const end = this.index;
    const kind = OPERATOR_CHARS.has(char) ? "operator" : "symbol";
    const id = this.registerAtom(start, end, kind);
    return { output: this.wrapAtom(id, char), allowTrailingScripts: true, atomId: id };
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
    return fallback;
  }
}

export function extractHoverSnippet(atomId: string, atomsById: Record<string, HoverAtom>): string | null {
  return atomsById[atomId]?.snippet ?? null;
}

export function extractLeftRightDelimiterSnippets(latex: string): string[] {
  const source = latex ?? "";
  const snippets: string[] = [];
  let index = 0;

  while (index < source.length) {
    if (source[index] !== "\\") {
      index += 1;
      continue;
    }

    const command = readRawCommandToken(source, index);
    if (!command) {
      index += 1;
      continue;
    }

    const normalizedCommand = command.token.slice(1).replace(/\*$/, "");
    if (normalizedCommand !== "left" && normalizedCommand !== "right") {
      index = command.end;
      continue;
    }

    let delimiterStart = command.end;
    while (delimiterStart < source.length && /\s/.test(source[delimiterStart])) {
      delimiterStart += 1;
    }
    if (delimiterStart >= source.length) {
      index = command.end;
      continue;
    }

    if (source[delimiterStart] === "\\") {
      const delimiterCommand = readRawCommandToken(source, delimiterStart);
      if (!delimiterCommand) {
        index = command.end;
        continue;
      }
      snippets.push(source.slice(index, delimiterCommand.end).trim());
      index = delimiterCommand.end;
      continue;
    }

    snippets.push(source.slice(index, delimiterStart + 1).trim());
    index = delimiterStart + 1;
  }

  return snippets;
}
