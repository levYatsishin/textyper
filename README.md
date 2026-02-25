![math latex typer cover](post-tech-design/images/cover_smooth.png)
<div align="center">
  <h1>math latex typer</h1>
</div>

Minimal trainer for typing LaTeX math quickly.

**Heavily** inspired by [typelatex](https://github.com/JaidenRatti/type-latex) and therefore, as the geneology goes, by [texnique](https://github.com/akshayravikumar/TeXnique).
## What it does
- Shows a rendered target formula.
- You type LaTeX in the input that must produce the same render.
- It auto-advances when your input is correct.
- You can filter formulas by difficulty, topic and subtopic.
- Progress and best scores are saved locally in your browser.
## Other features
- When you’re learning, you can enable “show formula”, so you can just retype the answer to learn new symbols and syntax. As you're doing this only for yourself there is no cheating, so it won't be anyhow reflected on the statistics. Double-clik the formula box to copy it.
- You can also look up how individual symbols and tokens are written by just hovering over them in the rendered formula. Double-clicking while doing this, copies the code for them.
- After 5 minutes of inactivity in zen mode session automaticaly end to not spoil statistics. 
- When all formulas in the current pool have been used, the pool resets and the formulas are reshuffled; the reset time isn’t counted toward the timers.
### Difficulty 
Difficulty is based on **typing complexity**, not conceptual math depth. It uses a deterministic complexity score from expression structure and symbol load. You can read about it more in [`ARCHITECTURE.md`](ARCHITECTURE.md).
### Local storage
History cap for session storage is currently set to 500. After reaching this limit the very first session will be deleted to reclaim space for the new one.

The whole history, as well as individual sessions, can be deleted by pressing a little bin icon next to them (a confirmation message first will be shown).
### Statistics
Statistics rail is hidden at the bottom of the page, under an arrow. It provides an overview of your progress.

First 3 metrics (i.e. accuracy, min/formula, chars/min) are calculated withing a rolling window of 7 last sessions. This is because while practicing, you improve your results and old attempts can significantly ruin these metrics, making the overall impression misleading. The next 3 metrics (i.e. best streak, total attempts, and time elapsed), on the other hand, are calculated over the entire history, because they are there to show you some big numbers, make you feel proud of the efforts you put into your skill and inspire you to continue. 

Scoring formula for calculating the top 5 best sessions is documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

While session is runnig, statistics rail is calculating specifically for this session in a live format. But you can peek at the overall value of a metric by hovering over its box. 
### Topics 
Any single formula can belong to multiple topics/subtopics. Counts in the list are membership totals, not mutually exclusive buckets.

Moreover, classification was mostly automatic and, to be honest, should not be treated too seriously, only as a helpful hint. You can hover on the displayed topic of the current formula and see to which other ones it also belongs. (Although I hope this will be improved in future) 

Note that when you filter formulas by difficulty, the formulas shown in the topic selection are filtered as well – so don’t be surprised if there are fewer of them listed.
## Comparison
**TODO**
## Planned features
- Render-aware correctness check 
- load custom user formulas
    - export statistics (and formulas?)
- better formulas
    - better ontology and llm auto classification
    - parse more formulas from wikipedea, wikidata, proof wiki
- integrate auto-shortcuts/expansions 
- ?
    - symbols library as a separate page
    - Gamefication mode: add rarity to formulas and probability of them appearing (for the first time / after they appeared once) with some collors and little effects. Bestiary/collection.
## Run it yourself 
```bash
git clone https://github.com/levYatsishin/textyper.git
cd textyper 
npm install
npm run dev
```
Open `http://localhost:5173`.
## Project structure
- `src/lib/data/formulas.v1.json` – runtime formula source of truth
- `src/lib/data/expressions.ts` – JSON-backed dataset export
- `src/lib/data/expressionsLoader.ts` – JSON schema validation/loader
- `src/lib/services/` – matcher, persistence, complexity scoring
- `src/lib/stores/gameStore.ts` – game/session state
- `tools/complexity/` – scoring diagnostics/tooling
- `tools/formula_ingest/` – offline dataset ingestion pipeline

## Formula dataset workflow
- Runtime reads formulas from `src/lib/data/formulas.v1.json`.
- `expressionsLoader` validates every record (difficulty enums, score range, non-empty topics/subtopics, known topic IDs, unique IDs).
- Offline ingestion can export app-ready payloads in the same shape via `tools/formula_ingest/src/export_for_app.py`.
- After dataset updates, run `npm run check && npm run test:run` to validate schema and app compatibility.
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
