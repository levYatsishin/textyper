# LaTeX command catalog tooling

This folder contains the one-time tooling used to build
`src/lib/data/latexCommandCatalog.ts` from external references.

## Goal

Generate a deterministic command universe for tiered rarity scoring:

- Tier 0: very common/core commands
- Tier 1: standard AMS/KaTeX commands
- Tier 2: known but less-common commands (`known - tier0 - tier1`)
- Tier 3: unknown commands (not in known universe)

## Inputs

Recommended sources:

- CTAN comprehensive symbol list export (plain text extracted from `SYMLIST`)
- KaTeX supported functions page source (saved HTML/text)
- Optional additional plain text lists with LaTeX commands

You can provide any number of text files as `--sources`.
The parser extracts command names with pattern `\command`.

## Usage

```bash
python3 tools/complexity/build_command_catalog.py \
  --sources /path/to/ctan_symlist.txt /path/to/katex_supported.html \
  --output src/lib/data/latexCommandCatalog.ts
```

Optional custom tier seed files:

```bash
python3 tools/complexity/build_command_catalog.py \
  --sources /path/to/ctan_symlist.txt /path/to/katex_supported.html \
  --tier0-file tools/complexity/tier0.txt \
  --tier1-file tools/complexity/tier1.txt \
  --output src/lib/data/latexCommandCatalog.ts
```

Tier file format: one command per line, without the leading backslash.

## Notes

- The script is offline-only and deterministic.
- Unknown commands in app formulas should stay below the target threshold (8%).
- Always review generated output before committing.

## Distribution check

To inspect score spread and difficulty ratios after recalibration:

```bash
npx vite-node --script tools/complexity/evaluate_distribution.ts
```
