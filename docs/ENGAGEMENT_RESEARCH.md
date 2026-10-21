# Sharp: engagement strategy and implementation

Reviewed 21 October 2026. This is a qualitative product comparison and literature-informed design review, not a market-size estimate or proof of retention lift. Public product pages describe positioning; they do not reveal causal retention data.

## Market comparison

| Product | Publicly observable offer | Likely engagement mechanism (hypothesis) | Implication for Sharp |
| --- | --- | --- | --- |
| [Elevate](https://elevateapp.com/) | Personalized training, 40+ games, free three-game daily workout, game of the week, basic/advanced progress tracking; page lists US pricing of $39.99/year or $9.99/month | A bounded daily action removes selection effort; rotating games supply novelty; progress supports a sense of competence | Keep one primary daily circuit, optional exploration, meaningful explanations and skill-level progress |
| [Lumosity](https://www.lumosity.com/en/) | Fresh daily games, adaptive difficulty, progress tracking and cognitive-skill positioning | Variety and achievable challenge can make repetition more attractive | Rotate least-exposed material and keep adaptive training; explain that ratings are practice heuristics |
| [Finch](https://finchcare.com/) | “Take care of your pet by taking care of yourself” | A companion turns an abstract self-improvement task into a warm, visible relationship | Give Pip personality and encouragement, with dismissal and no guilt about leaving |
| [Duolingo](https://www.duolingo.com/) | Familiar category benchmark for short lessons, streaks and a mascot | A consistent cue and short action may help establish routine | Use optional cues and weekly goals that survive a missed day, instead of relying on streak-loss pressure |

Elevate, Lumosity and Finch page text was retrieved during this review. Duolingo's fetched homepage exposed only its title; its row is a general product-pattern comparison, not a verified inventory of current features. Competitor prices and offers can change. No ranking, revenue, retention or market-share claim is inferred from these pages.

Sharp's strongest differentiation is local-first, offline practice with no account required, inspectable answer explanations, and privacy-conscious coaching. Competing on a larger number of animated games alone would be costly. A coherent daily experience with trustworthy content is a more practical direction.

## Literature and design decisions

1. **Retrieval practice:** Roediger & Karpicke (2006), [Test-enhanced learning](https://doi.org/10.1111/j.1467-9280.2006.01693.x). Retrieving material can support delayed retention. Make the existing time-capsule study/recall loop visible and link reminders directly to recall. This does not establish transfer to unrelated everyday skills.
2. **Distributed practice:** Cepeda et al. (2006), [Distributed practice in verbal recall tasks](https://doi.org/10.1037/0033-2909.132.3.354). Spacing benefits depend on task and retention interval. Encourage several visits across a week; do not claim that three visits is a scientifically optimal dose. The three-workout goal is a product hypothesis.
3. **Effective learning techniques:** Dunlosky et al. (2013), [Improving students’ learning with effective learning techniques](https://doi.org/10.1177/1529100612453266). Practice testing and distributed practice have stronger support than many passive study techniques. Prioritize answering, feedback and later recall over collectible rewards alone.
4. **Autonomy and competence:** Ryan & Deci (2000), [Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being](https://doi.org/10.1037/0003-066X.55.1.68). Use choice, attainable challenges and informational feedback. Pip is dismissible; reminders are opt-in; missed days do not remove earned daily evidence.
5. **Limits of brain-training claims:** Simons et al. (2016), [Do “Brain-Training” Programs Work?](https://doi.org/10.1177/1529100616661983). Evidence for improvements on trained tasks is stronger than broad transfer claims. Sharp should describe practice and observed performance, not promise higher intelligence or prevention/treatment of cognitive conditions.

These sources support learning and motivation principles, not this specific UI or a predicted retention lift. Publisher access was restricted for several DOI pages; The first four cited learning/brain-training publications were verified through Europe PMC metadata and abstracts; [retrieval evidence](validation/engagement-research-sources.json) records their identifiers. The self-determination reference is established background literature; its abstract was not retrieved in this session. No full-text systematic review was performed.

## Implemented

- Animated orbital illustration, expressive typography, skill symbols, clearer exploration cards and mobile reflow.
- A weekly constellation derived from qualifying completed workouts: distinct local calendar days only; repeat workouts and untimed practice cannot inflate it. Three qualifying days earn the current week's explorer badge. Resets weekly; no permanent collection is claimed.
- Pip, a bottom-right animated practice companion. Open/close controls, keyboard Escape, rotating context-aware curated encouragement, reduced-motion support and an optional on-device LLM integration path. Model output is rendered as text, restricted to context-specific reviewed wording and labelled by source; context excludes raw questions and answers. See the [tightened qualification contract](MODEL_QUALIFICATION.md); this path now selects reviewed encouragement rather than composing unrestricted quotes.
- **The existing `FEATURES.browserInference` release gate remains off.** No weights download on startup. When the gate is enabled after qualification, the explicit Download & enable AI action uses the existing WebLLM provider, preparation progress, a ten-second generation deadline, cancellation and curated fallback. This change does not claim a qualified model or a successful real-model coaching evaluation.
- Opt-in browser alerts, playful preview copy and an unsubscribe control. Foreground reminder checks use the saved times. Calendar export remains available for scheduled alerts with the app closed.
- Service-worker Web Push receipt and safe local click destinations, plus a subscription client. **Background scheduling is not active:** this static deployment has no push API, VAPID keys or scheduler. The UI states that plainly and disables subscription until configured. See [push operations](PUSH_OPERATIONS.md).
- 540 new template-based questions, bringing the installed bank to 864; 12 new themed memory sets, bringing the total to 42. New math skills: fractions of quantities, unit conversion and time planning. Reading covers evidence, confounding and study design in 12 original fictional scenarios. New numeric answers and ordering questions have executable proof checks. Parameter variations increase volume, not the number of independent concepts. Difficulty tiers remain provisional.

## Recommended next improvements

1. **Qualify the coach before enabling its release flag.** Add a separate coach evaluation suite covering discouragement, repeated mistakes, missing context, unsupported devices, low memory, cancellations and hallucinated scores. Use this suite to assess generated motivational text, independently of the arithmetic benchmark.
2. **Operate background push.** Add a same-origin subscription API and scheduler with timezone handling, bounded delivery frequency, quiet hours, subscription deletion and completed-workout suppression. Test iOS installed-PWA requirements. Do not advertise closed-app daily alerts until end-to-end delivery is verified.
3. **Add learning-directed review.** Introduce due-item review with exposure history, appropriate spacing and explanations. The current least-exposed selection is useful rotation, not a validated spaced-repetition algorithm.
4. **Personalize the daily goal.** Let users choose a two-minute, standard or untimed session and set weekly frequency. Keep completed practice visible even when it is excluded from ratings.
5. **Editorially deepen the bank.** Add more distinct scenario families, plausible distractors, richer inference tasks and independent human review; calibrate difficulty from consenting study participants. More parameter variants alone are not a content-quality strategy.
6. **Measure before scaling gamification.** Prioritize comprehension of the next action, session completion and voluntary return. Defer leaderboards, variable rewards and paid streak recovery; they can distract from learning and introduce pressure.

## Measurement plan

Use an opt-in study or explicit local export; this implementation adds no remote analytics. Define activation as a first completed daily circuit, D7 return as an active visit on local day seven after activation, and weekly adherence as distinct qualifying days divided by the user-selected target. Track starts-to-completion, recall return, reminder opt-out, frustration and comparable skill accuracy separately. Report cohorts, sample sizes and uncertainty; do not treat repeated sessions as independent people.

Test the constellation against the existing home experience, then test companion encouragement separately to identify effects. Predefine the observation window and minimum sample size from baseline rates. Guardrails: no increase in abandonment, notification opt-outs, accessibility issues or self-reported pressure. Check D28 persistence rather than optimizing a short novelty spike. No retention improvement is claimed before that study.
