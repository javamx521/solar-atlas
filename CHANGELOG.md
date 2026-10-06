# Solar Atlas redesign

Based on repository commit `267f5d0b4dee1bef532baf0d16f194bba1c88ab1`.

## Experience

- Replaced the mission dashboard with an immersive, planet-focused explorer.
- Removed launch chronology, mission filters and mission statistics from the UI.
- Added a quiet editorial opening, responsive planet dock, body dossiers, planet search and three observation modes.
- Added arrow-key planet navigation, reset, deep links, Back/Forward support, modal focus handling and bilingual interface/data values.
- Mobile dossiers become compact bottom sheets; desktop dossiers leave the scene and header controls accessible.

## Scene

- Restored missing planet textures with licensed, locally bundled maps and deterministic fallback textures.
- Added Earth clouds and night lights, atmospheric rims, Saturn ring details and an analytic ring shadow.
- Reworked camera framing and eased angular/position/zoom transitions, including reduced-motion behavior.
- Unified drag/pinch/pointer cancellation; bounded zoom and corrected labels, occlusion and projection bounds.
- Added adaptive resolution/star density, hidden-tab pausing and context-loss recovery.

## Reliability

- Split the original embedded HTML into independently cacheable code, data, assets and vendor files.
- Removed runtime CDN/font dependencies. No installation or build is required for the website.
- Added no-WebGL and missing-data fallbacks, finite texture-load deadlines and serialized optional audio controls.
- Included upstream Three.js MIT licence and texture CC BY 4.0 provenance.
- Added zero-dependency syntax, data, controller, server and camera-math tests, plus an optional Playwright regression suite.

## Validation limits

Static and automated non-browser tests were run in the implementation environment. Real browser rendering, screenshots, GPU behavior and touch-device performance could not be verified because browser access was blocked. The optional browser suite is provided for that validation; a passing non-browser check is not a visual QA sign-off.

The initial delivery was local. Subsequent GitHub/Pages publication was explicitly authorized by the repository owner on 2026-10-06.
