# Sharp Architecture and Data Engine Specification

Last reviewed: 2026-10-18. This document is the **current-state reference** for Sharp's system architecture, offline persistence contract, question hydration pipeline, and dynamic difficulty adjustment engine.

---

## 1. System Overview

Sharp is a static, zero-dependency, offline-first Progressive Web App (PWA) built with modern Vanilla HTML5, CSS3, and ES Modules:

```text
index.html -> js/app.js -> js/router.js -> js/views/workout-view.js
                                 |          -> js/views/catalog-view.js
                                 |          -> js/views/analytics-view.js
                                 |          -> js/views/backup-view.js
                                 |          -> js/views/settings-view.js
                                 |
                                 -> js/games/<game>.js
                                           |
                                           +-> data/questions-db.js <-> data/domains/*.js
                                           |
                                           +-> js/adaptive-engine.js
                                           +-> js/analytics.js
                                           +-> js/storage.js (localStorage + schema v1)
                                           +-> js/audio.js (Web Audio synthesis)
                                           +-> js/haptics.js (Navigator.vibrate)
                                           +-> js/notifications.js (Push / Service Worker)

sw.js precaches app shell, styles, modules, assets, and question datasets for 100% offline capability.
```

---

## 2. Dynamic Difficulty Adjustment (DDA) & Rating Engine

Sharp uses a psychometric Elo/CAT (Computerized Adaptive Testing) rating engine to continuously calibrate problem complexity to the player's cognitive state:

1. **Cognitive Domains**:
   - `memory`: Delayed recall retention, paired-associate memory, sequence consolidation.
   - `math`: Speed arithmetic, order of operations, algebraic word problems, multi-variable logic.
   - `logic`: Categorical syllogisms, conditional deduction, order ranking, Knights & Knaves.
   - `comprehension`: Speed inference, necessary assumptions, author intent, paradox resolution.
   - `focus`: Visual pattern memory, retroactive interference resistance, spatial Corsi span.

2. **Rating Formula**:
   $$\text{Expected} = \frac{1}{1 + 10^{\frac{R_{\text{challenge}} - R_{\text{user}}}{400}}}$$
   $$\Delta = K \cdot (\text{Accuracy} - \text{Expected}) \cdot \text{SpeedBonus}$$
   - Baseline rating starts at `1000`.
   - Speed bonus awards up to $+30\%$ for response times substantially faster than expected latency, while gently dampening ratings on excessive latency.

3. **Difficulty Tiers**:
   - **Tier 1 (800–949)**: Foundational
   - **Tier 2 (950–1099)**: Novice
   - **Tier 3 (1100–1249)**: Intermediate
   - **Tier 4 (1250–1399)**: Proficient
   - **Tier 5 (1400–1599)**: Advanced
   - **Tier 6 (1600–1849)**: Expert
   - **Tier 7+ (1850+)**: Master / Grandmaster

---

## 3. Question Dataset & Hydration Pipeline

The question bank lives in `data/` and is unified via `data/questions-db.js`:

```text
data/domains/
├── logic-puzzles.js          (Syllogisms, ordering, truth-tellers, conditionals)
├── math-problems.js          (Word problems, inventory, relative speed, modular arithmetic)
├── comprehension-passages.js (Scientific, ecological, historical, and cognitive texts)
└── memory-clusters.js        (Themed morning study clusters + engineered distractor foils)
```

### Continuous Hydration Lifecycle:
- Every time a player answers a question, `recordQuestionAttempt(questionId, isCorrect, latencyMs)` updates the persistent metadata in `sharp:question_stats`:
  - `timesServed`: Frequency counter (anti-repetition governor).
  - `userAccuracy`: Historical correctness ratio.
  - `averageLatencyMs`: Mean response time.
  - `lastAttempted`: ISO timestamp.
- Custom question packs can be imported via JSON with automatic schema validation and ID deduplication.
- The entire hydrated dataset can be exported at any time via `downloadQuestionDatasetFile()`.

---

## 4. Offline Persistence & Backup Architecture

All data is stored client-side in `localStorage` under the `sharp:` namespace:

| Key | Purpose |
| :--- | :--- |
| `sharp:schema_version` | Active data model schema integer (`CURRENT_SCHEMA_VERSION = 1`). |
| `sharp:ratings` | Current Elo ratings across the 5 cognitive domains. |
| `sharp:streaks` | Current streak count, personal best, last workout date, and daily calendar history. |
| `sharp:delayed_memory` | Active Time-Capsule study set, commitment timestamp, scheduled recall time. |
| `sharp:session_history` | Detailed historical round logs (up to 1,000 entries). |
| `sharp:question_stats` | Question-level hydration metadata (attempts, accuracy, latency). |
| `sharp:custom_questions` | User-imported or dynamically created question packs. |
| `sharp:preferences` | Sound, haptics, theme, and notification reminder schedules. |
| `sharp:backup_meta` | Date and timestamp of the latest backup snapshot. |

### Single-File Backup Contract:
- Exported filename: `sharp-backup-YYYY-MM-DD.json`.
- Contains:
  - `appName`: `"sharp"`
  - `schemaVersion`: `1`
  - `exportedAt`: ISO 8601 string
  - `checksum`: 32-bit FNV-1a / polynomial hash for integrity validation
  - `data`: Complete dictionary of all `sharp:*` records
- Import engine verifies file type, schema version, checksum, and provides:
  - **Replace**: Complete restore of previous state.
  - **Merge**: Non-destructive union of session histories, preserving highest streaks and ratings.

---

## 5. Offline PWA & Notification Strategy

- **Service Worker (`sw.js`)**:
  - Precaches all application shell assets, CSS, ES modules, icons, and dataset files.
  - A generated, content-versioned manifest precaches the complete local application and datasets. Each worker serves one shell snapshot; updates wait for old tabs to close rather than revalidating individual modules mid-session.
  - Cache cleanup is limited to obsolete shell caches for this scope and known legacy Sharp caches. Model caches and sibling applications are preserved.
- **Web Notifications API**:
  - Morning Drop Notification (`08:30`): Alerts player that daily items are ready to study.
  - Evening Recall Notification (`19:30`): Reminds player to test retention from the morning session.
  - Streak Protection Alert: Fires if daily workout is incomplete by evening.
  - Non-intrusive in-app banner toasts serve as automatic fallbacks when system notifications are denied or on unsupported platforms.
