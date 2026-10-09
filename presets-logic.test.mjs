import assert from "node:assert";
import { PRESET_FIELDS, presetSettingsFromState } from "./studio.built.mjs";

const fakeState = {
  ratioId: "4:5", orientation: "landscape", tilt: 5, deviceTypeId: "tablet",
  deviceColorId: "gold", multiLayout: "fan", backdropSource: "image",
  colorMode: "solid", gradientIdx: 2, customGradient: ["#111111", "#222222"],
  solidIdx: -1, customSolidColor: "#abcdef", backdropBrightness: 120,
  backdropBlur: 4, statusBar: "dark", captionColor: "dark",
  captionPosition: "left", fontId: "mono", padding: 0.7, exportScale: 3,
  slides: [{ id: "x" }], bgImage: { src: "data:fake" }, unsplashKey: "secret",
};

const preset = presetSettingsFromState(fakeState);

assert.deepStrictEqual(Object.keys(preset).sort(), [...PRESET_FIELDS].sort());
for (const key of PRESET_FIELDS) assert.deepStrictEqual(preset[key], fakeState[key]);
assert.ok(!("slides" in preset) && !("bgImage" in preset) && !("unsplashKey" in preset));
assert.deepStrictEqual(JSON.parse(JSON.stringify(preset)), preset);
console.log("presets-logic: all assertions passed");
