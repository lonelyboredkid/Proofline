import { createCanvas, Image } from "canvas";
import fs from "node:fs";
// usage: node render-check.mjs <built.mjs> <out.png> [scheme] [dark|light] [deviceType] [layout] [orientation] [tilt]
const [built, outFile, schemeName = "black", shotTone = "light", deviceTypeId = "phone", layout = "single", orientation = "portrait", tilt = "0"] = process.argv.slice(2);
const { renderMockup, DEVICE_COLORS } = await import(built);

const mkShot = () => {
  const shot = createCanvas(1170, 2532);
  const c = shot.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 2532);
  if (shotTone === "dark") { g.addColorStop(0, "#0a0a1a"); g.addColorStop(1, "#1a1a2e"); }
  else { g.addColorStop(0, "#4facfe"); g.addColorStop(1, "#00f2fe"); }
  c.fillStyle = g; c.fillRect(0, 0, 1170, 2532);
  const img = new Image(); img.src = shot.toBuffer("image/png"); return img;
};
const img = mkShot(), img2 = mkShot();
const out = createCanvas(1080, 1920);
renderMockup(out.getContext("2d"), 1080, 1920, {
  slide: { id: "a", img, title: "Track every workout", subtitle: "Right from your wrist", zoom: 1, panX: 0, panY: 0, pairId: "b" },
  secondarySlide: layout === "single" ? null : { id: "b", img: img2, title: "", subtitle: "", zoom: 1, panX: 0, panY: 0 },
  multiLayout: layout, colors: ["#3A5CFF", "#1B2A66"], transparent: false,
  backdropImage: null, backdropBrightness: 100, backdropBlur: 0,
  deviceScheme: DEVICE_COLORS[schemeName], deviceTypeId, statusBarStyle: "light",
  captionColor: "light", captionPosition: "top", fontStack: "system-ui, sans-serif",
  paddingFactor: 0.85, orientation, tiltDegrees: Number(tilt),
});
fs.writeFileSync(outFile, out.toBuffer("image/png"));
console.log("wrote", outFile);
