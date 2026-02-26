import argparse
import csv
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_QUERY_FILE = Path("tools/formula_ingest/wikidata/queries/formulas_test.sparql")
DEFAULT_OUTPUT_FILE = Path("tools/formula_ingest/staging/wikidata/formulas_test.csv")
DEFAULT_ENDPOINT = "https://query.wikidata.org/sparql"
DEFAULT_WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php"
DEFAULT_USER_AGENT = "textyper-formula-ingest/1.0 (wikidata csv downloader)"
DEFAULT_WIKIPEDIA_LANGS = "en,de,ru,fr,ja"
DEFAULT_CONVERTER_SCRIPT = Path("tools/formula_ingest/wikidata/convert_mathml_to_latex.mjs")
MAX_PREFERRED_LINKS = 2
MAX_FALLBACK_LINKS = 2

OUTPUT_COLUMNS = ["item", "itemLabel", "formula", "formula_latex", "classLabel", "wikipediaPages"]


def read_query(path: Path) -> str:
  if not path.exists():
    raise FileNotFoundError(f"Query file not found: {path}")

  query = path.read_text(encoding="utf-8").strip()
  if not query:
    raise ValueError(f"Query file is empty: {path}")

  return query


def parse_item_id(item_value: str) -> str:
  if "/entity/" in item_value:
    return item_value.rsplit("/", 1)[-1]
  return item_value


def parse_wikipedia_langs(raw: str) -> list[str]:
  langs = [part.strip().lower() for part in raw.split(",") if part.strip()]
  if not langs:
    raise ValueError("At least one language code is required in --wikipedia-langs")
  if any("|" in lang for lang in langs):
    raise ValueError("Language codes must not contain '|'")
  return langs


def parse_wikipedia_language_from_site_key(site_key: str) -> str | None:
  if not site_key.endswith("wiki"):
    return None
  lang = site_key[:-4].lower()
  if not lang:
    return None
  return lang


def request_with_retries(request: urllib.request.Request, timeout: int, retries: int, backoff_seconds: float) -> bytes:
  attempt = 0
  while True:
    try:
      with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()
    except (TimeoutError, urllib.error.URLError, urllib.error.HTTPError):
      attempt += 1
      if attempt > retries:
        raise
      time.sleep(backoff_seconds * attempt)


def fetch_discovery_rows(query: str, endpoint: str, user_agent: str, timeout: int, retries: int, backoff_seconds: float) -> list[dict[str, str]]:
  body = urllib.parse.urlencode(
    {
      "query": query,
      "format": "json"
    }
  ).encode("utf-8")

  request = urllib.request.Request(
    endpoint,
    data=body,
    headers={
      "Accept": "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": user_agent
    },
    method="POST"
  )

  payload_raw = request_with_retries(request, timeout, retries, backoff_seconds)
  payload = json.loads(payload_raw.decode("utf-8"))

  bindings = payload.get("results", {}).get("bindings", [])
  if not isinstance(bindings, list):
    return []

  rows: list[dict[str, str]] = []
  for binding in bindings:
    if not isinstance(binding, dict):
      continue

    item = binding.get("item", {}).get("value", "")
    item_label = binding.get("itemLabel", {}).get("value", "")
    formula = binding.get("formula", {}).get("value", "")
    class_label = binding.get("classLabel", {}).get("value", "")

    if not item:
      continue

    rows.append(
      {
        "item": item,
        "itemLabel": item_label,
        "formula": formula,
        "classLabel": class_label,
      }
    )

  return rows


def chunked(values: list[str], size: int) -> list[list[str]]:
  return [values[index:index + size] for index in range(0, len(values), size)]


def fetch_sitelinks(
  item_ids: list[str],
  preferred_wikipedia_langs: list[str],
  wikidata_api_url: str,
  user_agent: str,
  timeout: int,
  retries: int,
  backoff_seconds: float
) -> dict[str, list[str]]:
  if not item_ids:
    return {}

  sitelinks_by_item: dict[str, list[str]] = {item_id: [] for item_id in item_ids}

  for batch in chunked(sorted(set(item_ids)), 50):
    params = {
      "action": "wbgetentities",
      "format": "json",
      "ids": "|".join(batch),
      "props": "sitelinks",
    }
    url = f"{wikidata_api_url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})

    payload_raw = request_with_retries(request, timeout, retries, backoff_seconds)
    payload = json.loads(payload_raw.decode("utf-8"))
    entities = payload.get("entities", {})
    if not isinstance(entities, dict):
      continue

    for item_id, entity in entities.items():
      if not isinstance(entity, dict):
        continue
      sitelinks = entity.get("sitelinks", {})
      if not isinstance(sitelinks, dict):
        continue

      all_wikipedia_entries: list[tuple[str, str]] = []
      for site_key, link in sitelinks.items():
        if not isinstance(link, dict):
          continue
        lang = parse_wikipedia_language_from_site_key(site_key)
        if lang is None:
          continue
        title = link.get("title")
        if not isinstance(title, str) or not title:
          continue
        all_wikipedia_entries.append((lang, title))

      all_wikipedia_entries.sort(key=lambda entry: (entry[0], entry[1]))

      entries_by_lang: dict[str, tuple[str, str]] = {}
      for entry in all_wikipedia_entries:
        lang = entry[0]
        if lang not in entries_by_lang:
          entries_by_lang[lang] = entry

      selected_preferred_entries: list[tuple[str, str]] = []
      for lang in preferred_wikipedia_langs:
        entry = entries_by_lang.get(lang)
        if entry is None:
          continue
        selected_preferred_entries.append(entry)
        if len(selected_preferred_entries) >= MAX_PREFERRED_LINKS:
          break

      if selected_preferred_entries:
        selected_entries = selected_preferred_entries
      else:
        selected_entries = all_wikipedia_entries[:MAX_FALLBACK_LINKS]

      formatted_entries: list[str] = []
      for lang, title in selected_entries:
        article_url = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
        formatted_entries.append(f"{lang}: {title} <{article_url}>")

      sitelinks_by_item[item_id] = formatted_entries

  return sitelinks_by_item


def convert_mathml_formulas_to_latex(formulas: list[str], converter_script: Path) -> list[str]:
  if not converter_script.exists():
    raise FileNotFoundError(f"Converter script not found: {converter_script}")

  payload = json.dumps(formulas, ensure_ascii=False)
  completed = subprocess.run(
    ["node", str(converter_script)],
    input=payload,
    capture_output=True,
    text=True,
    check=False,
  )
  if completed.returncode != 0:
    stderr = completed.stderr.strip()
    details = stderr if stderr else "unknown converter error"
    raise ValueError(f"MathML to LaTeX conversion failed: {details}")

  try:
    converted = json.loads(completed.stdout)
  except json.JSONDecodeError as exc:
    raise ValueError("Failed to parse MathML converter output as JSON.") from exc

  if not isinstance(converted, list):
    raise ValueError("MathML converter returned non-list output.")
  if len(converted) != len(formulas):
    raise ValueError("MathML converter output length does not match input length.")

  normalized: list[str] = []
  for value in converted:
    normalized.append(value if isinstance(value, str) else "")
  return normalized


def write_csv(
  output_path: Path,
  rows: list[dict[str, str]],
  formula_latex_values: list[str],
  sitelinks_by_item: dict[str, list[str]]
) -> None:
  output_path.parent.mkdir(parents=True, exist_ok=True)

  with output_path.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
    writer.writeheader()

    for index, row in enumerate(rows):
      item_uri = row.get("item", "")
      item_id = parse_item_id(item_uri)
      wikipedia_pages = " | ".join(sitelinks_by_item.get(item_id, []))
      formula_latex = formula_latex_values[index] if index < len(formula_latex_values) else ""

      writer.writerow(
        {
          "item": item_uri,
          "itemLabel": row.get("itemLabel", ""),
          "formula": row.get("formula", ""),
          "formula_latex": formula_latex,
          "classLabel": row.get("classLabel", ""),
          "wikipediaPages": wikipedia_pages,
        }
      )


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Download formula candidates via WDQS, then enrich with Wikipedia sitelinks via Wikidata API."
  )
  parser.add_argument("--query-file", type=Path, default=DEFAULT_QUERY_FILE)
  parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE)
  parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
  parser.add_argument("--wikidata-api-url", default=DEFAULT_WIKIDATA_API_URL)
  parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
  parser.add_argument("--timeout", type=int, default=60)
  parser.add_argument("--retries", type=int, default=2)
  parser.add_argument("--retry-backoff-seconds", type=float, default=1.5)
  parser.add_argument("--converter-script", type=Path, default=DEFAULT_CONVERTER_SCRIPT)
  parser.add_argument(
    "--wikipedia-langs",
    default=DEFAULT_WIKIPEDIA_LANGS,
    help=(
      "Comma-separated preferred Wikipedia language codes for sitelinks. "
      "At most 2 links are selected from this ordered list per item; "
      "if none exist, the script falls back to any 2 available Wikipedia sitelinks."
    ),
  )
  return parser.parse_args()


def main() -> None:
  args = parse_args()

  try:
    query = read_query(args.query_file)
    preferred_wikipedia_langs = parse_wikipedia_langs(args.wikipedia_langs)

    rows = fetch_discovery_rows(
      query=query,
      endpoint=args.endpoint,
      user_agent=args.user_agent,
      timeout=args.timeout,
      retries=args.retries,
      backoff_seconds=args.retry_backoff_seconds,
    )

    item_ids = [parse_item_id(row["item"]) for row in rows]
    sitelinks_by_item = fetch_sitelinks(
      item_ids=item_ids,
      preferred_wikipedia_langs=preferred_wikipedia_langs,
      wikidata_api_url=args.wikidata_api_url,
      user_agent=args.user_agent,
      timeout=args.timeout,
      retries=args.retries,
      backoff_seconds=args.retry_backoff_seconds,
    )
    formula_latex_values = convert_mathml_formulas_to_latex(
      formulas=[row.get("formula", "") for row in rows],
      converter_script=args.converter_script,
    )

    write_csv(args.output, rows, formula_latex_values, sitelinks_by_item)

    print(f"Discovered rows: {len(rows)}")
    print(f"Preferred sitelink languages (max {MAX_PREFERRED_LINKS} per item): {', '.join(preferred_wikipedia_langs)}")
    print(f"MathML formulas converted to LaTeX: {sum(1 for value in formula_latex_values if value.strip())}")
    print(f"Wrote CSV to {args.output}")

  except (FileNotFoundError, ValueError) as exc:
    print(f"Error: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc
  except urllib.error.HTTPError as exc:
    details = exc.read().decode("utf-8", errors="replace").strip()
    print(f"HTTP error: {exc.code} {exc.reason}", file=sys.stderr)
    if details:
      print(f"Response body: {details[:500]}", file=sys.stderr)
    raise SystemExit(1) from exc
  except urllib.error.URLError as exc:
    print(f"Network error: {exc.reason}", file=sys.stderr)
    raise SystemExit(1) from exc
  except TimeoutError as exc:
    print(
      f"Timeout error. Consider increasing --timeout (current: {args.timeout}s).",
      file=sys.stderr,
    )
    raise SystemExit(1) from exc
  except json.JSONDecodeError as exc:
    print(f"Failed to parse JSON response: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc


if __name__ == "__main__":
  main()
