// Behavior tests for the Presets tab. Real component, real localStorage (jsdom) — no mocks.
// Run:  npx esbuild proofline-mockup-studio.jsx --format=esm --outfile=studio.built.mjs && node --test presets-ui.test.mjs
// Override the build under test with BUILT=./other.built.mjs
import { JSDOM } from "jsdom";
import test from "node:test";
import assert from "node:assert/strict";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/", pretendToBeVisual: true, resources: "usable" });
const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
for (const k of ["HTMLElement", "HTMLInputElement", "Image", "Event", "MouseEvent", "Node", "localStorage", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, k, { value: w[k], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const Studio = (await import(process.env.BUILT || "./studio.built.mjs")).default;

const PRESETS_KEY = "proofline:presets";
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Studio)); });
  await tick(); await tick(); // let async hydration from storage finish
  return { host, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

const buttons = (host) => [...host.querySelectorAll("button")];
function btn(host, text) {
  const hits = buttons(host).filter((b) => b.textContent.trim() === text);
  assert.ok(hits.length >= 1, `no button with text "${text}"`);
  return hits[0];
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); }); await tick(); };
async function typeName(host, value) {
  const input = host.querySelector('input[placeholder="Preset name"]');
  assert.ok(input, "preset name input not found");
  await act(async () => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
  });
}
const savePreset = async (host, name) => { await typeName(host, name); await click(btn(host, "Save preset")); };
const rowNames = (host) => [...host.querySelectorAll("span.truncate")].map((s) => s.textContent);
const active = (el) => el.className.includes("border-orange-500");
const storedPresets = () => JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
function seedBgPhoto() {
  localStorage.setItem("proofline:manifest", JSON.stringify({ version: 1, hasBgImage: true, slides: [] }));
  localStorage.setItem("proofline:bgimage", PNG_1PX);
}
const waitForPhoto = () => act(async () => { await new Promise((r) => setTimeout(r, 150)); });

test.beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

// Breaks caught: savePreset not appending, list not rendering, or nothing persisted.
test("saving a named preset lists it and persists it with the current settings", async () => {
  const { host, unmount } = await mount();
  await click(btn(host, "left"));
  await savePreset(host, "Dark Left");
  assert.deepEqual(rowNames(host), ["Dark Left"]);
  const [p] = storedPresets();
  assert.equal(p.name, "Dark Left");
  assert.equal(p.settings.captionPosition, "left");
  await unmount();
});

// Break caught: missing trim/empty guard in savePreset.
test("a blank or whitespace-only name adds nothing", async () => {
  const { host, unmount } = await mount();
  await savePreset(host, "   ");
  assert.deepEqual(rowNames(host), []);
  assert.deepEqual(storedPresets(), []);
  await unmount();
});

// Breaks caught: duplicates instead of replacing; replacing with stale (old) settings.
test("saving under an existing name replaces it, with the settings current at that moment", async () => {
  const { host, unmount } = await mount();
  await savePreset(host, "Look");
  await click(btn(host, "bottom"));
  await savePreset(host, "Look");
  assert.deepEqual(rowNames(host), ["Look"]);
  assert.equal(storedPresets().length, 1);
  assert.equal(storedPresets()[0].settings.captionPosition, "bottom");
  await unmount();
});

// Breaks caught: applyPreset skipping a field, or applying to the wrong setter.
test("Apply restores every saved setting it captured", async () => {
  const { host, unmount } = await mount();
  await click(btn(host, "left"));
  await click(btn(host, "dark text"));
  await savePreset(host, "Look");
  await click(btn(host, "right"));
  await click(btn(host, "light text"));
  assert.ok(active(btn(host, "right")) && active(btn(host, "light text")));
  await click(btn(host, "Apply"));
  assert.ok(active(btn(host, "left")), "caption position should be back to left");
  assert.ok(active(btn(host, "dark text")), "caption color should be back to dark");
  assert.ok(!active(btn(host, "right")));
  await unmount();
});

// Breaks caught: delete removing the wrong preset, or not updating storage.
test("deleting one preset leaves the others, in the list and in storage", async () => {
  const { host, unmount } = await mount();
  await savePreset(host, "A");
  await savePreset(host, "B");
  await click(host.querySelector('button[aria-label="Delete preset A"]'));
  assert.deepEqual(rowNames(host), ["B"]);
  assert.deepEqual(storedPresets().map((p) => p.name), ["B"]);
  await unmount();
});

// Breaks caught: presets not loaded on mount, or loaded after hydration gate (and then overwritten by []).
test("presets survive a reload (fresh mount over the same storage)", async () => {
  const first = await mount();
  await savePreset(first.host, "Keep me");
  await first.unmount();
  const second = await mount();
  assert.deepEqual(rowNames(second.host), ["Keep me"]);
  assert.deepEqual(storedPresets().map((p) => p.name), ["Keep me"], "reload must not wipe saved presets");
  await second.unmount();
});

// Break caught: applyPreset throwing or clobbering settings when a saved preset lacks a field.
test("applying a preset saved with fewer fields changes only those fields", async () => {
  localStorage.setItem(PRESETS_KEY, JSON.stringify([{ id: "x", name: "Old", settings: { captionPosition: "left" } }]));
  const { host, unmount } = await mount();
  await click(btn(host, "dark text"));
  await click(btn(host, "Apply"));
  assert.ok(active(btn(host, "left")));
  assert.ok(active(btn(host, "dark text")), "fields absent from the preset must be left alone");
  await unmount();
});

// Break caught: applyPreset forgetting any ONE of the 20 captured settings (or wiring it to the wrong setter).
// Observed through real behavior: Apply -> debounced autosave -> manifest in storage.
test("Apply restores all 20 captured settings (checked via the autosaved manifest)", async () => {
  const want = {
    ratioId: "16:9", orientation: "landscape", tilt: 7, deviceTypeId: "tablet", deviceColorId: "gold",
    multiLayout: "fan", backdropSource: "image", colorMode: "solid", gradientIdx: 3,
    customGradient: ["#112233", "#445566"], solidIdx: 2, customSolidColor: "#abcdef",
    backdropBrightness: 130, backdropBlur: 9, statusBar: "dark", captionColor: "dark",
    captionPosition: "right", fontId: "mono", padding: 0.7, exportScale: 3,
  };
  const settle = () => new Promise((r) => setTimeout(r, 1200)); // autosave debounce is 900ms
  const manifest = () => JSON.parse(localStorage.getItem("proofline:manifest"));

  // Guard against a tautological test: every wanted value must differ from the app's default.
  const fresh = await mount();
  await act(async () => { await settle(); });
  const defaults = manifest();
  for (const [k, v] of Object.entries(want)) {
    assert.notDeepEqual(defaults[k], v, `test value for ${k} equals the default; it could not detect a skipped setter`);
  }
  await fresh.unmount();

  localStorage.clear();
  seedBgPhoto(); // an Image-source preset only switches the source when a photo is loaded
  localStorage.setItem(PRESETS_KEY, JSON.stringify([{ id: "x", name: "Everything", settings: want }]));
  const { host, unmount } = await mount();
  await waitForPhoto();
  await click(btn(host, "Apply"));
  await act(async () => { await settle(); });
  const got = manifest();
  for (const [k, v] of Object.entries(want)) assert.deepEqual(got[k], v, `field ${k} was not applied`);
  await unmount();
});

// Break caught: trusting stored JSON blindly — a non-list value crashes the render on every load;
// an entry without settings throws when Apply is clicked.
test("corrupt stored presets are ignored instead of crashing the app", async () => {
  localStorage.setItem(PRESETS_KEY, JSON.stringify({ not: "a list" }));
  const a = await mount();
  assert.deepEqual(rowNames(a.host), [], "non-list value should behave like no presets");
  await a.unmount();

  localStorage.setItem(PRESETS_KEY, JSON.stringify([
    null, 5, { id: "1", name: "No settings" }, { name: "No id", settings: {} },
    { id: "ok", name: "Valid", settings: { captionPosition: "left" } },
  ]));
  const b = await mount();
  assert.deepEqual(rowNames(b.host), ["Valid"], "only well-formed presets should be listed");
  await click(btn(b.host, "Apply")); // must not throw
  assert.ok(active(btn(b.host, "left")));
  await b.unmount();
});

// Break caught: Apply switching to an Image/Unsplash source that has no photo behind it
// (the canvas would silently show the default gradient and Apply would look broken).
test("Apply leaves the background source alone when the preset used a photo but none is loaded", async () => {
  const settle = () => new Promise((r) => setTimeout(r, 1200));
  for (const source of ["image", "unsplash"]) {
    localStorage.clear();
    localStorage.setItem(PRESETS_KEY, JSON.stringify([
      { id: "x", name: "Photo look", settings: { backdropSource: source, captionPosition: "left" } },
    ]));
    const { host, unmount } = await mount();
    await click(btn(host, "Apply"));
    await act(async () => { await settle(); });
    const m = JSON.parse(localStorage.getItem("proofline:manifest"));
    assert.equal(m.backdropSource, "color", `${source}: source must stay on color when no photo is loaded`);
    assert.equal(m.captionPosition, "left", `${source}: the rest of the preset must still apply`);
    await unmount();
  }
});
