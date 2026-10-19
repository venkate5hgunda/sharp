# Sharp Design Language & Interface Tokens

## 1. Design Philosophy

**Cognitive clarity, visual precision.** Sharp's interface is designed to evoke mental acuity and focus. Fast animations, rich dark/light modes, crisp typography, and immediate tactile feedback keep the brain in a productive flow state.

---

## 2. Shared Design Tokens

Tokens are defined in `css/styles.css` on `:root` and adapted under `[data-theme='dark']`:

### Light Mode Palette:
- `--bg`: `#f4f6fb` (Porcelain mist canvas)
- `--surface`: `#ffffff` (Elevated card surface)
- `--surface-strong`: `#f8faff` (Contrast inset)
- `--text`: `#0f172a` (Deep slate navy)
- `--muted`: `#64748b` (Secondary metadata text)
- `--border`: `#e2e8f0` (Subtle boundary line)
- `--primary`: `#4f46e5` (Electric indigo)
- `--accent-cyan`: `#06b6d4` (Focus & working memory)
- `--accent-emerald`: `#10b981` (Correct answer & streak success)
- `--accent-amber`: `#f59e0b` (Streak flame & timing alerts)
- `--accent-rose`: `#f43f5e` (Incorrect answer / danger action)

### Dark Mode Palette:
- `--bg`: `#090d16` (Deep space navy)
- `--surface`: `#111827` (Midnight slate)
- `--surface-strong`: `#1a2234` (Inset surface)
- `--text`: `#f8fafc` (Ice white)
- `--muted`: `#94a3b8` (Muted slate)
- `--border`: `#243048` (Slate border)
- `--primary`: `#6366f1` (Neon indigo glow)
- `--accent-cyan`: `#22d3ee`
- `--accent-emerald`: `#34d399`
- `--accent-amber`: `#fbbf24`
- `--accent-rose`: `#fb7185`

---

## 3. Typography & Hierarchy

- **Headings & Display**: `Outfit`, system-ui, -apple-system, sans-serif. Geometric, confident, high legibility.
- **Body & Prompts**: `Plus Jakarta Sans`, system-ui, -apple-system, sans-serif. Optimized for rapid reading comprehension.
- **Numbers & Math**: Large, tabular numerals for instant glanceability.

---

## 4. Sensory Feedback: Sound & Haptics

### Pure Web Audio Synthesis (zero external MP3 assets):
- `tap()`: High-frequency 540Hz sine blip (40ms) for buttons and cards.
- `pop()`: Descending 280Hz sine tone (50ms) for cancel and dismissals.
- `chime()`: Sparkling C-major triad (C5, E5, G5, C6) for correct answers and problem completion.
- `buzz()`: Dual low-frequency sawtooth tones (140Hz, 110Hz) for incorrect selections.
- `flash()`: Harmonic sweep (440Hz, 554Hz, 659Hz) during visual memory presentation.
- `fanfare()`: Ascending brassy arpeggio for round completion.
- `streak()`: Resonant arpeggio for maintaining daily streaks.

### Tactile Haptics (`navigator.vibrate`):
- Soft tap: 8ms micro-pulse.
- Confirmation: Dual pulse `[10, 30, 20]`.
- Caution / Misstep: Triple pulse `[25, 40, 25]`.
- Streak Celebration: Celebratory cadence `[15, 40, 20, 40, 45]`.

---

## 5. Accessibility & Inclusivity

- **Contrast**: Core text and interface pairings strictly satisfy WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text and focus states), verified via automated unit test suite (`test/contrast.test.js`).
- **Reduced Motion**: Fully respects `prefers-reduced-motion: reduce` across CSS transitions, card elevations, button transforms, confetti particle bursts, and keyframe animations.
- **Keyboard Navigation & Focus**:
  - Visible focus rings (`:focus-visible`) across all interactive controls (`button`, `a`, `input`, `select`, `summary`, `[tabindex]`) using `--primary` outlines and secondary `--primary-light` focus glows.
  - Accessible skip link (`.skip-link`) for keyboard navigation.
  - Keyboard shortcuts (`1`, `2`, `3`, `4` option selection; `Escape` modal dismissal).
- **Touch Ergonomics & Micro-Interactions**:
  - Touch targets maintain a minimum 42–44px hit area with `touch-action: manipulation` and suppressed tap highlights.
  - Tactile depression (`:active`) feedback on buttons (`scale(0.96)`), icon controls (`scale(0.94)`), filter chips, and interactive game cells (`scale(0.95)`).
