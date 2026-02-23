import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

from io_utils import read_jsonl, write_jsonl

WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php"
DEFAULT_USER_AGENT = "textyper-formula-ingest/1.0 (local formula pipeline)"


def chunked(values: list[str], size: int) -> list[list[str]]:
  return [values[index:index + size] for index in range(0, len(values), size)]


def fetch_json(url: str, params: dict[str, str], user_agent: str) -> dict:
  query = urllib.parse.urlencode(params)
  request = urllib.request.Request(
    f"{url}?{query}",
    headers={"User-Agent": user_agent}
  )
  with urllib.request.urlopen(request, timeout=30) as response:
    payload = json.loads(response.read().decode("utf-8"))
  return payload if isinstance(payload, dict) else {}


def extract_entity_id_from_claim(claim: dict) -> str | None:
  mainsnak = claim.get("mainsnak", {})
  datavalue = mainsnak.get("datavalue", {})
  value = datavalue.get("value", {})
  if isinstance(value, dict):
    entity_id = value.get("id")
    return entity_id if isinstance(entity_id, str) else None
  return None


def extract_string_from_claim(claim: dict) -> str | None:
  mainsnak = claim.get("mainsnak", {})
  datavalue = mainsnak.get("datavalue", {})
  value = datavalue.get("value")
  if isinstance(value, str):
    return value
  if isinstance(value, dict):
    text = value.get("text")
    if isinstance(text, str):
      return text
  return None


def fetch_entities(item_ids: list[str], user_agent: str) -> dict[str, dict]:
  entities: dict[str, dict] = {}
  if not item_ids:
    return entities

  for batch in chunked(sorted(set(item_ids)), 50):
    payload = fetch_json(
      WIKIDATA_API_URL,
      {
        "action": "wbgetentities",
        "format": "json",
        "ids": "|".join(batch),
        "props": "labels|claims",
        "languages": "en"
      },
      user_agent
    )
    response_entities = payload.get("entities", {})
    if isinstance(response_entities, dict):
      for item_id, entity in response_entities.items():
        if isinstance(entity, dict):
          entities[item_id] = entity
  return entities


def build_live_subject_map(rows: list[dict], user_agent: str) -> dict[str, dict]:
  page_rows: list[tuple[str, str]] = []
  for row in rows:
    page_title = (row.get("page_title") or "").strip()
    metadata = row.get("metadata") or {}
    item_id = metadata.get("wikidata_item_id") if isinstance(metadata, dict) else None
    if page_title and isinstance(item_id, str) and item_id.startswith("Q"):
      page_rows.append((page_title, item_id))

  if not page_rows:
    return {}

  entities = fetch_entities([item_id for _, item_id in page_rows], user_agent)
  subject_ids: list[str] = []

  for entity in entities.values():
    claims = entity.get("claims", {})
    if not isinstance(claims, dict):
      continue
    p921_claims = claims.get("P921", [])
    if not isinstance(p921_claims, list):
      continue
    for claim in p921_claims:
      if not isinstance(claim, dict):
        continue
      subject_id = extract_entity_id_from_claim(claim)
      if subject_id:
        subject_ids.append(subject_id)

  subject_entities = fetch_entities(subject_ids, user_agent)

  map_by_title: dict[str, dict] = {}
  for page_title, item_id in page_rows:
    entity = entities.get(item_id, {})
    claims = entity.get("claims", {}) if isinstance(entity, dict) else {}

    subjects: list[str] = []
    defining_formula: str | None = None
    if isinstance(claims, dict):
      p921_claims = claims.get("P921", [])
      if isinstance(p921_claims, list):
        for claim in p921_claims:
          if not isinstance(claim, dict):
            continue
          subject_id = extract_entity_id_from_claim(claim)
          if not subject_id:
            continue
          subject_entity = subject_entities.get(subject_id, {})
          labels = subject_entity.get("labels", {}) if isinstance(subject_entity, dict) else {}
          label_entry = labels.get("en") if isinstance(labels, dict) else None
          label = label_entry.get("value") if isinstance(label_entry, dict) else None
          if isinstance(label, str):
            subjects.append(label)

      p2534_claims = claims.get("P2534", [])
      if isinstance(p2534_claims, list) and p2534_claims:
        for claim in p2534_claims:
          if not isinstance(claim, dict):
            continue
          extracted = extract_string_from_claim(claim)
          if extracted:
            defining_formula = extracted
            break

    map_by_title[page_title] = {
      "item_id": item_id,
      "subjects": sorted(set(subjects)),
      "defining_formula": defining_formula
    }

  return map_by_title


def load_subject_map(path: Path | None) -> dict[str, dict]:
  if path is None or not path.exists():
    return {}
  if path.suffix.lower() == ".json":
    with path.open("r", encoding="utf-8") as handle:
      payload = json.load(handle)
    if isinstance(payload, dict):
      return {str(key): value for key, value in payload.items() if isinstance(value, dict)}
  return {}


def enrich_rows(rows: list[dict], subject_map: dict[str, dict], live: bool = False, user_agent: str = DEFAULT_USER_AGENT) -> list[dict]:
  live_map = build_live_subject_map(rows, user_agent) if live else {}
  enriched: list[dict] = []
  for row in rows:
    page_title = (row.get("page_title") or "").strip()
    mapped = {
      **live_map.get(page_title, {}),
      **subject_map.get(page_title, {})
    }

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
  parser.add_argument("--live", action="store_true", help="Fetch metadata from Wikidata API using row wikidata item ids.")
  parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
  args = parser.parse_args()

  source_rows = read_jsonl(args.input)
  subject_map = load_subject_map(args.subject_map)
  enriched_rows = enrich_rows(source_rows, subject_map, live=args.live, user_agent=args.user_agent)
  write_jsonl(args.output, enriched_rows)
  print(f"Enriched {len(enriched_rows)} formulas")
  print(f"Wrote output to {args.output}")


if __name__ == "__main__":
  main()
