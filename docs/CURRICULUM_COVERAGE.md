# Curriculum coverage and review

Inventory dated 2026-10-19: **324 questions**, comprising 176 math, 107 logic and 41 comprehension items, plus **30 memory clusters**. Seeded arithmetic/pattern/forward-sequence generation is additional and not counted as authored items. Imported packs are separate and always unrated.

## Answer review

The 300-item foundation pack contains 168 math, 96 logic and 36 comprehension questions. Its 264 math/logic answers pass independently executable proof models at app module initialization and in CI. Math templates were checked algebraically for operation order, distractor uniqueness and integral answers; logic templates were checked by finite arrangement/truth/count enumeration. Reading questions were reviewed against all 12 authored fictional passages and their stated evidence, limitations and practical next steps. Distractors are deliberately simple and should be strengthened in a subsequent editorial pass.

The 24 original items were inspected during implementation. Two errors were corrected at content version 2:

- `logic_order_002`: the original premises required E before D before A while also excluding E from the only possible first slot. The revised premises consistently specify D before E before A, with B immediately before last-place C. The solver verifies D is first.
- `logic_kk_002`: the original answer selected X as a Knave and Y as a Knight, but X's biconditional would then be true. Enumerating all four assignments shows both are Knaves. The revised answer/explanation has a truth-table regression.

Those two items now also carry executable proofs (266 total proof-verified items). Historical session snapshots retain their original content/version; they are not silently rescored. The other original answers were checked against their stated premises/calculations/passages. Legacy science/history passages are reading exercises based on supplied text, not newly source-verified factual lessons.

This is an engineering answer/content review, including agent-assisted authoring and review. **No independent human educational review, psychometric calibration, clinical validation or empirically validated tier difficulty is claimed.** Tier labels are provisional. The count of 300 added records does not mean 300 conceptually independent problems: templates and concepts repeat.

## Priority foundation coverage

Counts exclude the 24 legacy items. `—` means no item at that tier.

| Domain | Skill | T1 | T2 | T3 | T4 | T5 | T6 | T7 | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Math | Quantity tracking | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 56 |
| Math | Rate and total | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 56 |
| Math | Percentage sequence | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 56 |
| Logic | Constraint ordering | 8 | 8 | 8 | 8 | — | — | — | 32 |
| Logic | Finite constraints | 8 | 8 | 8 | 8 | — | — | — | 32 |
| Logic | Modus ponens | 6 | 5 | 5 | — | — | — | — | 16 |
| Logic | Modus tollens | 5 | 6 | 5 | — | — | — | — | 16 |
| Reading | Direct inference | 3 | 3 | 3 | 3 | — | — | — | 12 |
| Reading | Scope limit | 3 | 3 | 3 | 3 | — | — | — | 12 |
| Reading | Practical implication | 3 | 3 | 3 | 3 | — | — | — | 12 |

Original coverage adds eight math items across tiers 1–5, eleven logic items across tiers 1–5, and five reading items across tiers 1–5. These span multistep inventory, fractions, relative motion, successive percentages, order of operations, work rate, modular arithmetic, equations, categorical deductions, ranking, conditionals, truth tellers, assumptions, author intent, trade-offs and counterfactual reading. Most legacy skill/tier cells have one item.

Memory contains four preserved original clusters and 26 new themed word sets. New sets have five targets and five foils. Original clusters can contain different foil counts. Rotation prefers less-exposed sets and nearby tiers, while each committed study stores the complete snapshot.

## Selection and scoring boundaries

Choose skill/category in the exercise introduction. The selector filters first, balances represented skills, ranks low exposure and nearby tier, shuffles ties/options deterministically and records the reason. It excludes duplicate IDs within the current round. If exact-tier material is exhausted, the actual nearby tier appears on screen; the committed round uses mean actual tier for its heuristic rating evidence.

The installed minimum supports the shipped exercises; it does not meet ten reviewed items in every priority skill/tier cell. Reading and upper-tier logic are the largest coverage gaps. Counts alone should not justify a mastery claim. The next editorial work is stronger distractors, broader scenarios, independent review and measured tier calibration before the proposed 1,000-item expansion.

Run `npm test` for structural, proof, uniqueness, seeded reproducibility, filtering and rotation checks. Export curriculum from Backup to inspect the exact installed normalized records. A valid imported schema is not semantic answer proof, so imported questions remain practice-only.

## Discovery v3 expansion

The installed total is now **864 questions and 42 memory sets**. Discovery v3 adds 420 math questions (140 each: fractions of quantities, unit conversion, time planning), 84 ordering questions, 36 reading questions from 12 fictional scenarios, and 12 themed memory sets. Math and ordering answers have executable independent proof checks; all new reading questions include passage evidence. These are authored templates with parameter variants, not 540 distinct scenario families. Difficulty tiers are provisional. The full inventory is checked by `test/curriculum.test.js`.
