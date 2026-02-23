import argparse
import json
from pathlib import Path

from io_utils import read_jsonl, write_jsonl


def load_subject_map(path: Path | None) -> dict[str, dict]:
  if path is None or not path.exists():
    return {}
  if path.suffix.lower() == ".json":
    with path.open("r", encoding="utf-8") as handle:
      payload = json.load(handle)
    if isinstance(payload, dict):
      return {str(key): value for key, value in payload.items() if isinstance(value, dict)}
  return {}


def enrich_rows(rows: list[dict], subject_map: dict[str, dict]) -> list[dict]:
  enriched: list[dict] = []
  for row in rows:
    page_title = (row.get("page_title") or "").strip()
    mapped = subject_map.get(page_title, {})

    metadata = dict(row.get("metadata") or {})
    metadata["wikidata_item_id"] = mapped.get("item_id")
    metadata["wikidata_subjects"] = mapped.get("subjects", [])
    metadata["wikidata_defining_formula"] = mapped.get("defining_formula")

    enriched.append(
      {
        **row,
        "metadata": metadata
      }
    )
  return enriched


def main() -> None:
  parser = argparse.ArgumentParser(description="Attach Wikidata-like enrichment to extracted formulas.")
  parser.add_argument("--input", required=True, type=Path)
  parser.add_argument("--output", required=True, type=Path)
  parser.add_argument(
    "--subject-map",
    type=Path,
    help="Optional JSON map keyed by page title with {item_id, subjects[], defining_formula}"
  )
  args = parser.parse_args()

  source_rows = read_jsonl(args.input)
  subject_map = load_subject_map(args.subject_map)
  enriched_rows = enrich_rows(source_rows, subject_map)
  write_jsonl(args.output, enriched_rows)
  print(f"Enriched {len(enriched_rows)} formulas")
  print(f"Wrote output to {args.output}")


if __name__ == "__main__":
  main()
