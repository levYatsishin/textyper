from dataclasses import dataclass, field
from typing import Any


@dataclass
class ExtractedFormula:
  latex: str
  source: str
  page_title: str | None = None
  page_id: str | None = None
  expression_name: str | None = None
  difficulty_hint: str | None = None
  metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CuratedFormula:
  latex: str
  difficulty: str
  name: str
  topics: list[str]
  source: str
  metadata: dict[str, Any] = field(default_factory=dict)
