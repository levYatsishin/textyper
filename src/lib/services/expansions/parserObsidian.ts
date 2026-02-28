import type {
  CompiledSnippet,
  RawObsidianSnippet,
  SnippetModeFlags,
  SnippetOptionFlags,
  SnippetParseIssue,
  SnippetParseResult,
  SnippetVariables
} from "../../types";

const REGEX_FLAGS = new Set(["d", "i", "m", "s", "u", "v", "y"]);
const MODE_FLAGS = new Set(["t", "m", "M", "n", "c"]);

function makeModeFlags(optionsSource: string): SnippetModeFlags {
  const chars = new Set(optionsSource.split(""));
  return {
    text: chars.has("t"),
    math: chars.has("m"),
    blockMath: chars.has("M"),
    inlineMath: chars.has("n"),
    code: chars.has("c")
  };
}

function makeOptionFlags(optionsSource: string): SnippetOptionFlags {
  const chars = new Set(optionsSource.split(""));
  return {
    auto: chars.has("A"),
    regex: chars.has("r"),
    visual: chars.has("v"),
    wordBoundary: chars.has("w"),
    modes: makeModeFlags(optionsSource)
  };
}

function applySnippetVariables(input: string, variables: SnippetVariables): string {
  let output = input;
  for (const [variable, replacement] of Object.entries(variables)) {
    if (!variable || !replacement) {
      continue;
    }
    output = output.split(variable).join(replacement);
  }
  return output;
}

function filterRegexFlags(flags: string): string {
  const unique = [...new Set(flags.split(""))];
  return unique.filter((flag) => REGEX_FLAGS.has(flag)).join("");
}

function safeEvaluateExpression<T>(source: string): T {
  const trimmed = source.trim();
  if (!trimmed) {
    return [] as T;
  }

  const candidates = [trimmed, trimmed.replace(/^export\s+default\s+/, "").replace(/;\s*$/, "")];
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = Function(`"use strict"; return (${candidate});`)() as T;
      return parsed;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors[errors.length - 1] ?? "Failed to parse source.");
}

function normalizeTriggerKey(triggerKey: unknown): string | undefined {
  return typeof triggerKey === "string" && triggerKey.trim().length > 0 ? triggerKey.trim() : undefined;
}

function toRawSnippet(value: unknown): RawObsidianSnippet | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<RawObsidianSnippet>;
  if (typeof raw.trigger !== "string" && !(raw.trigger instanceof RegExp)) {
    return null;
  }
  if (typeof raw.replacement !== "string") {
    return null;
  }

  return {
    trigger: raw.trigger,
    replacement: raw.replacement,
    options: typeof raw.options === "string" ? raw.options : "",
    priority: typeof raw.priority === "number" ? raw.priority : 0,
    description: typeof raw.description === "string" ? raw.description : "",
    flags: typeof raw.flags === "string" ? raw.flags : "",
    triggerKey: normalizeTriggerKey(raw.triggerKey)
  };
}

function sortCompiledSnippets(snippets: CompiledSnippet[]): CompiledSnippet[] {
  return [...snippets].sort((left, right) => {
    const priorityGap = right.priority - left.priority;
    if (priorityGap !== 0) {
      return priorityGap;
    }
    const triggerGap = right.triggerSource.length - left.triggerSource.length;
    if (triggerGap !== 0) {
      return triggerGap;
    }
    return left.id.localeCompare(right.id);
  });
}

function compileSnippet(
  raw: RawObsidianSnippet,
  index: number,
  variables: SnippetVariables
): { snippet: CompiledSnippet | null; issues: SnippetParseIssue[] } {
  const issues: SnippetParseIssue[] = [];
  const optionsSource = raw.options ?? "";
  const options = makeOptionFlags(optionsSource);
  const ignoredModes = optionsSource
    .split("")
    .filter((flag) => MODE_FLAGS.has(flag));

  if (ignoredModes.length > 0) {
    issues.push({
      severity: "warning",
      snippetIndex: index,
      message: `Snippet #${index + 1}: mode flags (${ignoredModes.join("")}) are ignored in Textyper single-field mode.`
    });
  }

  if (options.visual) {
    issues.push({
      severity: "warning",
      snippetIndex: index,
      message: `Snippet #${index + 1}: option 'v' is parsed but not executed in Textyper v1.`
    });
    return { snippet: null, issues };
  }

  const triggerSource = raw.trigger instanceof RegExp ? raw.trigger.source : String(raw.trigger);
  const expandedTriggerSource = applySnippetVariables(triggerSource, variables);
  const replacement = applySnippetVariables(String(raw.replacement), variables);
  const description = raw.description?.trim() || `Snippet ${index + 1}`;
  const priority = Number.isFinite(raw.priority) ? raw.priority ?? 0 : 0;
  const id = `snippet-${index + 1}-${description.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  let trigger: string | RegExp = expandedTriggerSource;
  if (options.regex || raw.trigger instanceof RegExp) {
    const inheritedFlags = raw.trigger instanceof RegExp ? raw.trigger.flags : "";
    const requestedFlags = `${inheritedFlags}${raw.flags ?? ""}`;
    const flags = filterRegexFlags(requestedFlags);

    try {
      trigger = new RegExp(`(?:${expandedTriggerSource})$`, flags);
    } catch (error) {
      issues.push({
        severity: "error",
        snippetIndex: index,
        message: `Snippet #${index + 1}: invalid regex trigger (${error instanceof Error ? error.message : String(error)}).`
      });
      return { snippet: null, issues };
    }
  }

  const snippet: CompiledSnippet = {
    id,
    trigger,
    triggerSource: expandedTriggerSource,
    replacement,
    options,
    priority,
    description,
    triggerKey: raw.triggerKey ?? null
  };

  return { snippet, issues };
}

export function parseObsidianSnippetSource(source: string, variables: SnippetVariables): SnippetParseResult {
  const issues: SnippetParseIssue[] = [];
  let parsed: unknown;

  try {
    parsed = safeEvaluateExpression<unknown>(source);
  } catch (error) {
    return {
      snippets: [],
      issues: [
        {
          severity: "error",
          message: `Snippet source parse error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      snippets: [],
      issues: [
        {
          severity: "error",
          message: "Snippet source must evaluate to an array."
        }
      ]
    };
  }

  const snippets: CompiledSnippet[] = [];
  parsed.forEach((entry, index) => {
    const rawSnippet = toRawSnippet(entry);
    if (!rawSnippet) {
      issues.push({
        severity: "error",
        snippetIndex: index,
        message: `Snippet #${index + 1}: expected { trigger, replacement, options } with string replacement.`
      });
      return;
    }

    const compiled = compileSnippet(rawSnippet, index, variables);
    issues.push(...compiled.issues);
    if (compiled.snippet) {
      snippets.push(compiled.snippet);
    }
  });

  return {
    snippets: sortCompiledSnippets(snippets),
    issues
  };
}
