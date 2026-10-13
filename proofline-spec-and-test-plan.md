# Proofline — Development Spec & Test Plan
*Rewritten 2026-10-12 against the actual `proofline-mockup-studio.jsx` (3,263 lines). The previous version (2026-09-27) described a 2,556-line file and was stale: it listed features as "not built" that already existed. Treat this file as ground truth; update it in the same turn as any code change.*

---

## 0. How to use this document

1. Start a new chat by attaching **this file** plus the current `proofline-mockup-studio.jsx` and the `tests/` folder.
2. Run `npm install && npm test` first. It must be green before anything is called "done".
3. Whatever gets built next updates §3 (issues), §4 (state schema) and §6 (tests) the same day.
4. **Keep the project copy of the .jsx in sync.** The stale project copy is how this spec drifted from the code.

---

## 1. Purpose & what "done" means

**Proofline** is a client-side React + Canvas app that frames screenshots inside device bezels for App Store / marketing use. No server, no upload. One self-contained `.jsx` (Claude.ai artifact compatible), plus an optional standalone bundle.

"Done" = the stated acceptance criterion is met **and** `npm test` is green **and** the relevant §6 manual rows pass.

Open request: **"4:5 top / 4:5 bottom" ratios** (see §3, O1) — needs a definition from the owner before it can be built.

---

## 2. Feature inventory (ground truth from the code)

- **Source** — multi-file add (picker/drag-drop), JPG/PNG native, HEIC via injected `heicConverter`. Thumbnail strip: reorder, duplicate, remove, add. "Clear saved project".
- **Undo / redo** — header buttons + Ctrl/⌘+Z, Ctrl/⌘+Shift+Z / Y. Snapshots slides + every `PRESET_FIELDS` setting + background image; 400 ms debounce; 50-step cap; ignores active-slide browsing; skipped while typing in text fields.
- **Presets** (§00) — save/apply/delete named looks (`PRESET_FIELDS`, 27 fields). Never stores slides, photos, per-slide zoom/pan or the Unsplash key. Apply won't switch to Image/Unsplash with no photo loaded.
- **Device** — Phone, Tablet, Watch, Laptop, Browser. **Per-slide override** of device type and colour via the "All slides / This slide only" toggle; thumbnails show a `dev` badge; "Reset all to global". Phone **screen cutout**: Island / Notch / Punch-hole / Clean.
- **Frame** — 7 social ratios; **App Store sizes** (iPhone 6.9″ 1320×2868, 6.5″ 1284×2778, iPad 13″ 2064×2752 — exact pixels, always 1×; verify against Apple's current spec); portrait/landscape (phone & tablet); 6 body colours; tilt ±15°; **preview guides** (Off / Social UI / Safe area — DOM overlay, never exported).
- **Device size** (§04) and **Screenshot zoom** (§05) are separate sections. Zoom has drag-to-pan, Apply to all, Reset.
- **Effects** (§06) — shadow strength 0–200 %, floor reflection.
- **Layout** — Single / Fan / Side-by-side with a pairing picker.
- **Background** — Color (none = transparent, solid, gradient, custom), Image upload, Unsplash (user's own key); brightness/blur for photos.
- **Status bar** — off / light / dark (phone & tablet).
- **Caption** — headline/subheadline, 4 positions, light/dark text, 4 fonts, **highlight** words with `*stars*` as colour or pill (own colour picker), **batch captions** (one line per slide, `Headline | Subheadline`).
- **Export** — PNG / JPG / WebP (quality slider; JPG flattens onto white), 1×/2×/3× (locked to 1× for App Store sizes), single image, ZIP of all slides, ZIP of all sizes, animated WebM.
- **Persistence** — debounced (900 ms) autosave to `window.storage` / `localStorage`; images written once and deleted when their slide is removed; header shows `saving… / saved / not saved` (red when storage is full or blocked).

---

## 3. Issues

### Fixed 2026-10-12 (each has a regression test)
1. **2×/3× exports had a thinner shadow than the preview.** `shadowBlur`/`shadowOffset` ignore the canvas transform, so `ctx.scale(2|3)` didn't scale them. Fixed in `drawDeviceShadow` by multiplying by the CTM scale. (Measured in Chromium: shadow reached ~60 px at 1× but ~16 px at 3×.)
2. **Backdrop blur was 2–3× weaker in exports** — same cause (`ctx.filter` lengths ignore the transform). Fixed in `renderMockup`. (Mean pixel difference 1× vs 2×: 33.6 → 1.6.)
3. **Tilted devices had a sideways-skewed shadow.** The old "counter-rotation" compensated for a transform that doesn't apply to shadow offsets. Offset is now always straight down.
4. **Unsplash background broke exports after a reload.** The saved URL was reloaded without `crossOrigin`, tainting the canvas; every export then failed silently. It is now reloaded with CORS; if that fails the user is told and the gradient is used. Attribution is persisted (`bgAttribution`) so the Unsplash credit survives reload.
5. **Storage filled up silently.** Every save rewrote every image data-URL and removed slides' images were never deleted, so the ~5 MB quota was eventually hit and slides vanished on reload. Images are now written once, deleted with their slide, and a failed write shows "not saved".
6. **Export failures were silent** (unhandled promise rejections). All export paths now show an error. WebP on Safari (which silently returns PNG) is named `.png`.

### Still open
O1. **"4:5 top" / "4:5 bottom"** from the original request: only a single `4:5` exists. Needs a definition of what top/bottom anchoring means for the crop.
O2. **Fan / side-by-side use the primary slide's device and colour for both devices** (the paired slide's override is ignored).
O3. **Reflection allocates two full-canvas buffers per device per render**; heavy with reflection on during WebM export.
O4. **Safe-area guide percentages are approximate** (5 % inset; social 14 % top / 20 % bottom), not Apple's/Instagram's published numbers.
O5. **Not tested:** real `window.storage` in the Claude.ai artifact runtime, HEIC conversion, Unsplash network search, WebM recording output, Safari/Firefox rendering.

---

## 4. State schema

```js
// --- persisted per project (manifest version 2) ---
slides            // [{ id, img, title, subtitle, zoom, panX, panY, pairId, deviceTypeId|null, deviceColorId|null }]
ratioId           // RATIOS id or STORE_SIZES id ("iphone-6.9" | "iphone-6.5" | "ipad-13")
orientation, tilt, deviceTypeId, deviceColorId, multiLayout
backdropSource, colorMode, gradientIdx, customGradient, solidIdx, customSolidColor
bgImage           // { img, src, attribution? } | null   (manifest: hasBgImage, bgAttribution)
unsplashKey       // persisted, NOT in presets/undo
backdropBrightness, backdropBlur
statusBar, captionColor, captionPosition, captionAccent, accentStyle ("color"|"pill"), fontId
phoneStyle        // "island" | "notch" | "punch" | "none"
shadowStrength    // 0..200
reflection        // boolean
padding           // 0.5..1  ("Device size")
exportScale       // 1|2|3   (ignored for exact App Store sizes)
exportFormat      // "png" | "jpg" | "webp"
exportQuality     // 50..100
presets           // [{ id, name, settings }] under "proofline:presets"

// PRESET_FIELDS = all of the above except slides/bgImage/unsplashKey (27 fields)
// SNAPSHOT_FIELDS = PRESET_FIELDS + slides + bgImage  (undo/redo)

// --- session-only ---
activeIdx, deviceScope ("all"|"slide"), guides ("off"|"social"|"store"), captionBatch,
presetNameDraft, unsplash* drafts/results, isDragging, isPanning, isZipping, isExportingVideo,
videoProgress, fileError, saveStatus ("idle"|"saving"|"saved"|"error"), hydrated, histVersion
// refs: histRef, savedImagesRef (ids already in storage), savedBgSrcRef
```

**Storage keys:** `proofline:manifest`, `proofline:image:<slideId>`, `proofline:bgimage`, `proofline:presets`.

**Render engine input** (`renderMockup(ctx, w, h, opts)`, pure, no React): `slide, secondarySlide, multiLayout, colors, transparent, backdropImage, backdropBrightness, backdropBlur, deviceScheme, deviceTypeId, statusBarStyle, captionColor, captionPosition, captionAccent, accentStyle, fontStack, paddingFactor, orientation, tiltDegrees, phoneStyle, shadowStrength, reflection, createCanvas`.

**Canvas rule:** anything the engine draws with `shadowBlur`, `shadowOffset*` or `ctx.filter` must be multiplied by the CTM scale by hand — those ignore `ctx.scale()`.

---

## 5. File architecture rule

- Stay single-file (artifact constraint). Regions: engine → zip/storage → `ProoflineStudio` (state → effects → handlers → JSX sections 00–11).
- Edit the single file directly; run `npm run build` after each functional change.
- New constants go in the top-of-file blocks; new state is added to §4 in the same turn.
- Per-slide data that affects rendering must be resolved from the slide being rendered (`resolveSlideDevice`, `pairedSlideFor`), never from the active slide — exports render other slides.

---

## 6. Tests

**Automated** (`npm install && npm test`; needs the Chromium that Playwright ships, or `CHROMIUM=/path/to/chrome`):

| File | Covers |
|---|---|
| `tests/logic.test.mjs` | Device-size scaling across 50–100 % for every ratio/orientation; device always fits every frame; App Store sizes exact; undo/redo history (dedupe, branch cut, cap); per-slide device resolution; pairing; `*highlight*` parsing; batch captions; presets capture exactly `PRESET_FIELDS`; HEIC detection; ZIP validity |
| `tests/engine.browser.test.mjs` | Real Chromium: 2×/3× output matches 1× (shadow, tilt, landscape, blur); shadow distance equal at 1/2/3×; tilted shadow symmetric; screenshot zoom 1/1.5/2.5× × pan extremes leaves no gaps; every device × orientation × layout × frame renders; highlight colour/pill; reflection |
| `tests/app.browser.test.mjs` | The real React app: separate Device size / Screenshot zoom sections; undo/redo; per-slide override; storage cleanup + "Clear saved project"; reload restore; guides overlay; App Store export is exactly 1320×2868; failed Unsplash restore is reported and export still works |

Validated by running against the pre-fix file: the shadow/blur and storage/restore tests fail there and pass now.

**Manual rows still worth a look before release** (not automated):
- [ ] Drag-to-pan feel with caption top/bottom/left/right
- [ ] Unsplash search + select with a valid key; invalid key message
- [ ] HEIC upload (note whether `heicConverter` was available)
- [ ] Animated WebM with 1 slide and with 3+ slides
- [ ] Reload inside the real Claude.ai artifact (`window.storage`)
- [ ] Visual check of the 4 phone cutouts and reflection on a light backdrop

---

## 7. Session protocol

- One scoped thing per request with an acceptance criterion.
- Every reply that finishes a change reports: what changed, which tests ran and their result, anything uncertain.
- Any rename/reshape of state is flagged and §4 updated the same turn.
- A "zoom is broken" report gets one clarifying question first: **Device size** (§04) or **Screenshot zoom** (§05)?
- **Always attach the current .jsx** — never rely on the project copy being current.

---

## 8. Kickoff message for the next chat

> I'm continuing development on **Proofline**. Attached: the current `proofline-mockup-studio.jsx`, the `tests/` folder, and `proofline-spec-and-test-plan.md` — read the spec first. Run `npm install && npm test` before and after any change. Here's what I want next: **[one scoped feature or fix, with what "done" looks like]**.
