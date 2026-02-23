import argparse
from pathlib import Path

from enrich_wikidata import enrich_rows, load_subject_map
from export_for_app import to_runtime_payload
from extract_wikipedia import extract_from_wikipedia_dump
from io_utils import read_jsonl, write_json, write_jsonl
from normalize_curate import curate, load_topic_map


def main() -> None:
  parser = argparse.ArgumentParser(description="Run formula ingestion pipeline end-to-end.")
  parser.add_argument("--wiki-dump", required=True, type=Path)
  parser.add_argument("--staging-dir", required=True, type=Path)
  parser.add_argument("--generated-dir", required=True, type=Path)
  parser.add_argument("--subject-map", type=Path)
  parser.add_argument("--topic-map", type=Path, default=Path("../config/topic_map.yaml"))
  parser.add_argument("--max-approved", type=int, default=500)
  args = parser.parse_args()

  staging_dir = args.staging_dir
  generated_dir = args.generated_dir
  staging_dir.mkdir(parents=True, exist_ok=True)
  generated_dir.mkdir(parents=True, exist_ok=True)

  extracted_path = staging_dir / "wiki_math.jsonl"
  enriched_path = staging_dir / "wiki_math_enriched.jsonl"
  curated_path = staging_dir / "wiki_math_curated.jsonl"
  candidates_path = generated_dir / "formulas_candidates.jsonl"
  approved_path = generated_dir / "formulas_approved.json"

  extract_from_wikipedia_dump(args.wiki_dump, extracted_path)
  extracted_rows = read_jsonl(extracted_path)

  subject_map = load_subject_map(args.subject_map)
  enriched_rows = enrich_rows(extracted_rows, subject_map)
  write_jsonl(enriched_path, enriched_rows)

  topic_map = load_topic_map(args.topic_map)
  curated_rows = curate(enriched_rows, topic_map)
  write_jsonl(curated_path, curated_rows)

  write_jsonl(candidates_path, curated_rows)
  approved_payload = to_runtime_payload(curated_rows, args.max_approved)
  write_json(approved_path, approved_payload)

  print(f"Extracted rows: {len(extracted_rows)}")
  print(f"Curated rows: {len(curated_rows)}")
  print(f"Candidates: {candidates_path}")
  print(f"Approved: {approved_path}")


if __name__ == "__main__":
  main()
