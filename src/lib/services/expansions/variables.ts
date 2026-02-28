import type { SnippetParseIssue, SnippetVariables } from "../../types";

function safeEvaluateExpression<T>(source: string): T {
  const trimmed = source.trim();
  if (!trimmed) {
    return {} as T;
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

  throw new Error(errors[errors.length - 1] ?? "Failed to parse variables source.");
}

function normalizeVariableName(variable: string): string {
  const trimmed = variable.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
    return trimmed;
  }
  return `\${${trimmed}}`;
}

export function normalizeSnippetVariables(raw: unknown): SnippetVariables {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const result: SnippetVariables = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value !== "string") {
      return;
    }
    const normalizedKey = normalizeVariableName(key);
    if (!normalizedKey) {
      return;
    }
    result[normalizedKey] = value;
  });

  return result;
}

export function parseSnippetVariablesSource(source: string): {
  variables: SnippetVariables;
  issues: SnippetParseIssue[];
} {
  try {
    const parsed = safeEvaluateExpression<unknown>(source);
    return {
      variables: normalizeSnippetVariables(parsed),
      issues: []
    };
  } catch (error) {
    return {
      variables: {},
      issues: [
        {
          severity: "error",
          message: `Snippet variables parse error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
