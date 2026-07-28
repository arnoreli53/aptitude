# RAF CBAT Alignment Audit

Reference: https://rafcbat.wordpress.com/

Date: 2026-07-28

## Progress Log

- 2026-07-28: Rebuilt `visual-search` around the RAF tile-number lookup task. The target tile now hides the small black number with question marks and the candidate enters/clicks the matching number from the grid.
- 2026-07-28: Rebuilt `sensory-motor` around the RAF red-dot/crosshair tracking task. Removed the non-RAF left/right light reaction mechanic.
- 2026-07-28: Rebuilt `system-logic` around the RAF SLT structure: 15 index pages, two open pages maximum, two large information panels, bottom A-E question strip, and answer field.
- 2026-07-28: Updated `visual-search` to use cropped tile images from the RAF screenshot. Tile numbers are preserved, the layout randomizes after every input, and the target tile masks its number with question marks.
- 2026-07-28: Tightened `cognitive-updating` around the RAF CUT screenshots and task rules: RAF-style warning/clock shell, textured two-display cockpit layout, screenshot-like System/Mission/Engine/Navigation panels, one active fuel tank at a time, downward airspeed decay, scheduled required-speed changes, Air/Ground sensor cadence, staged load-drop dispenser lights, and final-15-second comms entry plus zero-time response button.
- 2026-07-28: Fixed `airborne-numerical` speed/parcel-weight values to match the RAF ANT graph: 100-700 kg maps to 1-7 miles per minute. Question generation now covers reference-style arrival time, latest departure time, journey duration, route legs, and occasional 50% bad-weather segments.
- 2026-07-28: Implemented first-pass local versions of the missing RAF guide modules: `figures-logistics-groups`, `directions-distances`, `dynamic-projection`, `verbal-logic`, and `visualisation-tests`. These are functional practice modules and are wired into settings, routing, dashboard registry, and result history.
- 2026-07-28: Rebuilt `angles-bearings-degrees` around the RAF ABD screenshots: full navy screen, black drawing panel, top example/title strip, right-side numbered 1-5 answer list, angle and bearing displays, keyboard 1-5 answer support, and closer distractors as questions progress.
- 2026-07-28: Rebuilt `instrument-comprehension` around the RAF INSC screenshots. Part 1 now shows attitude and compass instruments with five generated aircraft-image answers. Part 2 now shows the six-instrument panel and five numbered statements. Instruments and aircraft images are generated as SVG for new question states.
- 2026-07-28: Rebuilt `verbal-logic` away from the SLT-like generic shell and toward the RAF VLT screenshot: two stacked coloured information pages, grey right-side index, black question/options area, bottom answer strip, A-E keyboard support, and two-open-page behavior.
- 2026-07-28: Rebuilt `dynamic-projection` away from the generic question shell and toward the RAF DPT screenshot: left legend/instruction panel, top title bar, full projection display with range rings and bearing labels, aircraft/gates/danger areas, and bottom CA-A control strip. Red/green explanatory annotations from the guide image are intentionally omitted.
- 2026-07-28: Rebuilt `figures-logistics-groups` away from the generic three-card layout and toward the RAF FLAG screenshot: grey header with time/progress bars, dark field, coloured shapes, circled aircraft/callsign tag, central blue instruction/task panel, right-side black keypad with numeric, colour, and YES/NO controls, and grey footer button.
- 2026-07-28: Rebuilt `visualisation-tests` away from the generic dark quiz shell and toward both RAF reference images: grey/white rotated-shapes screen with top title/help bar and A-E 3D dotted options, plus compact labelled-side assembly screen with flat grey shapes and A-E answer arrangements.
- 2026-07-28: Completely overhauled `target-recognition` around the RAF TRT screenshot: top-row Information/Light/Scan/System panels, tall 19-row-style System Panel, large murky Scene Panel, bottom Scene/Light/Scan/System target boxes, textured grey strips, red/green headers, light matching, scanline target matching, code clicking, and scene target clicking.
- 2026-07-28: Updated `visualisation-tests` to use local copies of the RAF guide images for both rotated-shapes and labelled-side assembly options, with A-E click zones overlaid on the exact screenshots instead of generated placeholder drawings.
- 2026-07-28: Improved `instrument-comprehension` readability with larger high-contrast instruments, standard N/E/S/W compass labels, clearer needles/attitude references, larger aircraft answer figures, and corrected vertical-speed needle direction.
- 2026-07-28: Added end-of-module answer summaries across the app. Discrete question modules now show each prompt with given/correct answers and correctness; continuous modules show hit/miss channel summaries.
- 2026-07-28: Tightened `cognitive-updating` mechanics against the CUT guide: airspeed controls now move by 1 kt, load-drop lights progress automatically without an ARM step, Message starts blank and reveals one prompt at a time, mission prompts clear/reset after completed release, mission times use game-clock times, and keyboard digit entry works for selected mission/comms fields.
- 2026-07-28: Tightened `target-recognition` layout to the 1000x800 TRT screenshot coordinate system, scaled it to fit the viewport, added local TRT reference assets, used the TRT7 scene screenshot as the Scene Panel backplate, and slowed Light/Scan cycling by difficulty.
- 2026-07-28: Rebuilt `trace-test` live screen toward the TRAC1 guide screenshot: RAF-blue 790x630 frame, centered video window, right-side Left/Right/Push/Pull legend, bottom black status strip, reference backplate imagery, sky video background, and dynamic red/blue/yellow aircraft controlled by arrow-key pilot inputs.
- 2026-07-28: Rebuilt `auditory-capacity` into a slower ACT-style tunnel game: white ball steering in a textured tunnel, coloured circle/square/triangle targets, progressive avoid-shape instructions, beep-trigger responses through joystick/space, ball-number keyboard changes, spoken digit memory, background noise on harder modes, call-sign filtering, joystick/gamepad axes, and reference ACT screenshot overlay.

## Summary

The app is not currently a 100% RAF CBAT TMI match. It has 20 local modules, while the RAF CBAT guide index lists 23 test guides. Several local modules are good practice approximations, but only a small subset is close to the reference screenshots.

The biggest work needed is not small polish. Some modules need to be rebuilt around the RAF screenshot layouts and task rules.

## Missing Or Mis-Scoped Modules

- `figures-logistics-groups`: Implemented first pass. Needs screenshot-exact UI and more realistic moving aircraft/timing pressure.
- `directions-distances`: Implemented first pass. Needs exact reference screenshot layout and larger wording bank.
- `dynamic-projection`: Implemented first pass. Needs moving aircraft controls and deeper gate/intercept/separation simulation.
- `verbal-logic`: Implemented first pass. Needs longer RAF-style tab sets, more topics, and exact two-open-tab presentation.
- `visualisation-tests`: Implemented first pass. Needs reference-image-level 3D/assembly assets and richer option variants.
- `mathematics-reasoning`: Local extra. It is useful practice, but it is not one of the RAF CBAT TMI guide modules as listed.
- `colours-letters-numbers`: Local CLAN approximation. RAF says CLAN has been replaced by FLAG, so this should either be marked legacy or replaced by FLAG as the primary module.

## Module-by-Module Status

| Local Module | RAF Reference | Status | Fix Needed |
|---|---|---:|---|
| Airborne Numerical | ANT | Improved / close | Speed/parcel-weight graph now matches the RAF reference values and questions cover arrival time, latest departure time, journey duration, and bad-weather slowdowns. Remaining polish: exact screenshot panel proportions and any additional real-test fuel/speed variants not shown in the guide example. |
| Angles, Bearings & Degrees | ABD | Improved / close | RAF-style blue screen, black angle/bearing display, numbered answer column, and progressively closer distractors are implemented. Remaining polish: exact pixel placement against both reference screenshots and more real-test angle/bearing examples. |
| Auditory Capacity | ACT | Major mismatch | Current tunnel/digit task is only a subset. RAF ACT includes coloured shapes with conditional audio instructions, beep/trigger reaction, ball-number changes, 4-6 digit recall during flight, background noise, and call-sign filtering. |
| Cognitive Updating | CUT | Improved / needs pixel polish | Core CUT structure and rules now better match the RAF guide: two visible displays, warning panel/clock, RAF-style System/Mission/Engine/Navigation screens, one active fuel tank, downward speed decay, Air/Ground sensor cadence, staged load dispenser, and comms timing. Remaining polish: exact screenshot textures/assets, precise panel coordinates at every viewport, and richer message/event variety. |
| Colours Letters Numbers | CLAN legacy | Major mismatch | Current module randomly swaps between simplified string/color/math tasks. RAF CLAN is simultaneous: Guitar-Hero-like coloured dots, 4-6 letter memory with four corner answers, and rapid arithmetic. Also mark as legacy because RAF says FLAG replaced it. |
| Digit Recognition | Digit Recognition | Partial | The guide says questions always ask how many of a specific digit appeared. Current module also asks first/last/position questions, which should be removed for RAF fidelity. Sequence should progress from about 5 to about 15 digits. |
| Directions and Distances | DAD | First pass | Text-based directional route questions are implemented. Needs exact screenshot layout and more complex wording variations. |
| Dynamic Projection | DPT | Improved / visual shell | RAF-style left legend, projection display, range rings, bearings, aircraft/gates/danger areas, and bottom CA-A control strip are implemented without the guide's red/green annotations. Remaining work: real moving multi-aircraft controls, ordered gate progression, hostile intercept behavior, and deeper altitude/separation scoring. |
| Figures, Logistics and Groups | FLAG | Improved / visual shell | RAF-style dark field, grey header, time/progress bars, coloured shapes, circled aircraft/callsign tag, blue instruction/task panel, right-side keypad, colour buttons, YES/NO controls, and footer button are implemented. Remaining work: exact moving-aircraft timing, beep/audio events, break/pace progression, and richer memory/question scheduling. |
| Instrument Comprehension | INSC | Improved / readable | Both RAF parts are implemented: Part 1 attitude/compass to aircraft-image matching and Part 2 six-instrument statement selection. Instruments and aircraft answer figures have been enlarged and redrawn for readability with consistent high-contrast styling. Remaining polish: exact screenshot aircraft art and more nuanced instrument distractors. |
| Mathematics Reasoning | No RAF guide match | Out of scope | Keep as supplemental practice only, or remove from RAF-aligned battery. |
| Numerical Operations | Numerical Operations | Partial | Task content is close, but RAF says no backspace/correction once a number is entered. Current input allows normal editing. UI should match the blue prompt screen in the screenshot. |
| Rapid Tracking | RTT | Major mismatch | Current module is a top-down/2D object tracker. RAF RTT is first-person aircraft video perspective, joystick camera movement, trigger snapshots, three pictures per target, targets behind obstructions, and changing target types. |
| Sensory Motor Apparatus | SMA | Improved / still needs UI polish | Core task now matches RAF: red-dot alignment to central crosshairs using joystick/keyboard/mouse control. Still needs closer physical apparatus styling and possible pedal-axis calibration support. |
| Situational Awareness | Situational Awareness | Partial / close behavior | Correct 9x9 memory flow and controller aircraft details are present. Still needs screenshot-faithful green radar/grid frame, information timing, and more exact unit/controller presentation. |
| Spatial Integration | SIT | Major mismatch | Current 5x5 object-memory grid is much simpler. RAF SIT requires study materials including 2D object map, flight path, speed/altitude chart, then a 3D landscape accuracy question. |
| System Logic | SLT | Improved / still needs content polish | Core structure now matches RAF: 15 information tabs, two open at once, large information panels, bottom MCQ strip, and A-E answer field. Still needs exact screenshot content/image fidelity and a larger bank of topic variations. |
| Table Reading | MATF | Partial / close behavior | Has -17..+17 grid and Part 2 chart concept, but generated values/chart are not exact to the reference images. Needs exact visual layout: physical-sheet style grid, on-screen question panel, keyboard 1-5 answers. |
| Target Recognition | TRT | Improved / major visual overhaul | RAF-style multi-panel layout, information box, light panel/target, scan panel/target, tall system code panel, system target, murky scene panel, and scene target box are implemented. Remaining polish: exact reference imagery, real scanline animation fidelity, denser scene symbol semantics, and full real-test timing/target refresh behavior. |
| Trace Test 1 | TRAC1 | Partial / close behavior | Mirrored pilot-perspective controls are present. Needs animated video-like aircraft sequence and reference-style blue screen; multi-aircraft color switching should be time-based/random, not only per-question static. |
| Trace Test 2 | TRAC2 | Partial | Has colored aircraft trajectories and recall questions, but RAF includes up to 5 aircraft, entries/exits/order questions, most turns, vertical climb/no-climb questions, and screenshot-style video display. |
| Verbal Logic | VLT | Improved / close | Uses RAF-style two stacked information pages, grey index, black question/options area, bottom answer strip, and two-open-page behavior. Needs larger banks, longer topics, multi-part timing/familiarisation period, and exact screenshot content breadth. |
| Vigilance | Vigilance | Partial / close behavior | Correct 9x9 grid, row then column input, routine/priority stars. Needs exact screenshot UI: grid proportions, right-side coordinate entry boxes, footer/status text, and clutter progression matching the guide image. |
| Visual Search | Visual Search | Close / image-based | Uses cropped RAF screenshot tile images with preserved numbers. The grid randomizes after every input and the target masks its number with question marks. Remaining polish: exact full-screen spacing and additional real-test tile variants if more reference screens become available. |
| Visualisation Tests | Visualisation | Improved / image-based | Both RAF-described task types now use local copies of the RAF guide option images with A-E hit zones: rotated 3D dotted shapes and labelled-side shape assembly. Remaining work: larger external/generated item bank beyond the two guide examples. |

## Priority Fix Order

1. Replace or add missing RAF modules: FLAG, DAD, DPT, VLT, Visualisation.
2. Rebuild the major mismatches: Visual Search, Sensory Motor, Rapid Tracking, Spatial Integration, System Logic, Auditory Capacity.
3. Correct rule mismatches in easier modules: Digit Recognition, Numerical Operations, Instrument Comprehension.
4. Pixel-polish the close modules: ANT, MATF, TRT, TRAC1, Vigilance, Situational Awareness, ABD.
5. Decide whether supplemental non-RAF modules should be hidden behind a separate “Supplemental Practice” category.

## Reference Screenshots

For local visual comparison, reference images were downloaded to:

```text
/tmp/rafcbat_images
```

The contact sheet is:

```text
/tmp/rafcbat_images/contact_sheet.jpg
```
