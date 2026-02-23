import argparse
import hashlib
import re
from pathlib import Path

import yaml

from io_utils import read_jsonl, write_jsonl

TOPIC_FALLBACK = "algebra"


def normalized_latex_key(latex: str) -> str:
  normalized = re.sub(r"\s+", "", latex.strip())
  return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def passes_quality_gate(row: dict) -> bool:
  latex = (row.get("latex") or "").strip()
  if len(latex) < 3 or len(latex) > 600:
    return False
  if latex.count("{") != latex.count("}"):
    return False
  if latex.count("(") != latex.count(")"):
    return False
  return True


def infer_difficulty(latex: str) -> str:
  complexity = 0
  complexity += latex.count("\\frac")
  complexity += latex.count("\\int")
  complexity += latex.count("\\sum")
  complexity += latex.count("\\prod")
  complexity += latex.count("\\partial")
  complexity += latex.count("\\nabla")

  if complexity <= 1 and len(latex) < 40:
    return "easy"
  if complexity <= 4 and len(latex) < 120:
    return "medium"
  return "hard"


def infer_name(row: dict) -> str:
  page_title = (row.get("page_title") or "").strip()
  if page_title:
    return page_title
  latex = (row.get("latex") or "").strip()
  return f"Formula: {latex[:42]}" if latex else "Imported formula"


def load_topic_map(path: Path) -> dict[str, dict]:
  with path.open("r", encoding="utf-8") as handle:
    payload = yaml.safe_load(handle) or {}
  topics = payload.get("topics", {})
  if not isinstance(topics, dict):
    return {}
  return topics


def classify_topics(row: dict, topic_map: dict[str, dict]) -> list[str]:
  text_parts = [
    (row.get("page_title") or "").lower(),
    (row.get("latex") or "").lower(),
    " ".join((row.get("metadata") or {}).get("wikidata_subjects", [])).lower()
  ]
  searchable = " ".join(text_parts)

  selected: list[str] = []
  for topic_id, rules in topic_map.items():
    keywords = rules.get("keywords", [])
    if any(keyword.lower() in searchable for keyword in keywords):
      selected.append(topic_id)

  if not selected:
    selected.append(TOPIC_FALLBACK)
  return selected


def curate(rows: list[dict], topic_map: dict[str, dict]) -> list[dict]:
  seen_keys: set[str] = set()
  curated: list[dict] = []

  for row in rows:
    if not passes_quality_gate(row):
      continue

    latex = row["latex"].strip()
    key = normalized_latex_key(latex)
    if key in seen_keys:
      continue
    seen_keys.add(key)

    curated.append(
      {
        "latex": latex,
        "difficulty": infer_difficulty(latex),
        "name": infer_name(row),
        "topics": classify_topics(row, topic_map),
        "source": row.get("source", "unknown"),
        "metadata": {
          "page_title": row.get("page_title"),
          "page_id": row.get("page_id"),
          **(row.get("metadata") or {})
        }
      }
    )

  return curated


def main() -> None:
  parser = argparse.ArgumentParser(description="Normalize and curate extracted formulas.")
  parser.add_argument("--input", required=True, type=Path)
  parser.add_argument("--output", required=True, type=Path)
  parser.add_argument("--topic-map", required=True, type=Path)
  args = parser.parse_args()

  rows = read_jsonl(args.input)
  topic_map = load_topic_map(args.topic_map)
  curated_rows = curate(rows, topic_map)
  write_jsonl(args.output, curated_rows)
  print(f"Curated {len(curated_rows)} formulas")
  print(f"Wrote output to {args.output}")


if __name__ == "__main__":
  main()
