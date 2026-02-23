# Formula ingestion pipeline (one-time/offline)

This directory contains a Python pipeline for building larger formula corpora and exporting curated data for the app.

## Scope
- Runtime app remains static and local-first.
- These scripts are **offline tooling** for generating candidate formula datasets.
- Human review is required before promoting generated formulas into `src/lib/data/formulas.v1.json`.

## Folder layout
- `config/topic_map.yaml` — mapping from extracted metadata/keywords to app topic IDs.
- `config/wiki_seed_titles.txt` — starter set of Wikipedia pages for API-based extraction.
- `src/extract_wikipedia.py` — extracts `<math>...</math>` formulas from Wikipedia XML dumps.
- `src/extract_wikipedia_api.py` — extracts formulas from specific Wikipedia pages via API.
- `src/enrich_wikidata.py` — enriches formulas with subject metadata (when available).
- `src/normalize_curate.py` — deduplicates, quality-filters, and classifies to app topics.
- `src/export_for_app.py` — writes review candidates and app-ready JSON.
- `src/run_pipeline.py` — single entrypoint to run end-to-end pipeline.

## Expected input/output
- Input:
  - Wikipedia dump XML (or XML.bz2 decompressed beforehand), **or**
  - a list of Wikipedia titles for API extraction
  - Optional metadata export to aid Wikidata enrichment
- Output:
  - `staging/wiki_math.jsonl`
  - `staging/wiki_math_enriched.jsonl`
  - `data/generated/formulas_candidates.jsonl`
  - `data/generated/formulas_approved.json` (runtime payload shape: `{ version, generatedAt, expressions[] }`)

## Install
```bash
cd tools/formula_ingest
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
Using a Wikipedia dump:
```bash
python src/run_pipeline.py \
  --wiki-dump /path/to/enwiki-pages-articles.xml \
  --staging-dir ../staging \
  --generated-dir ../data/generated
```

Using seed titles + live Wikidata enrichment:
```bash
python src/run_pipeline.py \
  --wiki-titles-file config/wiki_seed_titles.txt \
  --staging-dir staging \
  --generated-dir data/generated \
  --topic-map config/topic_map.yaml \
  --live-wikidata \
  --max-approved 2500
```

## Notes
- This MVP pipeline favors robustness and repeatability over maximal recall.
- ProofWiki/DLMF/arXiv connectors are intentionally left as optional follow-up modules.
