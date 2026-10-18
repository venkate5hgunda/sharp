# Sharp ⚡

A progressive, offline-first Progressive Web App (PWA) for cognitive fitness training across **Memory**, **Logic**, **Math**, and **Comprehension**. 

Built with zero external framework dependencies (pure modern HTML5, CSS3, ES Modules), Sharp features dynamic difficulty adjustment (DDA), Web Audio synthesis, local persistence, daily streak tracking, push notifications, and single-file backup with schema migrations.

---

## Cognitive Domains & Exercises

### 1. Memory: Time-Capsule Recall (Morning &amp; Evening Protocol)
- **Morning Study Phase**: Presents $N$ items (curated words, mnemonic cues, 3-digit security codes, and associative pairs) calibrated to your memory rating.
- **Natural Interference Delay**: Items consolidate in memory over 6–12 hours (with a flexible "3-Minute Fast-Track" mode for on-demand practice).
- **Evening Retrieval Phase**: Tests recall through free retrieval and recognition challenges featuring engineered distractor foils (semantic siblings, phonetic distractors, and digit transpositions).
- **Retention Curve Tracking**: Analyzes decay rate, precision, and latency over time.

### 2. Focus: Pattern Flash &amp; Interference
- **Target Presentation**: Displays a sequence of distinct matrix patterns on $3\times3$, $4\times4$, or $5\times5$ grids.
- **Interference Phase**: Rapidly flashes confusing, irrelevant distractor patterns to induce retroactive cognitive interference.
- **Reconstruction Phase**: Prompts the player to recall and manually draw/reconstruct specific target patterns on an interactive tactile grid.
- **Fidelity Scoring**: Computes exact cell overlap, true positives, and false alarms.

### 3. Math &amp; Quantitative Reasoning
- **Mental Arithmetic Engine**: Rapid-fire adaptive arithmetic scaling from single-digit operations to multi-step BODMAS with negative numbers, fractions, and percentages.
- **Story Math &amp; Comprehension**: Procedural real-world word problems ("Jack has $X$ apples, gave Jill $Y$, while Jill's brother doubled her share..."). Tests verbal translation into quantitative deduction.

### 4. Logic &amp; Analytical Reasoning
- **Deductive Syllogisms**: Evaluates categorical premises (Universal &amp; Particular, Affirmative &amp; Negative), testing for valid conclusions while exposing common logical fallacies.
- **Order &amp; Ranking Constraints**: Deduces exact chronological and relative positions under incomplete information.
- **Knights &amp; Knaves**: Solves truth-teller and liar paradoxes using case analysis.

### 5. Verbal Comprehension &amp; Speed Inference
- **Analytical Reading Passages**: Concise texts spanning marine biology, atmospheric physics, medieval cartography, and cognitive neuroscience.
- **Critical Deductions**: Distinguishes guaranteed implications from extraneous claims, tests necessary assumptions, and identifies structural paradoxes.

### 6. Working Memory: Spatial Corsi Span
- **Block-Tapping Task**: Observes a sequence of illuminated blocks across a randomized matrix and repeats the exact sequence. Dynamically expands memory span from 3 to 9+ blocks.

---

## Dynamic Difficulty Adjustment (DDA)

Sharp keeps the brain in a continuous "flow state" using an adaptive rating engine:
- Every domain has an independent skill rating (default `1000`).
- Ratings adjust based on accuracy, challenge tier, and speed relative to benchmark response latencies.
- Challenges automatically scale across **7 continuous tiers** (Foundational $\rightarrow$ Novice $\rightarrow$ Intermediate $\rightarrow$ Proficient $\rightarrow$ Advanced $\rightarrow$ Expert $\rightarrow$ Master).

---

## Comprehensive Question Dataset &amp; Continuous Hydration

Sharp includes an extensive curriculum in `data/`:
- **Categorized Puzzles**: Logic syllogisms, math word problems, reading passages, and memory clusters with pedagogical step-by-step solutions and distractor rationales.
- **Runtime Hydration**: As you solve puzzles, Sharp records attempt frequency, accuracy rates, and latency into the dataset metadata in `localStorage`.
- **Import &amp; Export**: Export the fully hydrated question database as JSON, or import custom question packs with automatic validation and deduplication.

---

## Privacy, Offline PWA &amp; Daily Backup

- **100% Client-Side &amp; Private**: Zero telemetry, zero analytics tracking, zero cookies, zero external servers.
- **Offline Service Worker**: Precaches all HTML, CSS, JavaScript modules, SVG icons, and questions. Works seamlessly on planes, subways, and offline mode.
- **Single-File Backup**: Export your complete progress, ratings, and streaks into a single file (`sharp-backup-YYYY-MM-DD.json`) with checksum validation and schema migrations.
- **Daily Routine Notifications**: Configurable Web Notifications for morning item drops (`08:30`), evening recall checks (`19:30`), and streak preservation alerts.

---

## Local Development

No build step or bundler is required. ES modules run natively in any modern browser:

```bash
cd sharp
# Serve locally over HTTP
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## Automated Test Suite

Sharp's core logic (DDA rating updates, math generators, dataset queries, schema validation, and checksum verification) is tested using Node's built-in test runner:

```bash
npm test
```

---

## License

MIT License. Designed and crafted with precision.
