# Proofline — Development Spec & Test Plan
*Written 2026-09-27, from the actual `proofline-mockup-studio.jsx` (originally 2,423 lines; 2556 after the 2026-09-27 Presets and phone-frame work) plus a full read of the prior 68-message chat. This replaces memory of "what Proofline does" with ground truth — use it instead of re-describing the app from scratch in the new chat.*

---

## 0. How to use this document

1. Start the new chat by attaching **this file** plus the current `proofline-mockup-studio.jsx` (and `proofline-app.zip` if you're touching the standalone build).
2. Use the **Kickoff message** in §8 as your first message, edited to describe the one thing you want next.
3. Whatever gets built next should update §3 (issues) and §4 (state schema) the same day it changes, not "eventually" — that's the rule that was missing before.

---

## 1. Purpose & what "done" means

**Proofline** is a client-side React + Canvas app that frames screenshots inside realistic device bezels for App Store / marketing use. No server, no upload — everything runs in the browser. It exists as a single self-contained `.jsx` file (required for Claude.ai artifact compatibility) and as a standalone HTML/JS/CSS bundle.

The last two real requests in the prior chat, still open:
- ~~**A "Presets" tab**~~ — **delivered 2026-09-27** (Section 00). Saves/applies a named combination of ratio, orientation, tilt, device type/color, layout mode, background settings, status bar, caption style, device size, and export scale. Never captures slides, photos, per-slide zoom/pan, or the Unsplash key.
- **A more realistic phone frame** — **procedural pass landed 2026-09-27, awaiting your sign-off**: thinner bezel with brighter rim line, shaded raised side buttons, and a subtle screen-glass sheen (all inside `drawPhoneFrame`; other device types verified byte-identical). It is a better *illustration*, not a photograph — true photorealism would mean compositing onto licensed device-photo templates, a separate and much larger effort.

Going forward, "done" means: the specific acceptance criterion stated for that request is met, **and** the relevant rows of the §6 checklist pass. Not "I think I finished." See §7 for the reporting format that replaces "did you finish?"

---

## 2. Current feature inventory (ground truth from the code)

**Source** — multi-file add (picker or drag/drop), JPG/PNG native, HEIC via an injected `heicConverter` callback (not decodable in the plain artifact preview without it — the standalone build wires up `heic2any`). Thumbnail strip with reorder, duplicate, remove, add-more. "Clear saved project."

**Device** — Phone, Tablet, Watch, Laptop, Browser frames (5 types, each with its own draw function).

**Frame** — 7 export ratios (9:16, 4:5, 1:1, 3:4, 2:3, 4:3, 16:9); portrait/landscape (phone & tablet only — watch/laptop/browser are orientation-locked); 6 device body colors; tilt −15°…15°.

**Zoom** *(two distinct controls, one section — see §3)*:
- "Device size" — how large the device frame sits in the canvas (50–100%, a padding factor).
- "Screenshot zoom" — zoom on the photo inside the frame (1×–2.5×), with drag-to-pan and "Apply to all" / "Reset."

**Presets** *(Section 00)* — name + Save; saved presets listed with Apply and delete; same-name save overwrites; blank names ignored; persisted under `proofline:presets`; **Apply never switches to an Image/Unsplash background when no photo is loaded** (presets don't store photos, so switching would just show the default gradient) — every other saved setting still applies; malformed stored presets are ignored on load; exported helpers `PRESET_FIELDS` / `presetSettingsFromState` (covered by `presets-logic.test.mjs`).

**Layout** — Single / Fan (offset 2-device stack) / Side-by-side, with a slide-pairing picker.

**Background** — three source modes: **Color** (none → transparent PNG; solid, 7 presets + custom; gradient, 9 presets + custom), **Image** (own upload), **Unsplash** (search, needs the viewer's own free API key). Brightness (50–150%) and blur (0–20px) apply to Image/Unsplash backdrops.

**Status bar** — off / light / dark (phone & tablet only).

**Caption** — headline + subheadline, position top/bottom/left/right, light/dark text, 4 font choices.

**Export** — 1×/2×/3× scale; single PNG; ZIP of all slides; ZIP of all ratios × all slides; animated WebM (Ken-Burns pan for one slide, crossfade slideshow for multiple) via `MediaRecorder` + `canvas.captureStream`.

**Persistence** — debounced (900ms) autosave to `window.storage` (artifact) with a `localStorage` fallback (standalone), restoring slides, all settings, and the background image on reload.

---

## 3. Known-issues watchlist

These are the specific, evidenced patterns from the last chat — not generic advice.

1. **The recurring "zoom is broken" reports were probably two different bugs treated as one.** "Device size" and "Screenshot zoom" are two separate state variables (`padding`, `activeSlide.zoom`) sitting under one "Zoom" section label. When a fix targeted one, a report that actually meant the other would still read as "still broken." One root cause *is* documented in the code itself — `computePhoneRect` (line ~502) has a comment explaining that `padding` used to be silently capped by whichever canvas dimension was tighter, so the slider had no visible effect across part of its range; that's fixed now, but there's no regression test guarding it. Treat §6's zoom rows as mandatory after *any* layout-adjacent change, and if "zoom" is reported broken again, ask **which** slider before touching code.
2. **Background/backdrop state churned for ~5 messages** (`backdropSource`, `colorMode`, `gradientIdx`, `customGradient`, `solidIdx`, `customSolidColor`) before landing on its current clean 3-way shape (Color/Image/Unsplash). It's fine now — but nothing marked it as final, so don't re-litigate this shape without a reason; extend it instead (see §5).
3. **No regression tests shipped.** The `render-test.mjs` / `-2` / `-3` / `backdrop-test.mjs` / `final-combo-test.mjs` scripts built during development were one-off container scripts, never saved as a reusable suite. §6 is meant to replace that pattern with one fixed list.
4. ~~Never delivered: the Presets tab~~ — delivered 2026-09-27, with automated tests. `presets-ui.test.mjs` mounts the real component under jsdom with real `localStorage` and covers save, blank name, same-name overwrite, Apply (every one of the 20 captured fields, observed via the autosaved manifest), delete, reload persistence, older-preset compatibility, and corrupt-storage tolerance (`mutate.py` / `mutate-all-fields.py` confirm each behavior and each field is guarded). **Still not covered:** a real browser — actual `window.storage` in the artifact runtime, canvas drawing, and layout. The Presets code was originally written before these tests existed; the tests were added afterward and validated by failing against the pre-Presets file and by mutation.
5. **Worth confirming, not assuming:** the original ask included "4:5 top" and "4:5 bottom" ratio presets; only a single `4:5` exists today. If this still matters, it needs to be asked for explicitly with a definition of what "top/bottom" anchoring means for the crop.
6. **The multi-file split-and-reassemble attempt** (engine.jsx + ui-part1.jsx stitched via shell `cat`/`sed`) produced a working file eventually, but only after compiling the *combined* output at the end rather than each piece — see §5 for the replacement rule.

---

## 4. State schema (single source of truth)

This is the entire component's state, current as of the attached file. Update this block, not just the code, whenever a variable is added, renamed, or repurposed.

```js
// --- persisted per-project (survives reload via storage) ---
slides            // [{ id, img, title, subtitle, zoom, panX, panY, pairId }]
activeIdx         // index into slides
ratioId           // one of RATIOS ids: "9:16" | "4:5" | "1:1" | "3:4" | "2:3" | "4:3" | "16:9"
orientation       // "portrait" | "landscape"
tilt              // -15..15 (degrees)
deviceTypeId      // "phone" | "tablet" | "watch" | "laptop" | "browser"
multiLayout       // "single" | "fan" | "side-by-side"
backdropSource    // "color" | "image" | "unsplash"
colorMode         // "none" | "solid" | "gradient" — only meaningful when backdropSource === "color"
gradientIdx       // index into BACKDROPS, or -1 for custom
customGradient    // [hex, hex]
solidIdx          // index into SOLID_COLORS, or -1 for custom
customSolidColor  // hex
bgImage           // { img, src, attribution? } | null — used for both "image" and "unsplash" sources
unsplashKey       // saved API key (persisted)
backdropBrightness// 50..150
backdropBlur      // 0..20 (px)
deviceColorId     // key into DEVICE_COLORS
statusBar         // "off" | "light" | "dark"
captionColor      // "light" | "dark"
captionPosition   // "top" | "bottom" | "left" | "right"
fontId            // key into FONT_CHOICES
padding           // 0.5..1 — "Device size" slider
exportScale       // 1 | 2 | 3

presets           // [{ id, name, settings }] — persisted separately under "proofline:presets"; settings = PRESET_FIELDS subset

// --- session-only (not persisted) ---
presetNameDraft
unsplashKeyDraft, unsplashQuery, unsplashResults, unsplashLoading, unsplashError
isDragging, isPanning, isZipping, isExportingVideo, videoProgress
fileError, saveStatus ("idle"|"saving"|"saved"), hydrated

// --- derived (not state, computed each render) ---
activeSlide, ratioObj, deviceInfo, isTransparent, colors, backdropImg, fontStack, secondarySlide
```

**Render engine input** (`renderMockup(ctx, w, h, opts)` — pure function, no React):
```js
{ slide, secondarySlide, multiLayout, colors, transparent, backdropImage,
  backdropBrightness, backdropBlur, deviceScheme, deviceTypeId, statusBarStyle,
  captionColor, captionPosition, fontStack, paddingFactor, orientation, tiltDegrees }
```

---

## 5. File architecture rule

- **Stay single-file.** The artifact constraint requires it, and the file is already organized into clear, marked regions (rendering engine → zip/storage utilities → the `ProoflineStudio` component: state → effects → handlers → JSX sections 01–09). Keep new code in the region it belongs to.
- **Never split the file into pieces and reassemble with shell commands again.** The engine.jsx/ui-part1.jsx `cat`/`sed` approach (message 25–27 of the last chat) only gets compile-checked *after* the stitch, so errors surface late and are harder to localize. Edit the single file directly with `str_replace`, and run an `esbuild` syntax check after each functional change, not after a batch of them.
- **New constants** (a device type, a ratio, a color) go in the existing top-of-file constant blocks (`DEVICE_TYPES`, `RATIOS`, `SOLID_COLORS`, `BACKDROPS`, `DEVICE_COLORS`, `FONT_CHOICES`) — never inline in JSX.
- **New state** gets added to §4 in the same turn it's added to the code.

---

## 6. Test checklist — run the relevant rows before any "this is done" claim

**Automated first:** `npx esbuild proofline-mockup-studio.jsx --format=esm --outfile=studio.built.mjs && node --test` (needs `npm install --no-save esbuild react react-dom lucide-react canvas jsdom`). Must be green before any manual row below counts.

Not every row applies to every change — run the ones the change could plausibly affect, and say which ones you ran (§7).

- [ ] Screenshot zoom at 1.0×, 1.5×, 2.5× — image covers the frame with no gaps at each
- [ ] Drag-to-pan at zoom > 1, checked with caption position = top, bottom, left, and right
- [ ] "Apply to all" and "Reset" with 2+ slides loaded
- [ ] Device-size slider across its full 50–100% range, portrait and landscape
- [ ] Each device type (phone/tablet/watch/laptop/browser) renders with no clipping or overflow
- [ ] Orientation toggle on phone and tablet, with a caption set on a side position (left/right column width depends on orientation)
- [ ] Fan layout and side-by-side layout with 2 real screenshots, including the pairing picker
- [ ] Background: transparent (none), solid + custom color picker, gradient + custom gradient, own image upload, Unsplash search + select (with and without a saved key, and with a rejected/invalid key)
- [ ] Backdrop brightness and blur sliders, with an Image or Unsplash backdrop active
- [ ] Caption in all 4 positions × both text colors × all 4 fonts × (headline only / subheadline only / both / neither)
- [ ] HEIC upload — note in the report whether `heicConverter` was available in that environment
- [ ] Export: single PNG, ZIP of all slides, ZIP of all ratios, animated WebM with 1 slide, animated WebM with 3+ slides
- [ ] Reload and confirm slides + every setting + background image restore correctly
- [ ] "Clear saved project" actually empties storage and resets the UI

---

## 7. Session protocol (how requests and reports work from here)

- **One scoped thing per request, with a stated acceptance criterion.** Not "add more features" or "add them all" — e.g. "Add a Presets tab: a named preset saves ratio + device + background + caption settings (not slides/photos), and selecting one applies all of them." If a request bundles more than one independent feature, it gets named as multiple and done one at a time.
- **Every reply that finishes a change reports:** what changed, which §6 rows were run and their result (pass/fail/not-applicable), and anything left uncertain. That report is the answer to "did you finish?" — it shouldn't need re-asking.
- **Any rename or reshape of state gets flagged and §4 gets updated the same turn** — no more silent drift that later needs a `grep` hunt to reconstruct.
- **A bug report gets one clarifying question when it could mean either of two controls** (see §3, item 1) before a fix is attempted.

---

## 8. Kickoff message for the new chat

> I'm continuing development on **Proofline**, a React + Canvas iPhone/device mockup generator. Attached: the current `proofline-mockup-studio.jsx` [and `proofline-app.zip`], plus `proofline-spec-and-test-plan.md` — please read the spec first; it has the full feature list, known issues, state schema, and the test checklist to run before calling anything "done." Here's what I want next: **[one scoped feature or fix, with what "done" looks like]**.
