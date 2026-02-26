# Wikidata query helpers

This directory contains standalone offline helpers for pulling formula-oriented datasets from Wikidata Query Service.

## Download CSV for the test SPARQL query

Run from repo root:

```bash
python tools/formula_ingest/wikidata/download_wikidata_csv.py
```

Default output:

- `tools/formula_ingest/staging/wikidata/formulas_test.csv`

## Example with custom output

```bash
python tools/formula_ingest/wikidata/download_wikidata_csv.py \
  --output /tmp/wikidata_formulas_test.csv
```

This output is intended for test/offline ingestion work, not runtime app data.
