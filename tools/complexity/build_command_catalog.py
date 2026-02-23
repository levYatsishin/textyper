#!/usr/bin/env python3

from __future__ import annotations

import argparse
import pathlib
import re
from typing import Iterable

DEFAULT_TIER0 = [
    "alpha",
    "approx",
    "beta",
    "binom",
    "cap",
    "cdot",
    "cos",
    "cup",
    "delta",
    "det",
    "epsilon",
    "equiv",
    "exists",
    "exp",
    "forall",
    "frac",
    "gamma",
    "geq",
    "hat",
    "iff",
    "implies",
    "in",
    "infty",
    "int",
    "lambda",
    "leq",
    "left",
    "lim",
    "ln",
    "log",
    "mathbb",
    "mathcal",
    "mathfrak",
    "mathbf",
    "mathrm",
    "middle",
    "mu",
    "nabla",
    "neg",
    "neq",
    "oint",
    "operatorname",
    "partial",
    "phi",
    "pi",
    "pm",
    "pmod",
    "prod",
    "rho",
    "right",
    "sigma",
    "sim",
    "sin",
    "sqrt",
    "subseteq",
    "sum",
    "tan",
    "text",
    "theta",
    "times",
    "to",
    "varphi",
    "vee",
    "wedge",
    "zeta",
]

DEFAULT_TIER1 = [
    "Big",
    "Bigg",
    "Bigl",
    "Bigr",
    "Gamma",
    "Im",
    "Lambda",
    "Omega",
    "Phi",
    "Pi",
    "Psi",
    "Re",
    "Sigma",
    "Theta",
    "Upsilon",
    "Xi",
    "arctan",
    "bar",
    "begin",
    "big",
    "bigcap",
    "bigcup",
    "bigsqcup",
    "bigvee",
    "bigwedge",
    "coloneqq",
    "ddot",
    "dbinom",
    "dfrac",
    "dots",
    "emptyset",
    "end",
    "genfrac",
    "iint",
    "iiint",
    "iiiint",
    "lVert",
    "leftarrow",
    "leftrightarrow",
    "limits",
    "mathscr",
    "mod",
    "nolimits",
    "operatorname*",
    "overline",
    "rVert",
    "rightarrow",
    "sec",
    "sideset",
    "sinh",
    "smallsetminus",
    "subset",
    "supset",
    "supseteq",
    "tbinom",
    "tfrac",
    "underline",
    "vec",
    "widehat",
    "widetilde",
]

COMMAND_PATTERN = re.compile(r"\\([A-Za-z]+)\*?")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build latexCommandCatalog.ts from source files.")
    parser.add_argument(
        "--sources",
        nargs="+",
        required=True,
        help="Input text/html files that contain LaTeX commands.",
    )
    parser.add_argument(
        "--tier0-file",
        type=pathlib.Path,
        default=None,
        help="Optional newline-delimited Tier 0 commands.",
    )
    parser.add_argument(
        "--tier1-file",
        type=pathlib.Path,
        default=None,
        help="Optional newline-delimited Tier 1 commands.",
    )
    parser.add_argument(
        "--output",
        type=pathlib.Path,
        default=pathlib.Path("src/lib/data/latexCommandCatalog.ts"),
        help="Output TypeScript file.",
    )
    return parser.parse_args()


def normalize_commands(commands: Iterable[str]) -> list[str]:
    return sorted({command.strip() for command in commands if command.strip()})


def load_command_lines(path: pathlib.Path) -> list[str]:
    return normalize_commands(path.read_text(encoding="utf-8").splitlines())


def extract_commands_from_source(path: pathlib.Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    return set(COMMAND_PATTERN.findall(text))


def format_array_literal(name: str, values: list[str]) -> str:
    body = ",\n".join(f'  "{value}"' for value in values)
    return f"export const {name} = uniqueCommands([\n{body}\n]);"


def build_typescript(tier0: list[str], tier1: list[str], known: list[str]) -> str:
    return (
        "function uniqueCommands(values: readonly string[]): string[] {\n"
        "  return [...new Set(values)].sort((left, right) => left.localeCompare(right));\n"
        "}\n\n"
        f"{format_array_literal('tier0Commands', tier0)}\n\n"
        f"{format_array_literal('tier1Commands', tier1)}\n\n"
        f"{format_array_literal('knownCommands', known)}\n"
    )


def main() -> None:
    args = parse_args()

    source_commands: set[str] = set()
    for source in args.sources:
        source_path = pathlib.Path(source)
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")
        source_commands.update(extract_commands_from_source(source_path))

    tier0 = load_command_lines(args.tier0_file) if args.tier0_file else normalize_commands(DEFAULT_TIER0)
    tier1 = load_command_lines(args.tier1_file) if args.tier1_file else normalize_commands(DEFAULT_TIER1)
    known = normalize_commands(source_commands.union(tier0).union(tier1))

    output = build_typescript(tier0=tier0, tier1=tier1, known=known)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")

    print(f"Wrote {args.output}")
    print(f"Tier 0: {len(tier0)} commands")
    print(f"Tier 1: {len(tier1)} commands")
    print(f"Known: {len(known)} commands")


if __name__ == "__main__":
    main()
