# Proofline

A client-side device-mockup generator. Drop in app screenshots, frame them in a phone, tablet, watch, laptop or browser, add a backdrop and caption, and export for App Store and marketing use. Everything runs in the browser: no server, nothing is uploaded.

The whole app is one React component, `proofline-mockup-studio.jsx`, so it can be pasted into a Claude.ai artifact as-is. Rendering is plain HTML5 Canvas 2D.

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

## Status

Tested in node, not yet signed off in a real browser. The device frames are drawn procedurally, so they are polished illustrations rather than photographs. Photorealism would mean compositing onto licensed device photos.
