import argparse
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from io_utils import write_jsonl

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
DEFAULT_USER_AGENT = "textyper-formula-ingest/1.0 (local formula pipeline)"
MATH_TAG_PATTERN = re.compile(r"<math[^>]*>(.*?)</math>", re.IGNORECASE | re.DOTALL)


def chunked(values: list[str], size: int) -> list[list[str]]:
  return [values[index:index + size] for index in range(0, len(values), size)]


def normalize_latex(raw: str) -> str:
  value = html.unescape(raw).strip()
  value = re.sub(r"\s+", " ", value)
  return value


def load_titles(path: Path) -> list[str]:
  with path.open("r", encoding="utf-8") as handle:
    rows = [line.strip() for line in handle.readlines()]
  return [row for row in rows if row and not row.startswith("#")]


def fetch_pages(titles: list[str], user_agent: str) -> list[dict]:
  params = {
    "action": "query",
    "format": "json",
    "formatversion": "2",
    "prop": "revisions|pageprops",
    "rvprop": "content",
    "rvslots": "main",
    "titles": "|".join(titles)
  }
  url = f"{WIKIPEDIA_API_URL}?{urllib.parse.urlencode(params)}"
  request = urllib.request.Request(url, headers={"User-Agent": user_agent})
  with urllib.request.urlopen(request, timeout=30) as response:
    payload = json.loads(response.read().decode("utf-8"))

  pages = payload.get("query", {}).get("pages", [])
  if not isinstance(pages, list):
    return []
  return [page for page in pages if isinstance(page, dict) and not page.get("missing")]


def extract_from_wikipedia_titles(
  titles_path: Path,
  output_path: Path,
  batch_size: int = 20,
  user_agent: str = DEFAULT_USER_AGENT
) -> int:
  rows: list[dict] = []
  titles = load_titles(titles_path)

  for batch in chunked(titles, max(1, batch_size)):
    pages = fetch_pages(batch, user_agent)
    for page in pages:
      title = page.get("title")
      page_id = page.get("pageid")
      pageprops = page.get("pageprops", {})
      revisions = page.get("revisions", [])
      if not revisions:
        continue

      revision = revisions[0]
      slots = revision.get("slots", {})
      main_slot = slots.get("main", {})
      text = main_slot.get("content") or ""
      matches = MATH_TAG_PATTERN.findall(text)

      for raw_latex in matches:
        latex = normalize_latex(raw_latex)
        if not latex:
          continue
        rows.append(
          {
            "latex": latex,
            "source": "wikipedia-api",
            "page_title": title,
            "page_id": str(page_id) if page_id is not None else None,
            "metadata": {
              "wikidata_item_id": pageprops.get("wikibase_item"),
              "page_url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(str(title).replace(' ', '_'))}"
            }
          }
        )

  write_jsonl(output_path, rows)
  return len(rows)


def main() -> None:
  parser = argparse.ArgumentParser(description="Extract <math> formulas from Wikipedia pages via API.")
  parser.add_argument("--titles-file", required=True, type=Path)
  parser.add_argument("--output", required=True, type=Path)
  parser.add_argument("--batch-size", type=int, default=20)
  parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
  args = parser.parse_args()

  extracted_count = extract_from_wikipedia_titles(
    titles_path=args.titles_file,
    output_path=args.output,
    batch_size=args.batch_size,
    user_agent=args.user_agent
  )
  print(f"Extracted {extracted_count} formulas from titles in {args.titles_file}")
  print(f"Wrote output to {args.output}")


if __name__ == "__main__":
  main()
