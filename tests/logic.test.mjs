import test from "node:test";
import assert from "node:assert/strict";
import {
  computePhoneRect, DEVICE_TYPES, RATIOS, STORE_SIZES, ALL_FRAMES, historyPush, historyUndo, historyRedo,
  resolveSlideDevice, pairedSlideFor, parseRichWords, parseCaptionLines, applyCaptionLines, frameTag,
  PRESET_FIELDS, SNAPSHOT_FIELDS, presetSettingsFromState, isHeicFile, buildZip,
} from "../studio.built.mjs";

const M = { top: 100, bottom: 100, left: 0, right: 0 };
const A = DEVICE_TYPES.phone.aspect;

test("Device size slider scales the device proportionally across its whole 50–100% range", () => {
  for (const r of RATIOS) for (const o of ["portrait", "landscape"]) {
    const full = computePhoneRect(r.w, r.h, M, 1, o, A);
    for (const p of [0.5, 0.6, 0.75, 0.9]) {
      const rc = computePhoneRect(r.w, r.h, M, p, o, A);
      assert.ok(Math.abs(rc.w / full.w - p) < 1e-9, `${r.id} ${o} ${p}`);
      assert.ok(rc.w < full.w);
    }
  }
});
test("device always fits inside the frame at every size", () => {
  for (const f of ALL_FRAMES) for (const d of Object.values(DEVICE_TYPES)) for (const o of ["portrait", "landscape"]) {
    const rc = computePhoneRect(f.w, f.h, { top: f.h * 0.06, bottom: f.h * 0.06, left: 0, right: 0 }, 1, o, d.aspect);
    assert.ok(rc.x >= -0.01 && rc.y >= -0.01 && rc.x + rc.w <= f.w + 0.01 && rc.y + rc.h <= f.h + 0.01, `${f.id} ${d.id} ${o}`);
  }
});
test("App Store sizes are the exact pixel sizes and are flagged exact", () => {
  const got = Object.fromEntries(STORE_SIZES.map((s) => [s.id, [s.w, s.h, s.exact]]));
  assert.deepEqual(got, { "iphone-6.9": [1320, 2868, true], "iphone-6.5": [1284, 2778, true], "ipad-13": [2064, 2752, true] });
  assert.equal(new Set(ALL_FRAMES.map((f) => f.id)).size, ALL_FRAMES.length);
  assert.equal(frameTag("iphone-6.9"), "iphone-6.9");
  assert.equal(frameTag("4:5"), "4x5");
});
test("undo/redo history: push, dedupe, undo, redo, branch cut, cap", () => {
  const snap = (n) => { const o = {}; for (const k of SNAPSHOT_FIELDS) o[k] = n; return o; };
  let h = { stack: [], idx: -1 };
  h = historyPush(h, snap(1)); h = historyPush(h, snap(2)); h = historyPush(h, snap(3));
  assert.equal(h.idx, 2);
  assert.equal(historyPush(h, h.stack[2]), h, "identical snapshot is not a new step");
  h = historyUndo(h); h = historyUndo(h);
  assert.equal(h.idx, 0);
  assert.equal(historyUndo(h), h);
  h = historyRedo(h); assert.equal(h.idx, 1);
  h = historyPush(h, snap(9)); // branch: redo tail discarded
  assert.equal(h.stack.length, 3); assert.equal(historyRedo(h), h);
  let big = { stack: [], idx: -1 };
  for (let i = 0; i < 80; i++) big = historyPush(big, snap(i), 50);
  assert.equal(big.stack.length, 50); assert.equal(big.idx, 49);
});
test("per-slide device override falls back to global and ignores unknown ids", () => {
  assert.deepEqual(resolveSlideDevice({ deviceTypeId: "tablet", deviceColorId: null }, "phone", "black"), { deviceTypeId: "tablet", deviceColorId: "black" });
  assert.deepEqual(resolveSlideDevice({ deviceTypeId: "bogus", deviceColorId: "nope" }, "phone", "gold"), { deviceTypeId: "phone", deviceColorId: "gold" });
  assert.deepEqual(resolveSlideDevice(undefined, "watch", "pink"), { deviceTypeId: "watch", deviceColorId: "pink" });
});
test("pairing is resolved from the slide being rendered, not the active one", () => {
  const a = { id: "a", pairId: "b" }, b = { id: "b", pairId: null }, c = { id: "c", pairId: null };
  assert.equal(pairedSlideFor(a, [a, b, c], "fan"), b);
  assert.equal(pairedSlideFor(c, [a, b, c], "fan"), null);
  assert.equal(pairedSlideFor(a, [a, b, c], "single"), null);
  assert.equal(pairedSlideFor(a, [a, c], "fan"), null, "dangling pairId");
});
test("caption highlight parsing", () => {
  assert.deepEqual(parseRichWords("Get *started* today"), [{ t: "Get", hl: false }, { t: "started", hl: true }, { t: "today", hl: false }]);
  assert.deepEqual(parseRichWords("Hello *world"), [{ t: "Hello", hl: false }, { t: "world", hl: false }], "unmatched star is plain");
  assert.deepEqual(parseRichWords("*a b* c").map((w) => w.hl), [true, true, false]);
  assert.deepEqual(parseRichWords(""), []);
});
test("batch captions: order, blank lines skip, pipe splits subtitle, extra lines ignored", () => {
  const lines = parseCaptionLines("One | Sub\n\nThree\nFour");
  const slides = [{ id: 1, title: "x", subtitle: "keep" }, { id: 2, title: "stay", subtitle: "stay" }, { id: 3, title: "", subtitle: "old" }];
  const out = applyCaptionLines(slides, lines);
  assert.deepEqual(out.map((s) => [s.title, s.subtitle]), [["One", "Sub"], ["stay", "stay"], ["Three", "old"]]);
  assert.equal(out[1], slides[1]);
});
test("presets capture every field and never slides/photos", () => {
  const st = Object.fromEntries(PRESET_FIELDS.map((k) => [k, k])); st.slides = [1]; st.bgImage = {};
  const p = presetSettingsFromState(st);
  assert.deepEqual(Object.keys(p).sort(), [...PRESET_FIELDS].sort());
  assert.ok(!("slides" in p) && !("bgImage" in p));
});
test("HEIC detection", () => {
  assert.ok(isHeicFile({ name: "a.HEIC", type: "" }) && isHeicFile({ name: "x", type: "image/heif" }));
  assert.ok(!isHeicFile({ name: "a.png", type: "image/png" }));
});
test("zip builder produces a valid STORED archive", async () => {
  const blob = await buildZip([{ name: "a.txt", blob: new Blob(["hello"]) }, { name: "b.txt", blob: new Blob(["world!"]) }]);
  const u = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(u.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(u.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(u.length - 22 + 10, true), 2);
});
