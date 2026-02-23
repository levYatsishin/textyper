# Formula ingestion pipeline (one-time/offline)

This directory contains a Python pipeline for building larger formula corpora and exporting curated data for the app.

## Scope
- Runtime app remains static and local-first.
- These scripts are **offline tooling** for generating candidate formula datasets.
- Human review is required before promoting generated formulas into `src/lib/data/expressions.ts`.

## Folder layout
- `config/topic_map.yaml` — mapping from extracted metadata/keywords to app topic IDs.
- `src/extract_wikipedia.py` — extracts `<math>...</math>` formulas from Wikipedia XML dumps.
- `src/enrich_wikidata.py` — enriches formulas with subject metadata (when available).
- `src/normalize_curate.py` — deduplicates, quality-filters, and classifies to app topics.
- `src/export_for_app.py` — writes review candidates and app-ready JSON.
- `src/run_pipeline.py` — single entrypoint to run end-to-end pipeline.

## Expected input/output
- Input:
  - Wikipedia dump XML (or XML.bz2 decompressed beforehand)
  - Optional metadata export to aid Wikidata enrichment
- Output:
  - `staging/wiki_math.jsonl`
  - `staging/wiki_math_enriched.jsonl`
  - `data/generated/formulas_candidates.jsonl`
  - `data/generated/formulas_approved.json`

## Install
```bash
cd tools/formula_ingest
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
python src/run_pipeline.py \
  --wiki-dump /path/to/enwiki-pages-articles.xml \
  --staging-dir ../staging \
  --generated-dir ../data/generated
```

## Notes
- This MVP pipeline favors robustness and repeatability over maximal recall.
- ProofWiki/DLMF/arXiv connectors are intentionally left as optional follow-up modules.
