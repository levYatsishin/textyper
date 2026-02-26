![math latex typer cover](post-tech-design/images/cover_smooth.png)
<div align="center">
  <h1>math latex typer</h1>
</div>

Minimal trainer for typing LaTeX math quickly. QoL features included.

**Heavily** inspired by [typelatex](https://github.com/JaidenRatti/type-latex) and therefore, as the geneology goes, by [texnique](https://github.com/akshayravikumar/TeXnique).
## What it does
- Shows a rendered target formula.
- You type LaTeX code in the input that must produce the same render.
- It auto-advances when your input is correct.
- You can filter formulas by difficulty, topic and subtopic.
- Progress and best scores are saved locally in your browser.
## Features
### Hints
1. When you’re learning, you can enable “show formula” mode. It will show the answer under each render, so you can just retype it to learn new symbols and syntax. Double-clik this codeblock to copy it.
2. You can also look up the code for individual rendered symbols and structures just by hovering over them in the target formula (note that, they are nested, so move your cursor around complex strutures to get differnt depth levels). Double-clicking while doing this, copies the code for the selected one.

As you're doing this only for yourself you cannot really "cheat", so it won't be anyhow reflected on the statistics. 
### Difficulty 
Difficulty is based on **typing complexity**, not conceptual math depth. It uses a deterministic complexity score from expression structure and symbol load. You can read more about it in [`ARCHITECTURE.md`](ARCHITECTURE.md).
### Local storage
1. History cap for session storage is currently set to 500. After reaching this limit the very first session will be deleted to reclaim space for the new one.
2. The whole history, as well as individual sessions, can be deleted by pressing a little bin icon next to them (a confirmation message first will be shown).
### Statistics
1. Statistics rail is hidden at the bottom of the page, under an arrow. It provides an overview of your progress.
2. First 3 metrics (i.e. accuracy, min/formula, chars/min) are calculated withing a rolling window of 7 last sessions. This is because while practicing, you improve your results and old attempts can significantly ruin these metrics, making the overall impression misleading. The next 3 metrics (i.e. best streak, total attempts, and time elapsed), on the other hand, are calculated over the entire history, because they are there to show you some big numbers, make you feel proud of the efforts you put into your skill and inspire you to continue. 
3. Best 5 list is derived from all the session stored and ranged based on a scoring formula. You can read more on it in [`ARCHITECTURE.md`](ARCHITECTURE.md).
4. While session is runnig, statistics rail is calculating specifically for this session in real time. But you can peek at the overall value of a metric by hovering over its box. 
5. You can expand each session info by pressing a little arrow on the right.
### Topics 
Any single formula can belong to multiple topics/subtopics. Counts in the list are membership totals, not mutually exclusive buckets.

Moreover, classification was mostly automatic and, to be honest, should not be treated too seriously, only as a helpful hint. You can hover on the displayed topic of the current formula and see to which other ones it also belongs. (Although I hope this will be improved in future) 

Note that when you filter formulas by difficulty, the formulas shown in the topic selection are filtered as well – so don’t be surprised if there are fewer of them listed.
### Other things you should know
- After 5 minutes of inactivity in zen mode, session automaticaly ends, therefore preventing spoiling of statistics. 
- In zen mode ticking timer is hidden and can be viewed bellow live preview by hovering over a little dot. This is to minize distraction. 
- When all formulas in the current pool have been shown, the pool resets and the formulas are reshuffled; the reset time isn’t counted toward the timers.
- Dark theme is set by default, but it can be changed to light at the top right corner. Themes are based on Gruvbox Material ([morhetz](https://github.com/morhetz/gruvbox) → [sainnhe](https://github.com/sainnhe/gruvbox-material))
## Comparison
**TODO**
## Motivation
Some time ago, I found an incredible [Readest](https://readest.com) app. Since then, I have stopped reading any serious literature both on paper and on e-readers. It became clear that reading ebooks on a computer or phone, with all these features, is superior. The same thing happened to me around 5 years ago, when I stumbled upon Obsidian. It took me some time back then to learn to type faster, but now writing stuff on a computer instead of on paper is so much more convenient that I can hardly imagine going back.

So I thought that maybe doing math entirely on a computer will be more fun and convenient. But first I need to master the technique.
## Planned features
- better formulas
    - better ontology and llm auto classification
    - parse more formulas from wikipedea, wikidata, proof wiki
- load custom user formulas
    - export statistics (and formulas?)
- integrate auto-shortcuts/expansions 
- tauri
- ?
    - symbols library as a separate page
    - Gamefication mode: add rarity to formulas and probability of them appearing (for the first time / after they appeared once) with some collors and little effects. Bestiary/collection.
    - lean/agda 
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
