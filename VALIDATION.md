# Validation record

Date: 2026-10-06
Branch: `improve/solar-atlas-experience`
Base: `267f5d0b4dee1bef532baf0d16f194bba1c88ab1`

## Passed

`npm run check` passes JavaScript syntax, unique HTML IDs, static asset references, JSON parsing, and **32 automated tests**:

- 10 controller/boot checks: body-only loading, 10 dossiers, multilingual search, language/state preservation, navigation/deep links, safe HTML/source links, keyboard handling, missing-engine boot, removed mission UI, DOM ID consistency
- 5 data/asset checks: complete bilingual body data, archival schema, texture files, solar-observation safety text, translated English parameter values
- 14 camera/gesture/math checks: system and selected-planet framing at 1440×1000, 820×900, 390×844 and 390×667; short-arc rotation; frame-rate-independent damping; zoom bounds; pinch cancellation; reduced motion; missing-engine parsing
- 2 cache-coherence checks: manifest hashes and shared versioned image/data requests
- 1 restricted local-server check

The controller tests execute the real application code with DOM stubs. The camera tests use the bundled Three.js vector, quaternion and projection math. Neither is a substitute for a browser rendering test.

## Not verified

- Real WebGL output and custom shader compilation
- Desktop/mobile visual composition and screenshots
- Actual GPU performance, browser compatibility and physical touch-device behavior
- Full scientific fact-check of every imported article or numerical value

The implementation environment blocked localhost browser access. After the owner authorized publication, the public Pages site was opened in the cloud browser. That browser could not create a WebGL context, so only the deliberate catalog fallback and its interactions could be inspected; no 3D rendered screenshots or GPU/shader validation are claimed. `npm run test:browser` provides an optional desktop/mobile/no-WebGL smoke suite for an environment where browser execution and WebGL are available.

Public deployment checks verified HTTP 200 responses and exact committed byte hashes for all 21 runtime assets. GitHub Pages built the publishing commit successfully.

## Publication

The initial validation record preceded publication. The repository owner explicitly authorized direct GitHub push and Pages deployment on 2026-10-06. See the repository commit and Pages build status for the publication result.
