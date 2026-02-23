import argparse
from pathlib import Path

from enrich_wikidata import enrich_rows, load_subject_map
from export_for_app import to_runtime_payload
from extract_wikipedia_api import extract_from_wikipedia_titles
from extract_wikipedia import extract_from_wikipedia_dump
from io_utils import read_jsonl, write_json, write_jsonl
from normalize_curate import curate, load_topic_map


def main() -> None:
  parser = argparse.ArgumentParser(description="Run formula ingestion pipeline end-to-end.")
  source_group = parser.add_mutually_exclusive_group(required=True)
  source_group.add_argument("--wiki-dump", type=Path)
  source_group.add_argument("--wiki-titles-file", type=Path)
  parser.add_argument("--staging-dir", required=True, type=Path)
  parser.add_argument("--generated-dir", required=True, type=Path)
  parser.add_argument("--subject-map", type=Path)
  parser.add_argument("--topic-map", type=Path, default=Path("../config/topic_map.yaml"))
  parser.add_argument("--live-wikidata", action="store_true")
  parser.add_argument("--user-agent", default="textyper-formula-ingest/1.0 (local formula pipeline)")
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

  if args.wiki_dump is not None:
    extract_from_wikipedia_dump(args.wiki_dump, extracted_path)
  else:
    extract_from_wikipedia_titles(
      titles_path=args.wiki_titles_file,
      output_path=extracted_path,
      user_agent=args.user_agent
    )
  extracted_rows = read_jsonl(extracted_path)

  subject_map = load_subject_map(args.subject_map)
  enriched_rows = enrich_rows(
    extracted_rows,
    subject_map,
    live=args.live_wikidata,
    user_agent=args.user_agent
  )
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
