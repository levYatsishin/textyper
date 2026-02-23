import argparse
import datetime as dt
import hashlib
import re
from pathlib import Path

from io_utils import read_jsonl, write_json, write_jsonl


def stable_expression_id(latex: str) -> str:
  normalized = re.sub(r"\s+", "", latex.strip())
  digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]
  return f"expr-{digest}"


def to_app_record(row: dict) -> dict:
  difficulty = row.get("difficulty", "intermediate")
  topics = row.get("topics") if isinstance(row.get("topics"), list) else ["algebra"]
  subtopics = row.get("subtopics") if isinstance(row.get("subtopics"), list) else ["fundamentals"]
  name = (row.get("name") or "").strip() or "Imported formula"
  latex = (row.get("latex") or "").strip()

  return {
    "id": row.get("id") or stable_expression_id(latex),
    "latex": latex,
    "difficulty": difficulty,
    "complexityBand": row.get("complexityBand", difficulty),
    "complexityScore": row.get("complexityScore", 0),
    "name": name,
    "topics": topics or ["algebra"],
    "subtopics": subtopics or ["fundamentals"],
    **({"complexityFeatures": row["complexityFeatures"]} if isinstance(row.get("complexityFeatures"), dict) else {}),
    "source": row.get("source", "unknown"),
    "metadata": row.get("metadata", {})
  }


def to_runtime_payload(rows: list[dict], max_approved: int) -> dict:
  sorted_rows = sorted(rows, key=lambda item: ((item.get("name") or ""), (item.get("latex") or "")))
  approved_rows = [to_app_record(row) for row in sorted_rows[: max(0, max_approved)]]
  return {
    "version": "v1",
    "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "expressions": approved_rows
  }


def main() -> None:
  parser = argparse.ArgumentParser(description="Export curated formulas into review and app-ready files.")
  parser.add_argument("--input", required=True, type=Path)
  parser.add_argument("--candidates-output", required=True, type=Path)
  parser.add_argument("--approved-output", required=True, type=Path)
  parser.add_argument("--max-approved", type=int, default=500)
  args = parser.parse_args()

  rows = read_jsonl(args.input)
  write_jsonl(args.candidates_output, rows)

  payload = to_runtime_payload(rows, args.max_approved)
  write_json(args.approved_output, payload)

  print(f"Wrote {len(rows)} candidates to {args.candidates_output}")
  print(f"Wrote {len(payload['expressions'])} approved records to {args.approved_output}")


if __name__ == "__main__":
  main()
