# Sharp

Sharp is a static, local-first cognitive practice app. [Open the live app](https://venkate5hgunda.github.io/sharp/).

Today offers a saved four-exercise circuit: pattern memory, arithmetic, logic and reading. Exercises also includes story math, forward spatial Corsi and delayed memory. Every answer has explicit feedback and a Next action. Sessions resume after navigation or reload; a second tab must take ownership before changing a session.

Practice mode is self-paced and excluded from ratings and streaks. Ratings are adaptive heuristics, not validated intelligence or medical assessments. The installed curriculum contains **324 questions and 30 memory sets**, plus seeded arithmetic and visual stimuli. See [coverage and answer review](docs/CURRICULUM_COVERAGE.md) for the inventory, provisional tiers and editorial limits.

Progress stays in IndexedDB. Migration archives the original `sharp:*` localStorage bytes, preserves valid legacy progress and quarantines malformed records. Backup v2 exports active sessions, study snapshots and progress with SHA-256 corruption detection. Restore supports legacy v1 files, previews conflicts and commits atomically. Keep backups outside the browser: storage can be cleared or evicted.

Offline training works after the service worker finishes installing. Updates wait for all existing Sharp tabs to close so an active session keeps one release. Reminders work while the app is open; Settings can export calendar reminders. There is no server push scheduler.

Browser inference and all remote developer sharing are **disabled**. Startup does not download model weights or the optional runtime. Local diagnostics includes synthetic evaluations, failure scenarios and JSON exports. The pinned WebLLM candidate has initial desktop execution/cancellation evidence from an isolated pilot; full qualification remains pending. [Model hosting, measured results and operations](docs/INTELLIGENCE_OPERATIONS.md) explains the controls and remaining gates.

## Development

The app uses native browser ES modules and vanilla HTML/CSS. No frontend framework or runtime build is needed to serve it.

```sh
npm ci
npm start
# http://127.0.0.1:8080
```

After changing JS, CSS, datasets, assets or the worker, regenerate the offline manifest:

```sh
npm run build:offline
npm run check:offline
npm test
```

The optional SDK bundles are checked in, excluded from shell precaching and built reproducibly from exact dependency versions:

```sh
npm run build:inference
```

CI also runs Playwright and axe in Chromium and mobile WebKit. To run that suite on a development machine with installed Playwright browsers:

```sh
npx playwright install chromium webkit
npm run test:browser
```

See [architecture](ARCHITECTURE.md), [implementation status](docs/IMPLEMENTATION_PROGRESS.md) and [release verification](docs/IMPLEMENTATION_VERIFICATION.md). Third-party bundled runtime notices remain in the generated files. Project code is MIT licensed.
