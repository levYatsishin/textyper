![math latex typer cover](post-tech-design/images/cover_smooth.png)
# math latex typer
Minimal trainer for typing LaTeX math quickly.

**Heavily** inspired by [typelatex](https://github.com/JaidenRatti/type-latex) and therefore, as the geneology goes, by [texnique](https://github.com/akshayravikumar/TeXnique).
## What it does
- Shows a rendered target formula.
- You type LaTeX in the input.
- It auto-advances when your input is correct.
- You can filter formulas by difficulty, topic and subtopic.
- Progress and best scores are saved locally in your browser.
## Comparison
**TODO**
## FAQ
### About difficulty 
Difficulty is based on **typing complexity**, not conceptual math depth. It uses a deterministic complexity score from expression structure and symbol load. You can read about it more in ... **TODO** 
### About numbers of formulas in categories 
A single formula can belong to multiple topics/subtopics. Counts are membership totals, not mutually exclusive buckets.
## Planned features
- Render-aware correctness check 
- scores for zen, and time counter. better statistics
- a small FAQ section under ? sing in the top left corner
- parse more formulas from wikipedea, wikidata, proof wiki
- load custom user formulas
- hover on symbol to show latex for it
- symbols library as a separate page
- integrate auto-shortcuts 
- better ontology and llm auto classification
- Gamefication mode: add rarity to formulas and probability of them appearing (for the first time / after they appeared once) with some collors and little effects. Bestiary/collection.
## Quick start
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.
## Project structure
- `src/lib/data/expressions.ts` – formula dataset
- `src/lib/services/` – matcher, persistence, complexity scoring
- `src/lib/stores/gameStore.ts` – game/session state
- `tools/complexity/` – scoring diagnostics/tooling
- `tools/formula_ingest/` – offline dataset ingestion pipeline
## Contributing
Ideas and improvements are always welcome via issues, PRs or even direct messages.

## License
`math latex typer` is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License, either version 3 of the License, or (at your option) any later version. See the `LICENSE` file for details.

The following libraries and frameworks are used in this software:
- `katex`, which is MIT licensed.
- `html2canvas`, which is MIT licensed.
- `pixelmatch`, which is ISC licensed.
- `svelte`, which is MIT licensed.
- `vite`, which is MIT licensed.
- `typescript`, which is Apache-2.0 licensed.
- `vitest`, which is MIT licensed.
- `@testing-library/svelte`, which is MIT licensed.
- `jsdom`, which is MIT licensed.
