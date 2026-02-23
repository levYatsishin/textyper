![math latex typer cover](post-tech-design/images/cover_smooth.png)
# math latex typer
Minimal trainer for typing LaTeX math quickly.

**Heavely** inspired by [typelatex](https://www.typelatex.com)([github](https://github.com/JaidenRatti/type-latex)) and therefore as the geneology goes by [texnique](https://texnique.xyz)([github](https://github.com/akshayravikumar/TeXnique)).
## What it does
- Shows a rendered target formula.
- You type LaTeX in the input.
- It auto-advances when your input is correct.
- You can filter formulas by difficulty, topic and subtopic.
- Progress and best scores are saved locally in your browser.
## Current features
- `60` second, `120` seconds, and `zen` modes.
- Difficulty filters (`easy`, `medium`, `hard`) with multi-select.
- Topic + subtopic multi-select dropdown with search.
- `show formula` toggle for revealing target raw LaTeX.
- Live rendered preview of what you are typing.
- Auto-advance flow (`skip` available).
- Light/dark theme toggle.
- Persistent session history and bests (localStorage).
## What is different from analogs
**TODO**
## FAQ
### About difficulty 
Difficulty is based on **typing complexity**, not conceptual math depth. It uses a deterministic complexity score from expression structure and symbol load. You can read about it more in ... **TODO** 
### Why sum of subtopics formulas is larger than topics total formulas 
A single formula can belong to multiple topics/subtopics. Counts are membership totals, not mutually exclusive buckets.
## Planned features
- Render-aware correctness check 
- scores for zen, and time counter. better statistics
- a small FAQ section under ? sing in the top left corne
- parse more formulas from wikipedea, wikidata, proof wiki
- load custom user formulas
- hover on symbol to show latex for it
- symbols library as a separate page
- integrate auto-shortcuts 
- better ontology and llm auto classification
- Gamefication mode: add rarity to formulas and probability of them appearing (for the first time / after they appeared once) with some collors and little effects. Bestiary/collection.
## Tech stack
- Svelte 5 + Vite + TypeScript
- KaTeX
- html2canvas + pixelmatch
- Vitest + Testing Library
## Quick start
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.
## Project structure
- `src/` – app code
- `src/lib/data/expressions.ts` – formula dataset
- `src/lib/services/` – matcher, persistence, complexity scoring
- `src/lib/stores/gameStore.ts` – game/session state
- `tools/complexity/` – scoring diagnostics/tooling
- `tools/formula_ingest/` – offline dataset ingestion pipeline
## Contributing
Ideas are always welcome via issues/discussions

PRs are also welcome for:
- formula quality improvements
- topic/subtopic classification fixes
- reliability/performance improvements in matcher and ingestion tools
## License
