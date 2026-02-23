import argparse
from pathlib import Path

from io_utils import read_jsonl, write_json, write_jsonl


def to_app_record(row: dict) -> dict:
  return {
    "latex": row["latex"],
    "difficulty": row["difficulty"],
    "name": row["name"],
    "topics": row["topics"],
    "source": row.get("source", "unknown")
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

  approved = [to_app_record(row) for row in rows[: max(0, args.max_approved)]]
  write_json(args.approved_output, approved)

  print(f"Wrote {len(rows)} candidates to {args.candidates_output}")
  print(f"Wrote {len(approved)} approved records to {args.approved_output}")


if __name__ == "__main__":
  main()
