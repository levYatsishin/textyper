# Architecture: Scoring Systems
This document describes the two scoring systems used in the app:
1. **Formula difficulty scoring** (`beginner | intermediate | advanced`)
2. **Session bestness scoring** (ranking for **Best 5**)
UI label mapping:
- `beginner` → `easy`
- `intermediate` → `medium`
- `advanced` → `hard`
---
## 1) Formula Difficulty Scoring (Typing Complexity Score)
Implementation: [`src/lib/services/complexity.ts`](src/lib/services/complexity.ts)
### 1.1 Goal
Assign each LaTeX expression:
- a numeric complexity score in `[0..100]`
- a difficulty band:
  - `beginner` if score `<= 32`
  - `intermediate` if score `33..49`
  - `advanced` if score `>= 50`
### 1.2 Core formula
For each feature `i`:
- `n_i = min(raw_i / cap_i, 1)`
- `score = round(sum(weight_i * n_i))`
- final clamp: `score = min(100, max(0, score))`
Weights sum to 100, so score is naturally bounded.
### 1.3 Features, caps, weights
| # | Feature | Cap | Weight |
|---|---|---:|---:|
| 1 | non-whitespace char count | 90 | 18 |
| 2 | command count (`\foo`, `\%`) | 14 | 8 |
| 3 | command-name letters total | 55 | 7 |
| 4 | control-symbol escapes (`\%`, `\_`, ...) | 4 | 2 |
| 5 | delimiter/group tokens (`{}[]()`, `\left/\right`) | 16 | 3 |
| 6 | max group nesting depth | 4 | 7 |
| 7 | script operators (`^` + `_`) | 10 | 6 |
| 8 | max script nesting depth | 3 | 5 |
| 9 | fraction/root/binomial count | 5 | 6 |
|10 | fraction/root/binomial nesting depth | 3 | 5 |
|11 | large-operator count (`\sum`, `\int`, ...) | 4 | 4 |
|12 | relation/comparison count (`=`, `<`, `\leq`, ...) | 6 | 2 |
|13 | delimiter sizing/control count (`\left`, `\Big`, ...) | 3 | 2 |
|14 | matrix/alignment complexity | 5 | 5 |
|15 | accent/decorator count (`\hat`, `\vec`, ...) | 4 | 3 |
|16 | command rarity load | 8 | 17 |
### 1.4 Rarity load (feature 16)
For each command token:
- Tier 0 (very common) = `0.4`
- Tier 1 (common) = `1.0`
- Tier 2 (known but less common) = `1.9`
- Tier 3 (unknown/unmapped command) = `2.8`
`commandRarityLoad = sum(token tier weights)`
Catalog source (used by runtime classifier):
- [`src/lib/data/latexCommandCatalog.ts`](src/lib/data/latexCommandCatalog.ts)
### 1.5 Difficulty band conversion
`classifyComplexity(score)`:
- `0..32` → `beginner`
- `33..49` → `intermediate`
- `50..100` → `advanced`
---
## 2) Session Bestness Scoring (Best 5 ranking)
Implementation: [`src/lib/services/persistence.ts`](src/lib/services/persistence.ts)
### 2.1 Goal
Rank completed sessions globally and keep top 5:
- `computeBestScores(history) = history.sorted(compareBestness).slice(0, 5)`
Bestness is difficulty-aware and volume-aware, with protection against short perfect samples dominating.
### 2.2 Difficulty weights used inside session ranking
- `beginner`: `1.0`
- `intermediate`: `1.8`
- `advanced`: `3.0`
### 2.3 Core bestness formula
Given per-difficulty stats:
- `given_d`, `solved_d` for each difficulty
Compute:
- `weightedGiven = 1*given_beginner + 1.8*given_intermediate + 3*given_advanced`
- `weightedSolved = 1*solved_beginner + 1.8*solved_intermediate + 3*solved_advanced`
- `weightedSolvedRatio = weightedGiven > 0 ? (weightedSolved / weightedGiven) * 100 : 0`
Sample-size confidence on accuracy:
- `attemptsConfidence = clamp(attempts / 12, 0, 1)`
- `confidenceAdjustedAccuracy = accuracy * (0.35 + 0.65 * attemptsConfidence)`
Other terms:
- `normalizedCorrect = clamp((correct / 20) * 100, 0, 100)`
- `hardSolvedBonus = advancedSolved > 0 ? 100 : 0`
Final:
- `bestness = 0.35*confidenceAdjustedAccuracy`
  `+ 0.35*weightedSolvedRatio`
  `+ 0.25*normalizedCorrect`
  `+ 0.05*hardSolvedBonus`
Stored with 4 decimals (`toFixed(4)` equivalent).
### 2.4 Tie-breakers (if bestness equal)
In order:
1. more `advanced.solved`
2. more `correct`
3. higher `accuracy`
4. more recent `endedAt`
---
## 3) Data-flow summary
- Formula difficulty is precomputed by complexity analyzer and stored on expressions.
- Session stats are stored in browser history.
- Best list is **derived from history** each time (`top 5`), not independently authored.
