import type { ExpansionSettings, SnippetVariables } from "../types";

export const DEFAULT_EXPANSION_SETTINGS: ExpansionSettings = {
  enabled: true,
  sourceFormat: "obsidian",
  manualTriggerKey: "Tab",
  wordDelimiters: " \t\n.,;:!?()[]{}<>+-=*/\\|\"'",
  helpers: {
    autofractionEnabled: true,
    taboutEnabled: true,
    matrixShortcutsEnabled: true,
    autoEnlargeBracketsEnabled: true,
    autofractionSymbol: "\\frac",
    autofractionBreakingChars: "+-=,;:",
    matrixShortcutEnvironments: [
      "matrix",
      "pmatrix",
      "bmatrix",
      "Bmatrix",
      "vmatrix",
      "Vmatrix",
      "align",
      "aligned",
      "cases"
    ],
    taboutClosingSymbols: [")", "]", "}", "|"],
    autoEnlargeTriggers: ["lr(", "lr[", "lr{", "lr|"]
  }
};

export const DEFAULT_EXPANSION_VARIABLES: SnippetVariables = {
  "${GREEK}":
    "alpha|beta|gamma|Gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|vartheta|Theta|iota|kappa|lambda|Lambda|mu|nu|xi|Xi|pi|Pi|rho|sigma|Sigma|tau|upsilon|Upsilon|phi|varphi|Phi|chi|psi|Psi|omega|Omega",
  "${SYMBOL}": "sum|prod|int|iint|iiint|oint|infty|nabla|partial|cdot|times|pm|mp|to|rightarrow|iff|implies"
};

export const DEFAULT_EXPANSION_VARIABLES_SOURCE = `{
  GREEK:
    "alpha|beta|gamma|Gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|vartheta|Theta|iota|kappa|lambda|Lambda|mu|nu|xi|Xi|pi|Pi|rho|sigma|Sigma|tau|upsilon|Upsilon|phi|varphi|Phi|chi|psi|Psi|omega|Omega",
  SYMBOL: "sum|prod|int|iint|iiint|oint|infty|nabla|partial|cdot|times|pm|mp|to|rightarrow|iff|implies"
}`;

export const DEFAULT_OBSIDIAN_SNIPPETS_SOURCE = `[
  { trigger: "sr", replacement: "^{2}", options: "A", description: "square" },
  { trigger: "cb", replacement: "^{3}", options: "A", description: "cube" },
  { trigger: "bf", replacement: "\\\\mathbf{$1}$0", options: "A", description: "bold symbol" },
  { trigger: "sq", replacement: "\\\\sqrt{$1}$0", options: "A", description: "square root" },
  { trigger: "sum", replacement: "\\\\sum_{\${1:i}=\${2:1}}^{\${3:n}} $0", options: "", description: "manual sigma" },
  { trigger: "lr(", replacement: "\\\\left($1\\\\right)$0", options: "A", description: "auto-enlarged parentheses" },
  { trigger: /([A-Za-z])(\\d)/, replacement: "[[0]]_{[[1]]}", options: "rA", description: "auto subscript" },
  { trigger: /([^\\\\])(to|iff|implies)/, replacement: "[[0]]\\\\[[1]]", options: "rAw", description: "add slash before relation words" }
]`;
