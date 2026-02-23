import json
from pathlib import Path
from typing import Iterable


def ensure_parent(path: Path) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)


def write_jsonl(path: Path, rows: Iterable[dict]) -> None:
  ensure_parent(path)
  with path.open("w", encoding="utf-8") as handle:
    for row in rows:
      handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
  if not path.exists():
    return []
  rows: list[dict] = []
  with path.open("r", encoding="utf-8") as handle:
    for line in handle:
      line = line.strip()
      if not line:
        continue
      rows.append(json.loads(line))
  return rows


def write_json(path: Path, payload: object) -> None:
  ensure_parent(path)
  with path.open("w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
