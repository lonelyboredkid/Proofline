# Proofline

A client-side device-mockup generator. Drop in app screenshots, frame them in a phone, tablet, watch, laptop or browser, add a backdrop and caption, and export for App Store and marketing use. Everything runs in the browser: no server, nothing is uploaded.

The whole app is one React component, `proofline-mockup-studio.jsx`, so it can be pasted into a Claude.ai artifact as-is. Rendering is plain HTML5 Canvas 2D.

## About

Proofline turns plain app screenshots into polished marketing visuals. It is a free, private take on Screeny-style mockup apps: there is no account, no watermark and no upload, because every pixel is drawn on your own device with Canvas. It is meant for indie developers and designers who need App Store and social images quickly, and it stays small on purpose: one component, no backend.

## Features

- **Devices:** phone, tablet, watch, laptop, browser. Metal bezels, glass reflections, buttons, and a two-layer shadow. Six body colours, portrait or landscape (phone and tablet), tilt from -15 to 15 degrees.
- **Layouts:** single, fan, or side-by-side with a second screenshot.
- **Backdrop:** transparent, solid, gradient, your own photo, or an Unsplash search (bring your own free API key). Brightness and blur for photo backdrops.
- **Captions:** headline and subheadline, four positions, light or dark text, four fonts.
- **Screenshot control:** zoom 1x to 2.5x, drag to pan, apply to all slides.
- **Presets:** save, apply and delete named looks (20 settings). Presets never include your screenshots, zoom/pan or the Unsplash key.
- **Export:** PNG at 1x, 2x or 3x, ZIP of all slides, ZIP of all ratios, animated WebM. Seven ratios from 9:16 to 16:9.
- **Autosave:** your project is restored on reload (`window.storage`, falling back to `localStorage`).

HEIC photos need a converter passed in as `heicConverter`; a plain artifact preview cannot decode them.

## Using it

Paste `proofline-mockup-studio.jsx` into a Claude.ai artifact, or import the default export into a React 18+ app that has `react`, `react-dom` and `lucide-react`.

## Hosting it as a website

`docs/` holds a ready-to-serve static build (HTML, JS, CSS), so the app opens straight from a link with no install. It is published with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/docs`. After changing the app, run `npm run site` and commit the updated `docs/`.

## Development

```bash
npm install
npm test        # builds with esbuild, then runs the node test suite
```

| File | Covers |
| --- | --- |
| `presets-ui.test.mjs` | Presets in the real component (jsdom, real `localStorage`, no mocks): save, apply, delete, reload, corrupt storage |
| `presets-logic.test.mjs` | Which settings a preset captures |
| `render-regression.test.mjs` | Pixel checks that glare and bezels never hide the screenshot, on every device and colour |

Helpers: `render-check.mjs` renders one mockup to PNG through node-canvas, `sheet.mjs` tiles renders into a comparison sheet, and `mutate*.py` are the mutation scripts used to confirm the tests can fail.

`proofline-spec-and-test-plan.md` is the project spec: feature inventory, known issues, state schema, and the manual checklist to run before calling a change done.

## Releases

The latest version is **v1.0.0**. See [CHANGELOG.md](CHANGELOG.md) for what each release contains, and the repo's Releases page for tagged versions. To cut a new one: update the changelog, run `npm test` and `npm run site`, commit, then tag it (`git tag -a vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`).

## Status

- **Checked:** 41 automated tests pass, and the built site was smoke-tested in headless Chromium (loads with no console errors, frames an uploaded screenshot, saved presets survive a reload).
- **Not yet checked:** Safari, Firefox and phone browsers, plus the full manual checklist in the spec.
- **Known limits:** HEIC photos do not open on the hosted site, because the converter is not bundled. The device frames are drawn procedurally, so they are polished illustrations rather than photographs. Photorealism would mean compositing onto licensed device photos.
