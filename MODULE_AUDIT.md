# RAF CBAT Module Fidelity Audit

Date: 2026-07-28

## Scope

This audit compares all 25 routed modules in the local web app against the
[RAF CBAT TMI test guide index](https://rafcbat.wordpress.com/home/), its module
pages, and the screenshots on those pages.

The review included:

- Source inspection of module logic, settings, timing, input, and scoring.
- A startup smoke test of every route in Practice / Easy mode.
- Screenshot review at 1440 x 1000 against the available guide images.
- Focused checks of question generation and task state transitions.

The 25 routes consist of 24 modules represented by the guide plus Mathematics
Reasoning, which has no matching guide page. The guide treats FLAG and CLAN as
alternatives because FLAG replaced CLAN in Q2 2021.

## Important Limitation

The reference site describes itself as an unofficial guide. Several pages also
say that details may vary or that the author cannot remember exact controls or
tables. It is therefore not possible to certify "100% identical to the real
test" from this site alone.

The app can be made faithful to the published screenshots and written
descriptions. Exact timings, question banks, audio, scoring weights, and some
control rules need an authoritative source before they should be presented as
exact replicas.

## Priority Definitions

- **P0 - Rebuild or correctness blocker:** The module trains a materially
  different task, omits a core workload, or uses invalid reference data.
- **P1 - Major mismatch:** The intended task exists, but important timing,
  content, input, progression, or presentation differs.
- **P2 - Close:** The core task is represented and needs validation, visual
  locking, or smaller fidelity changes.
- **Supplemental:** No reference module exists for comparison.

## Executive Findings

- **P0:** ACT, CUT, CLAN, Digit Recognition, FLAG, Numerical Operations, SLT,
  TRAC1, TRAC2, VLT, and Visualisation.
- **P1:** ANT, DAD, INSC, MATF, SMA, SIT, TRT, Vigilance, and Visual Search.
- **P2:** ABD, DPT, RTT, and Situational Awareness.
- **Supplemental:** Mathematics Reasoning.
- All 25 routes started without a page or console error in the smoke pass.
- Score normalization and CBAT role calculations now have first-party unit
  coverage. Module generators, timed task logic, and visual fidelity still lack
  automated regression coverage.

## P0 Findings

### Auditory Capacity Test (ACT)

Reference: [ACT guide](https://rafcbat.wordpress.com/auditory-capacity-test-act/)

Current strengths: Three.js tunnel, moving ball, camera follow, joystick,
keyboard and mouse control, hidden cursor, Esc pause, shape gates, beep trigger,
ball-number input, background noise, and callsign-filtered instructions.

Confirmed differences:

- The guide describes successive rounds that introduce one additional task at
  a time. The app mixes task types by elapsed percentage in one four-minute run.
- A 4-6 digit number should be recalled with the keyboard later in the same
  round while the candidate continues flying. The app plays individual digits
  over time, stops flying, then asks three multiple-choice questions.
- The guide allows 1-3 assigned callsigns. The app assigns at most two.
- Keeping the ball away from the tunnel edge is the base tracking task. The app
  clamps the ball inside the tunnel and does not score wall proximity.
- A "next shape" instruction expires after a fixed time rather than remaining
  tied to the next matching shape.
- The wireframe rings, live task counters, and visible rule text do not match
  the guide screenshot's tunnel presentation.

Required change: Rebuild ACT around explicit rounds, continuous wall-error
scoring, in-flight digit recall, persistent shape instructions, 1-3 callsigns,
and a visually grounded tunnel scene.

### Cognitive Updating Test (CUT)

Reference: [CUT guide](https://rafcbat.wordpress.com/cognitive-updating-test-cut/)

Current strengths: Two of six displays, warning panel and clock, fuel balancing,
airspeed control, hydraulic pressure, communications code, staged mission
messages, dispenser lights, keyboard number input, and task reset behavior.

Confirmed differences:

- Air Sensor tasks are created at 120-second intervals and Ground Sensor tasks
  at 240-second intervals. Easy lasts 240 seconds, Medium 180, and Hard 120, so
  Ground Sensor never occurs and Medium/Hard do not receive the expected
  recurring sensor workload.
- The configured `sensorEvents` and `cameraEvents` values are not used.
- The guide places Alpha/Bravo camera selection on the Sensor display. The app
  places a Video Recording Interface inside Mission.
- The Mission display exposes each camera target time and status. The guide
  expects that instruction to arrive through Message and be remembered.
- Message is not truly blank at startup because it always displays the sensor
  schedule footer.

Required change: Generate all timed tasks relative to duration and difficulty,
move camera controls into Sensor, remove schedule/status coaching from the
assessment display, and make Message a true chronological warning board.

### Colours, Letters and Numbers (CLAN)

Reference: [CLAN guide](https://rafcbat.wordpress.com/clan/)

The guide says CLAN was replaced by FLAG in Q2 2021. If it remains available as
a legacy practice module, the current version is not representative:

- The guide runs color tracking, delayed letter recall, and arithmetic as
  concurrent tasks. The app presents one randomly selected task at a time.
- Colored dots should travel left to right into red, yellow, and green zones.
  The app uses a static four-corner color match with six possible colors.
- Letters should appear for about five seconds, disappear, and be selected
  after a delay. The app shows the target and all choices simultaneously.
- Arithmetic should be rapid fire and includes all four operations.

Required change: Either remove CLAN from the active battery and label it legacy,
or rebuild all three concurrent task streams.

### Digit Recognition

Reference:
[Digit Recognition guide](https://rafcbat.wordpress.com/digit-recognition-test/)

Confirmed differences:

- The guide asks only how many times a specified digit occurred. The app also
  asks first digit, last digit, and positional questions.
- Strings should grow progressively from roughly 5 to roughly 15 digits. The
  app uses one fixed length per difficulty, with a maximum of 9.
- The guide shows the string for about five seconds. The app uses 2-3 seconds.
- The generic dark question shell does not match the full blue reference view.

Required change: Use count-only questions, progressive 5-15 digit sequences,
reference display timing, and the matching test screen.

### Figures, Logistics and Groups (FLAG)

Reference:
[FLAG guide](https://rafcbat.wordpress.com/figures-logistics-and-groups-flag/)

The screen resembles the reference image, but its state model does not perform
the described test:

- Aircraft and zones are static. Selecting a zone teleports a target instead of
  continuously monitoring aircraft entering moving zones.
- There are no entry/exit beeps.
- All aircraft are circled, so there are no uncircled distractors to ignore.
- Callsign truth is randomized independently of whether the aircraft is
  actually on screen. A displayed YES/NO question can therefore be factually
  inconsistent with the scene.
- Arithmetic and callsign questions remain visible rather than appearing on
  their stated cadence and expiring after about four seconds.
- The guide describes about ten minutes, a ten-second midpoint break, and
  increasing pace. Current modes run for 3-5 minutes without that progression.
- The result detail refers to missing `problem.a`, `problem.op`, and
  `problem.b` fields.

Required change: Replace the current static prompt generator with a continuous
aircraft lifecycle, moving-zone collision detection, entry/exit event log,
truth-derived callsign questions, expiring arithmetic prompts, sound, midpoint
break, and progressive pace.

### Numerical Operations

Reference:
[Numerical Operations guide](https://rafcbat.wordpress.com/numerical-operations-test/)

Confirmed differences:

- The guide describes rapid single-operation addition, subtraction,
  multiplication, and division. Easy omits division and Hard introduces
  two-operation expressions.
- The current prompt is nearly unreadable because dark text is rendered on a
  dark background.
- The layout and numeric input differ substantially from the blue reference
  screen.

Required change: Fix contrast immediately, use all four simple single
operations at every level, and match the reference input layout. Difficulty
should change number ranges and pace, not the task type.

### System Logic Test (SLT)

Reference: [SLT guide](https://rafcbat.wordpress.com/system-logic-test-slt/)

Current strengths: 15 tabs, a two-panel limit, appropriate information-card
styling, and questions requiring inference or arithmetic.

Confirmed differences:

- Every question automatically opens the exact two tabs needed to answer it.
  This removes the core information-search and tab-selection workload.
- The guide describes roughly 30 questions in 20-25 minutes. The app has a
  ten-question bank and runs 6-10 minutes.
- The guide permits skipping and returning to questions. The app has no
  question navigation.
- `maxTabOpens` is configured but not enforced or used meaningfully.

Required change: Stop auto-opening answer tabs, add skip/return navigation,
expand the coherent system and question bank, and provide a reference-duration
mode.

### Trace Test 1 (TRAC1)

Reference: [TRAC1 guide](https://rafcbat.wordpress.com/trace-test-1-trac1/)

Confirmed differences:

- The guide is a continuous animated aircraft-control task. The app displays a
  static pose and accepts one immediate directional classification per item.
- Later aircraft should change colors during the moving sequence. App colors
  are fixed for each question and only change between questions.
- The current state set does not reproduce continuous inversion, approach,
  retreat, and orientation transitions.

Required change: Rebuild as a continuous animation/input stream with time-based
maneuvers and in-motion color swaps.

### Trace Test 2 (TRAC2)

Reference: [TRAC2 guide](https://rafcbat.wordpress.com/trace-test-2-trac2/)

Confirmed differences:

- The guide uses up to five aircraft. The app tops out at four.
- Aircraft need a richer event history including screen entry/exit, turn count,
  climbs, and unchanged vertical direction. App maneuvers are only straight,
  left, or right.
- Questions are limited to which aircraft went straight, left, or right. Entry
  order, exit order, most turns, and vertical-motion questions are absent.
- The synthetic top-down triangles do not reproduce the aircraft perspective
  in the reference.

Required change: Build a scenario event log first, then derive all questions
from real recorded events so every answer is guaranteed valid.

### Verbal Logic Test (VLT)

Reference: [VLT guide](https://rafcbat.wordpress.com/verbal-logic-test-vlt/)

Current strengths: The two-open-page interface is visually close and questions
can require combining page facts.

Confirmed differences:

- The guide describes a familiarization period and three parts progressing from
  6 to 13 tabs. The app has two topics containing only 3 or 4 pages.
- The topic alternates every question instead of remaining one coherent
  information set for a part.
- There are only three questions per topic, so configured tests recycle content.
- Initial pages are pre-opened and can expose the useful pair immediately.
- Skip/return navigation is missing.

Required change: Model familiarization plus three coherent parts, expand each
part's page and question bank, start from neutral pages, and add question
navigation.

### Visualisation Tests

Reference:
[Visualisation guide](https://rafcbat.wordpress.com/visualisation-tests/)

The app displays the two guide example images clearly, but it is a repeated
demo rather than a usable test:

- Every rotated-shape item reuses one image with answer C.
- Every assembly item reuses one image with answer B.
- After the first two items, all answers can be memorized.
- The page embeds a complete reference screenshot, including its own header,
  inside another app header.

Required change: Build or source a validated bank of unique mental-rotation and
shape-assembly items with stored answer keys, while retaining the reference
screen style.

## P1 Findings

### Airborne Numerical Test (ANT)

Reference:
[ANT guide](https://rafcbat.wordpress.com/airbourne-numberical-test-ant/)

The current tabs, Mission/Task objective, speed/fuel table, parcel-weight graph,
map, weather restriction, randomized values, and partial-credit summary are
substantially aligned.

Remaining differences:

- The guide states about one minute per question. Current modes allow about
  37.5, 20, and 11.25 seconds per question and use one global timer.
- Exact partial-credit percentages are a local training rule, not specified by
  the guide.
- Generated speed/fuel rows and question distributions need a fixed reference
  contract before they can be called exact.

Required change: Add a one-minute-per-question reference mode and lock the
allowed question templates and table relationships.

### Directions and Distances (DAD)

Reference: [DAD guide](https://rafcbat.wordpress.com/dad/)

Confirmed differences:

- The app generates one ship path from a harbor and only asks relative-to-start
  questions.
- The guide includes relational statements between several named locations and
  longer turn chains.
- Rounded Euclidean answers and `+/-100` distractors produce artificial values
  unlike the reference examples.
- The generic two-panel multiple-choice layout differs from the reference.

Required change: Add named-location relational graphs, arbitrary origin/target
pairs, realistic exact distance sets, and the matching layout.

### Instrument Comprehension (INSC)

Reference:
[INSC guide](https://rafcbat.wordpress.com/instrument-comprehension-test-insc/)

The app now has readable six-instrument displays, both test parts, and five
aircraft/compass options.

Remaining differences:

- Part 2's turn-indicator ball is always centered. The guide distinguishes
  standard and non-standard turns using left, center, and right ball positions.
- Generated states are limited to cardinal headings and a small discrete motion
  set, so the question bank is narrower than the reference implies.
- Needle colors, markings, line weights, and aircraft silhouettes still differ
  from the screenshots.

Required change: Add turn-rate/slip state, broaden and validate the state matrix,
then lock the instrument and option artwork.

### Table Reading Test (MATF)

Reference: [MATF guide](https://rafcbat.wordpress.com/table-reading-test-matf/)

Part One now uses the guide-derived symmetric `-10` to `+10` lookup table,
including `(+5, -10) = -5`. The blue question surface follows the reference
screen, answer choices are selected with `1-5` and submitted with Enter, and the
reference table is displayed separately below the question.

Remaining difference: Part Two still uses a local drift approximation. The
guide itself says its example chart is only approximate, so exact Part Two data
cannot be certified from that source.

Required change: Obtain an authoritative Part Two table before labeling those
values exact. The current chart should remain identified as a training
approximation.

### Sensory Motor Apparatus (SMA)

Reference:
[SMA guide](https://rafcbat.wordpress.com/sensory-motor-apparatus-test-sma/)

The split axes, joystick support, pedal calibration, and joystick-twist
substitution represent the intended task.

Remaining difference: Mouse control corrects both axes with one hand, bypassing
the guide's joystick-versus-pedal coordination workload. Live alignment/error
feedback also coaches the candidate during the task.

Required change: Keep mouse as an explicitly labeled accessibility/practice
fallback. Reference assessment should require separate vertical and lateral
inputs and hide live performance coaching.

### Spatial Integration Test (SIT)

Reference:
[SIT guide](https://rafcbat.wordpress.com/spatial-integration-test-sit/)

The object map, speed/altitude chart, 3D recall scene, unchanged hills, flight
path spacing, object questions, and distractor variations are mechanically
strong.

Remaining difference: Study periods are 14-24 seconds, while the guide describes
studying the information for a few minutes. Total test durations are similarly
compressed.

Required change: Add reference-duration study/recall rounds and visually tune
the landscape and object assets against the screenshots.

### Target Recognition Test (TRT)

Reference:
[TRT guide](https://rafcbat.wordpress.com/target-recognition-test-trt/)

The app includes all four simultaneous tasks, a 19-row continuously scrolling
system table, clickable codes, lights, scan targets, scene symbols, and an
always-available Unknown objective.

Remaining differences:

- Scene background and icon art are generated approximations rather than the
  reference assets.
- The schedule that adds scene objectives at fixed fractions of a four-minute
  run is locally inferred.
- A new system target is selected from currently visible codes. This avoids
  waiting but is not specified by the guide.
- Light, scan, scene, and scroll timing tables are local approximations.

Required change: Preserve the functioning continuous table, but lock visual
assets and timing only after an accepted reference schedule is documented.

### Vigilance

Reference:
[Vigilance guide](https://rafcbat.wordpress.com/vigilance-test/)

The 9 x 9 table and automatic Row -> Enter -> Column -> Enter -> Row input flow
are correct in concept.

Remaining differences:

- The current black grid, warning shell, score, and tip panel differ
  substantially from the large white-on-blue reference display.
- Clutter increases mainly because old marks remain; the spawn cadence itself
  does not progressively increase.
- Priority marks expire after six seconds and score a fixed multiplier. The
  guide says faster responses score more, but does not specify either rule.
- Configured `asteriskChance` values are not reflected in the task generator.

Required change: Match the reference layout, make pace progression explicit,
and use response latency for scoring unless better scoring documentation is
available.

### Visual Search

Reference:
[Visual Search guide](https://rafcbat.wordpress.com/visual-search-test/)

The app uses exact crops from the guide's letter example, preserves tile
numbers, and reshuffles positions after each response as previously requested.

Remaining differences:

- The guide also describes unique-symbol tile sets; the app contains only the
  letter example.
- Configured `distractorCount` does not change the fixed 12-tile board.
- Clicking the target tile directly submits its number, bypassing the
  number-entry workload described by the guide.

Required change: Decide whether the known real test uses only the provided
letter set. In reference assessment, require number entry and either implement
validated symbol sets or explicitly scope the module to the letter variant.

## P2 Findings

### Angles, Bearings and Degrees (ABD)

Reference:
[ABD guide](https://rafcbat.wordpress.com/angles-bearings-degrees-test-abd/)

The current module closely follows both reference examples: angle questions
precede bearings, the ring and aircraft rotate, and options become closer.

Remaining change: Remove or hide training-only chrome in reference mode and
lock dimensions, typography, and spacing with screenshot tests.

### Dynamic Projection Test (DPT)

Reference:
[DPT guide](https://rafcbat.wordpress.com/dynamic-projection-test-dpt/)

The current display is visually close and implements phased aircraft, ordered
gates, hazards, separation, relative turns/altitudes, and interception.

Remaining uncertainty: The guide does not document exact controls, collision
radii, gate tolerances, speed, or scoring. Current lateral interception and
capture thresholds are inferred.

Required change: Avoid claiming exact mechanics until those thresholds are
verified. Otherwise this needs validation and visual regression coverage, not a
wholesale rewrite.

### Rapid Tracking Test (RTT)

Reference:
[RTT guide](https://rafcbat.wordpress.com/rapid-tracking-test-rtt/)

The app has a real Three.js moving viewpoint, joystick and pointer steering,
moving targets, occlusion checks, three-photo capture, reacquisition, and target
classes broadly matching the guide.

Remaining difference: The synthetic low-poly world is not the recorded
first-person landscape shown by the guide, and the exact target pace and
visibility rules are inferred.

Required change: Keep the mechanics, validate target timing and photo scoring,
and decide whether synthetic 3D is an accepted training substitute for video.

### Situational Awareness

Reference:
[Situational Awareness guide](https://rafcbat.wordpress.com/situational-awareness-test/)

The app provides progressive map, text, and spoken updates for two controllers,
removes the information before recall, and asks about required unit attributes.

Reference conflict: The prose calls the grid 9 x 9, while the screenshot shows
A-J and 0-9, which is 10 x 10. The app follows the screenshot with 10 x 10.

Remaining change: Browser speech synthesis varies by operating system and voice,
so timing and pronunciation are not deterministic. Use fixed audio assets if
audio fidelity matters, then lock round timing and question coverage.

## Supplemental Module

### Mathematics Reasoning

There is no Mathematics Reasoning entry in the guide index. It may still be
useful practice, but it should be labeled **Supplemental / not a referenced CBAT
module** so users do not mistake it for part of the replicated battery.

## Cross-Cutting Changes

### 1. Add a Reference Mode

Difficulty settings currently alter timings, question counts, or task types in
ways that often conflict with the guide. Keep configurable Practice mode, but
add a locked Reference mode containing:

- Documented duration and progression.
- Exact allowed controls.
- No live score, hints, required-tab auto-opening, or correctness coaching.
- Fixed screen composition and reference assets.
- A versioned question/data contract.

Post-test answer summaries can remain as a training feature because they do not
change the in-test workload.

### 2. Make Modules Full-Screen

`frontend/src/App.js` renders the application Header above every module. Most
reference screens are full-screen test surfaces, and the extra header causes
many 1440 x 1000 module pages to become 1034 pixels tall and scroll.

Hide global navigation during an active reference test. Provide pause/exit only
where the reference or training mode requires it.

### 3. Separate Facts From Presentation

Several polished screens are backed by approximate or invalid data, especially
FLAG, MATF Part Two, VLT, Visualisation, CUT timing, and TRACE. Store each
module's reference data and event rules separately from rendering so
correctness can be tested without a browser.

### 4. Add Automated Coverage

Scoring calculations now have a focused unit suite. Remaining minimum coverage
should include:

- Deterministic generator tests proving every question contains one valid
  answer and the stored answer follows the displayed facts.
- State-machine tests for timed events, expiry, resets, progression, and
  pause/resume.
- Fake-clock tests for CUT, FLAG, ACT, TRT, Vigilance, and both TRACE modules.
- Gamepad-axis tests for ACT, RTT, SMA, and calibration.
- Playwright reference screenshots at the target desktop resolution.
- Overflow checks and canvas-pixel checks for every full-screen 3D module.

### 5. Track Reference Confidence

Every timing, score, table, and asset should carry one of:

- `verified`: supported by an authoritative source.
- `guide-derived`: explicitly stated or visible on RAF CBAT TMI.
- `inferred`: chosen to make the trainer playable.
- `training-only`: intentionally different for learning value.

That prevents an inferred approximation from silently becoming "the exact
test."

## Recommended Implementation Order

1. Add Reference mode, full-screen module routing, seeded randomness, fake-clock
   test utilities, and visual snapshot infrastructure.
2. Fix compact correctness blockers: CUT scheduling/panel ownership, SLT tab
   auto-opening, Digit Recognition question rules, and Numerical Operations
   contrast/generator.
3. Rebuild the continuous task engines: FLAG, TRAC1, TRAC2, and ACT.
4. Rebuild the content-heavy modules: VLT and Visualisation; decide whether CLAN
   is removed, archived, or rebuilt.
5. Complete P1 fidelity work for ANT, DAD, INSC, SMA, SIT, TRT, Vigilance, and
   Visual Search.
6. Finish screenshot and timing acceptance for ABD, DPT, RTT, and Situational
   Awareness.

## Code Evidence Pointers

- Global header and routes: `frontend/src/App.js:11`,
  `frontend/src/pages/ModuleRouter.js:32`
- Global no-backspace behavior: `frontend/src/pages/ModuleRouter.js:65`
- Difficulty and timing values: `frontend/src/utils/storage.js:41`
- ACT task scheduler and post-flight recall:
  `frontend/src/modules/AuditoryCapacity.js:248`,
  `frontend/src/modules/AuditoryCapacity.js:560`
- CUT sensor schedule and Mission camera interface:
  `frontend/src/modules/CognitiveUpdating.js:223`,
  `frontend/src/modules/CognitiveUpdating.js:1212`
- CLAN one-task generator: `frontend/src/modules/ColoursLettersNumbers.js:17`
- Digit Recognition question types:
  `frontend/src/modules/DigitRecognition.js:10`
- FLAG static state and randomized callsign truth:
  `frontend/src/modules/MissingRafModules.js:664`
- SLT automatic tab selection: `frontend/src/modules/SystemLogic.js:299`
- MATF reference data and question screen:
  `frontend/src/modules/TableReading.js:10`
- TRAC1 static scene model: `frontend/src/modules/TraceTest.js:12`
- TRAC2 limited event model: `frontend/src/modules/TraceTest2.js:16`
- VLT topic bank: `frontend/src/modules/MissingRafModules.js:196`
- Repeated Visualisation answers:
  `frontend/src/modules/MissingRafModules.js:416`
