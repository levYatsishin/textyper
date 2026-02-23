import argparse
import html
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from io_utils import write_jsonl

MATH_TAG_PATTERN = re.compile(r"<math[^>]*>(.*?)</math>", re.IGNORECASE | re.DOTALL)


def normalize_latex(raw: str) -> str:
  value = html.unescape(raw).strip()
  value = re.sub(r"\s+", " ", value)
  return value


def extract_from_wikipedia_dump(dump_path: Path, output_path: Path) -> int:
  rows: list[dict] = []
  page_count = 0

  context = ET.iterparse(dump_path, events=("end",))
  for _, element in context:
    if not element.tag.endswith("page"):
      continue

    page_count += 1
    title = element.findtext("./{*}title")
    page_id = element.findtext("./{*}id")
    text = element.findtext("./{*}revision/{*}text") or ""
    matches = MATH_TAG_PATTERN.findall(text)

    for raw_latex in matches:
      latex = normalize_latex(raw_latex)
      if not latex:
        continue
      rows.append(
        {
          "latex": latex,
          "source": "wikipedia",
          "page_title": title,
          "page_id": page_id,
          "metadata": {}
        }
      )

    element.clear()

  write_jsonl(output_path, rows)
  return page_count


def main() -> None:
  parser = argparse.ArgumentParser(description="Extract <math> formulas from a Wikipedia XML dump.")
  parser.add_argument("--wiki-dump", required=True, type=Path)
  parser.add_argument("--output", required=True, type=Path)
  args = parser.parse_args()

  processed_pages = extract_from_wikipedia_dump(args.wiki_dump, args.output)
  print(f"Processed {processed_pages} pages")
  print(f"Wrote extracted formulas to {args.output}")


if __name__ == "__main__":
  main()
