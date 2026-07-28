# Pilot Aptitude Project Instructions

- Build a web-based, local-first pilot aptitude training app with practice tests, category navigation, score history, admin configuration, gamepad calibration, and training analytics.
- The current product direction is a browser app. Develop locally first; design the architecture so subscription access, accounts, and cloud sync can be added later without disrupting the local training experience.
- Use the existing React frontend as the primary application. Keep the FastAPI backend dormant or minimal unless a feature explicitly needs server-side storage, auth, payments, or deployment APIs.
- Persist completed attempts, settings, and gamepad calibration in browser LocalStorage for now.
- Keep game logic deterministic where possible and centralize shared module metadata, settings keys, names, categories, and routes.
- Match the CFAST/SkyTest-style training-tool feel: dense controls, restrained colors, dark navy CBT screens, sharp borders, guide/result panels, and high-contrast technical displays.
- Avoid adding external dependencies unless they clearly improve the web training experience, validation workflow, or future subscription architecture.
