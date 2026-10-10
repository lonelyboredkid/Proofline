# Changelog

## v1.0.0 - 2026-10-10

First tagged release.

### Added
- **Presets:** save, apply and delete named looks covering 20 settings (ratio, orientation, tilt, device and colour, layout, backdrop, status bar, caption style, device size, export scale). Presets never include screenshots, zoom/pan or the Unsplash key, survive reloads, and ignore corrupt stored data.
- **Hosted build:** `docs/` is a ready-to-serve static site, so the app opens from a link with no install. `npm run site` rebuilds it.
- **Tests:** 41 automated tests covering Presets in the real component, the settings a preset captures, and pixel checks that glare and bezels never hide the screenshot.
- **Repo tooling:** `package.json` with `npm test`, a lockfile, mutation-testing scripts and render helpers.

### Changed
- **Realistic device frames:** phone, tablet, watch, laptop and browser were redrawn with brushed-metal edges, a black glass surround, screen glare, shaded buttons and a two-layer shadow. The phone has a Dynamic Island, the watch has a strap texture and ridged crown, the laptop has a camera notch and base lip, and the browser has a toolbar with an address pill.
- Choosing a preset that uses a photo backdrop no longer switches to it when no photo is loaded.

### Known limits
- HEIC photos do not open on the hosted site because the converter is not bundled. JPG and PNG work.
- Device frames are drawn procedurally: polished illustrations, not photographs.
- Checked in headless Chromium only; Safari, Firefox and phone browsers are untested.

### Baseline
- `4f408c5`: the original `proofline-mockup-studio.jsx` upload.
