# CFAST Aviation Cognitive Aptitude Training Battery

## Original Problem Statement
Browser-based aviation cognitive aptitude training app modelled on the Canadian Forces Aircrew Selection Test (CFAST) battery. All 20 CFAST modules implemented. Windows-95/CFAST dark-navy CBT aesthetic. Local-first browser persistence for now (LocalStorage), with a future path to published subscription access, accounts, and cloud sync. Fully configurable timing/difficulty via Admin. Browser Gamepad API with calibration. Score History with sparkline trend.

## Product Requirements
- All 20 CFAST modules with layouts/behaviour inspired by the CFAST candidate guide.
- Dark navy (#000018) backgrounds, blue (#0000B0) banners, white text — matches CFAST screenshots.
- Client-side persistence via LocalStorage: settings, history, gamepad calibration.
- Admin page: numeric config per module × 3 difficulties.
- Gamepad Calibration page: live preview, deadzone, sensitivity, axis remap, invert.
- Score History: all-modules view + per-module view with sparkline trend + attempts table.
- Dashboard: battery-level avg + per-module AVG SCORE / BEST / ATTEMPTS.
- Auditory Capacity: 3D tunnel-flying game (ball travels through tunnel, hits sparse target rings, while listening to spoken digits).

## Current Status (July 2026)

### Direction Cleanup (July 2026)
- Product direction is now explicitly **web-based and local-first during development**.
- Future subscription access should be layered around the app shell/backend later, not embedded into each training module prematurely.
- Shared module metadata lives in `frontend/src/constants/modules.js` so pages reuse one canonical list of module IDs, names, categories, and settings keys.
- Root and frontend READMEs now describe local web setup and how to try the app.

### RAF CBAT Authoritative Tweaks (iteration_8)
- Reference source: **https://rafcbat.wordpress.com/** (unofficial RAF Computer-Based Aptitude Test guide) — 16/23 test guides read.
- **Vigilance**: Added YELLOW priority stars (worth 3× points, expire in 6s) alongside white routine stars. Row + Col input auto-submits on col entry.
- **Situational Awareness**: 9×9 A-I / 1-9 grid (was 10×10). Proper study-then-hidden-then-question flow. Added 2 controller aircraft with altitude/direction/comm channel per round.
- **Table Reading (MATF)**: Real lookup grid from -17 to +17 on both axes (35×35). Part 1: cross-reference two values. Part 2: Air-Speed × Wind-Velocity × Wind-Angle drift-correction chart (4 speed sub-tables). Keyboard 1-5 shortcuts.
- **Target Recognition**: FOUR concurrent tasks on one screen — Light (3-light R/G/B pattern match), Scan (target type vs scanning panel), System (4-char code match in 19-row scrolling list), Scene (colored shapes with direction arrows matching brief). Panels cycle every 1s. Per-task ✓/✕ counters, including systemMiss.
- **Trace Test 1**: Mirrored control logic — if aircraft faces YOU and turns your right, correct input is LEFT (pilot's-perspective). Multi-aircraft mode (medium/hard) with 3 colored aircraft where candidate controls whichever is currently RED. Arrow key support + green ✓/red ✗ feedback overlay.

### Earlier this session
- Overhauled cbtCommon.js to dark navy CFAST-native shell with back-compat aliases so all 20 modules render consistently.
- Auditory Capacity: 3D tunnel-flying game (canvas) with concentric-ring mesh, red HUD crosshair, steerable white ball, sparse yellow target rings, spoken digit callouts, then digit questions.
- Airborne Numerical: named-node route map (Victor/Xray/Yankee/Zulu/Whiskey) + mission table + A-E options + Answer input.
- Gamepad Calibration page (/gamepad): live preview, deadzone, sensitivity, axis remap, invert; hook applies calibration globally.
- Score History page (/history, /history/:moduleId): sparkline trend + 4 summary tiles + attempts table.
- Dashboard: Battery AVG + per-module AVG/BEST/ATTEMPTS with color-coded scores.

### Implemented ✅ (unchanged)
- All 20 modules routed + working.
- Dark navy CFAST-native shell (`CFASTShell`, `CFASTPanel`, `CFASTOptions`, `CFASTAnswerInput`) plus back-compat aliases for older modules.
- Auditory Capacity — tunnel game with radial mesh, red crosshair reticle, white steerable ball, sparse yellow target rings, digit callouts (TTS), then digit questions.
- Gamepad calibration page + `useGamepad` hook applies deadzone/sensitivity/invert/axis remap.
- Score History page (`/history`, `/history/:moduleId`) with sparkline SVG + attempts table.
- Dashboard with Battery AVG (only counts modules with completed assessments), Total Attempts, Modules Tried, and per-card AVG / BEST / ATTEMPTS.
- Header nav: Dashboard · History · Gamepad · Admin.

### Modules
| # | ID | Name | Category |
|---|---|---|---|
| 1 | airborne-numerical | Airborne Numerical | Reasoning |
| 2 | angles-bearings-degrees | Angles, Bearings & Degrees | Spatial |
| 3 | auditory-capacity | **Auditory Capacity (3D tunnel)** | Memory |
| 4 | cognitive-updating | Cognitive Updating | Multitask |
| 5 | colours-letters-numbers | Colours, Letters & Numbers | Multitask |
| 6 | digit-recognition | Digit Recognition | Memory |
| 7 | instrument-comprehension | Instrument Comprehension | Spatial |
| 8 | mathematics-reasoning | Mathematics Reasoning | Reasoning |
| 9 | numerical-operations | Numerical Operations | Reasoning |
|10 | rapid-tracking | Rapid Tracking | Psychomotor |
|11 | sensory-motor | Sensory Motor Apparatus | Psychomotor |
|12 | situational-awareness | Situational Awareness | Multitask |
|13 | spatial-integration | Spatial Integration | Spatial |
|14 | system-logic | System Logic | Reasoning |
|15 | table-reading | Table Reading (MATF) | Reasoning |
|16 | target-recognition | Target Recognition | Multitask |
|17 | trace-test | Trace Test 1 | Spatial |
|18 | trace-test-2 | Trace Test 2 | Spatial |
|19 | vigilance | Vigilance | Attention |
|20 | visual-search | Visual Search | Attention |

## Testing
- Iteration 8 report: `test_reports/iteration_8.json` — Frontend: **100% pass** across rewritten modules, regression modules, dashboard, admin, history, and gamepad pages.
- Applied cleanup after iteration_8: web-first direction docs, shared module registry, and centralized module-history clearing.

## Backlog (P2/P3)
- CSV/PDF export of training records from Dashboard/History.
- CFAST-pixel-perfect visual refinements to the remaining modules (Table Reading, System Logic, Vigilance, Situational Awareness, Trace Test, Visual Search) to match specific PDF screenshots. Structure/behaviour is correct; further visual polish pending.
- WebGL upgrade for tunnel game (currently 2D canvas simulating 3D via projection).
- Candidate profile + printable session report.

## Architecture
```
/app/frontend/src/
├── App.js
├── components/Header.js
├── constants/modules.js  (canonical module registry)
├── hooks/useGamepad.js
├── modules/
│   ├── cbtCommon.js  (CFAST shell + back-compat aliases)
│   └── <20 CFAST module files>
├── pages/
│   ├── Dashboard.js
│   ├── AdminSettings.js
│   ├── ModuleRouter.js
│   ├── GamepadCalibration.js
│   └── ScoreHistory.js
└── utils/storage.js
```
